<?php

namespace App\Http\Controllers;

use App\Models\LessonPlan;
use App\Models\ClassRecordDocument;
use App\Services\LessonPlanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Handles ONLYOFFICE document editing integration.
 *
 * Endpoints:
 *   GET  /api/documents/{type}/{id}/editor    — return editor config JSON (JWT-signed)
 *   GET  /api/documents/{type}/{id}/content   — serve the raw DOCX/XLSX file
 *   POST /api/documents/onlyoffice/callback   — receive save callbacks from ONLYOFFICE
 */
class DocumentController extends Controller
{
    // Supported document types and their ONLYOFFICE documentType mappings
    private const TYPE_MAP = [
        'lesson-plan'  => ['model' => LessonPlan::class,           'ext' => 'docx', 'ooType' => 'word'],
        'class-record' => ['model' => ClassRecordDocument::class,  'ext' => 'xlsx', 'ooType' => 'cell'],
    ];

    // ── POST /api/documents/{type}/upload ────────────────────────────────────

    public function upload(Request $request, string $type): JsonResponse
    {
        [$model, $ext] = $this->resolveType($type);

        $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'file'  => ['required', 'file', 'mimetypes:application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip'],
        ]);

        $uploaded = $request->file('file');
        $title    = trim((string) ($request->input('title') ?: $uploaded->getClientOriginalName()));
        $title    = $title !== '' ? $title : ucfirst(str_replace(['-', '_'], ' ', $type));

        $pathKey = $type === 'class-record' ? 'xlsx_path' : 'docx_path';
        $doc = $model::create([
            'user_id' => Auth::id(),
            'title'   => $title,
            'xlsx_path' => $type === 'class-record' ? null : null,
            'docx_path' => $type === 'lesson-plan' ? null : null,
            'xlsx_version' => 1,
            'docx_version' => 1,
        ]);

        $storagePath = $type === 'class-record'
            ? 'documents/class-records/' . $doc->id . '.xlsx'
            : 'documents/lesson-plans/' . $doc->id . '.docx';

        $stored = $uploaded->storeAs(dirname($storagePath), basename($storagePath), 'local');
        if ($stored === false) {
            $doc->delete();
            return response()->json(['error' => 'Unable to save uploaded document.'], 500);
        }

        $doc->update([$pathKey => $storagePath]);

        return response()->json([
            'id'        => $doc->id,
            'type'      => $type,
            'title'     => $doc->title,
            'extension' => $ext,
            'path'      => $storagePath,
            'version'   => $type === 'class-record' ? ($doc->xlsx_version ?? 1) : ($doc->docx_version ?? 1),
        ], 201);
    }

    // ── GET /api/documents/{type}/{id}/editor ─────────────────────────────────

    public function editor(Request $request, string $type, int $id): JsonResponse
    {
        [$model, $ext, $ooType] = $this->resolveType($type);

        /** @var LessonPlan $doc */
        $doc = $model::findOrFail($id);
        $this->authorizeDoc($doc, $type);

        // For lesson plans: auto-generate DOCX if missing
        if ($type === 'lesson-plan' && (!$doc->docx_path || !Storage::disk('local')->exists($doc->docx_path))) {
            app(LessonPlanService::class)->saveDocxToDisk($doc);
            $doc->refresh();
        }

        // Determine the stored file path based on type
        $filePath = $type === 'class-record' ? $doc->xlsx_path : $doc->docx_path;

        if (!$filePath || !Storage::disk('local')->exists($filePath)) {
            return response()->json(['error' => 'Document file not found on server.'], 404);
        }

        // Read-only mode (admin review view); defaults to edit
        $mode     = $request->query('mode') === 'view' ? 'view' : 'edit';
        $appUrl    = $this->resolveOnlyOfficeAppUrl($request);
        $ooUrl     = rtrim(config('services.onlyoffice.url', 'http://localhost:8080'), '/');
        $jwtSecret = (string) config('services.onlyoffice.jwt_secret', '');

        $user    = Auth::user();
        $docKey  = $doc->docxKey();

        // ONLYOFFICE needs a URL it can reach (the Laravel content endpoint)
        $contentUrl  = $appUrl . '/api/documents/' . $type . '/' . $id . '/content';
        if ($jwtSecret !== '') {
            $contentToken = $this->signJwt([
                'type' => $type,
                'id'   => $id,
                'exp'  => time() + 3600,
            ], $jwtSecret);
            $contentUrl .= '?access_token=' . urlencode($contentToken);
        }
        $callbackUrl = $appUrl . '/api/documents/onlyoffice/callback?type=' . $type . '&id=' . $id;

        $config = [
            'document' => [
                'fileType' => $ext,
                'key'      => $docKey,
                'title'    => ($doc->title ?: 'Document') . '.' . $ext,
                'url'      => $contentUrl,
            ],
            'documentType' => $ooType,
            'editorConfig' => [
                'callbackUrl' => $callbackUrl,
                'mode'        => $mode,
                'lang'        => 'en',
                'user' => [
                    'id'   => (string) $user->id,
                    'name' => $user->name,
                ],
            ],
        ];

        // Sign with JWT if a secret is configured
        if ($jwtSecret !== '') {
            // ONLYOFFICE expects the JWT payload to match the config shape directly.
            $config['token'] = $this->signJwt($config, $jwtSecret);
        }

        return response()->json([
            'id'           => $id,
            'type'         => $type,
            'title'        => $doc->title,
            'extension'    => $ext,
            'documentType' => $ooType,
            'key'          => $docKey,
            'config'       => $config,
            'onlyofficeUrl'=> $ooUrl,
        ]);
    }

    // ── GET /api/documents/{type}/{id}/content ────────────────────────────────

    public function content(Request $request, string $type, int $id): Response
    {
        [$model, $ext] = $this->resolveType($type);

        /** @var LessonPlan $doc */
        $doc = $model::findOrFail($id);

        if (Auth::check()) {
            $this->authorizeDoc($doc, $type);
        } else {
            if (!$this->hasValidContentAccessToken($request, $type, $id)) {
                abort(403, 'Invalid content access token.');
            }
        }

        $filePath = $type === 'class-record' ? $doc->xlsx_path : $doc->docx_path;

        if (!$filePath || !Storage::disk('local')->exists($filePath)) {
            abort(404, 'Document file not found.');
        }

        $bytes    = Storage::disk('local')->get($filePath);
        $mimeType = $ext === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

        return response($bytes, 200, [
            'Content-Type'        => $mimeType,
            'Content-Disposition' => 'inline; filename="' . ($doc->title ?: 'document') . '.' . $ext . '"',
            'Content-Length'      => strlen($bytes),
        ]);
    }

    // ── POST /api/documents/onlyoffice/callback ───────────────────────────────

    /**
     * ONLYOFFICE callback statuses:
     *  0 - no document with the key identifier could be found
     *  1 - document is being edited
     *  2 - document is ready for saving
     *  3 - document saving error has occurred
     *  4 - document is closed with no changes
     *  6 - document is being edited, but the current document state is saved
     *  7 - error has occurred while force saving the document
     */
    public function callback(Request $request): JsonResponse
    {
        $type = $request->query('type', 'lesson-plan');
        $id   = (int) $request->query('id', 0);

        if (!$id) {
            return response()->json(['error' => 1], 400);
        }

        // Validate JWT if secret is configured
        $jwtSecret = (string) config('services.onlyoffice.jwt_secret', '');
        if ($jwtSecret !== '') {
            $authHeader = $request->header('Authorization', '');
            $token      = $request->input('token') ?: (
                str_starts_with($authHeader, 'Bearer ') ? substr($authHeader, 7) : $authHeader
            );

            if (!$token || !$this->verifyJwt($token, $jwtSecret)) {
                Log::warning('ONLYOFFICE callback JWT verification failed', [
                    'type' => $type, 'id' => $id,
                ]);
                return response()->json(['error' => 1]);
            }
        }

        $body   = $request->all();
        $status = (int) ($body['status'] ?? 0);

        // Status 2 = ready to save, status 6 = force-save
        if ($status === 2 || $status === 6) {
            $downloadUrl = $body['url'] ?? null;

            if (!$downloadUrl) {
                Log::error('ONLYOFFICE callback: no URL in status 2/6 payload', ['type' => $type, 'id' => $id]);
                return response()->json(['error' => 1]);
            }

            try {
                [$model, $ext] = $this->resolveType($type);
                /** @var LessonPlan|ClassRecordDocument $doc */
                $doc = $model::findOrFail($id);

                // Download the saved document from ONLYOFFICE
                $response = Http::timeout(30)->get($downloadUrl);
                if ($response->failed()) {
                    Log::error('ONLYOFFICE callback: failed to download updated document', ['type' => $type, 'id' => $id]);
                    return response()->json(['error' => 1]);
                }

                $pathKey = $type === 'class-record' ? 'xlsx_path' : 'docx_path';
                $verKey  = $type === 'class-record' ? 'xlsx_version' : 'docx_version';
                $path    = 'documents/' . ($type === 'class-record' ? 'class-records' : 'lesson-plans') . '/' . $id . '.' . $ext;

                Storage::disk('local')->put($path, $response->body());

                $updates = [
                    $pathKey => $path,
                    $verKey  => ($doc->$verKey ?? 1) + 1,
                ];
                // Note: lesson plan status is owned by the admin review workflow —
                // saving from ONLYOFFICE only bumps the document version.
                $doc->update($updates);

                Log::info('ONLYOFFICE callback: document saved', ['type' => $type, 'id' => $id]);
            } catch (\Throwable $e) {
                Log::error('ONLYOFFICE callback: exception during save', [
                    'type'  => $type,
                    'id'    => $id,
                    'error' => $e->getMessage(),
                ]);
                return response()->json(['error' => 1]);
            }
        }

        // ONLYOFFICE expects {"error": 0} on success
        return response()->json(['error' => 0]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function resolveType(string $type): array
    {
        if (!isset(self::TYPE_MAP[$type])) {
            abort(404, "Unknown document type: {$type}");
        }
        $m = self::TYPE_MAP[$type];
        return [$m['model'], $m['ext'], $m['ooType']];
    }

    private function authorizeDoc(mixed $doc, string $type = ''): void
    {
        // Admins may open any lesson plan document (review view)
        if ($type === 'lesson-plan' && $this->isAdminUser()) {
            return;
        }

        $ownerId = (int) ($doc->user_id ?? 0);
        $currentUserId = (int) (Auth::id() ?? 0);

        if ($ownerId === 0 || $ownerId !== $currentUserId) {
            abort(403, 'You do not have access to this document.');
        }
    }

    // Same admin rule as AdminLessonPlanController / FacultyController
    private function isAdminUser(): bool
    {
        $email = Str::lower((string) (Auth::user()->email ?? ''));
        return $email === 'admin@mentora.local';
    }

    /**
     * Sign a payload as a JWT (HS256).
     * Pure PHP — no external JWT package needed.
     */
    private function signJwt(array $payload, string $secret): string
    {
        $header  = $this->base64url(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $payload = $this->base64url(json_encode($payload));
        $sig     = $this->base64url(hash_hmac('sha256', $header . '.' . $payload, $secret, true));
        return $header . '.' . $payload . '.' . $sig;
    }

    private function verifyJwt(string $token, string $secret): bool
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) return false;
        [$header, $payload, $sig] = $parts;
        $expected = $this->base64url(hash_hmac('sha256', $header . '.' . $payload, $secret, true));
        return hash_equals($expected, $sig);
    }

    private function decodeJwtPayload(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            return null;
        }

        $decoded = base64_decode(strtr($parts[1], '-_', '+/'));
        if ($decoded === false) {
            return null;
        }

        $payload = json_decode($decoded, true);
        return is_array($payload) ? $payload : null;
    }

    private function hasValidContentAccessToken(Request $request, string $type, int $id): bool
    {
        $jwtSecret = (string) config('services.onlyoffice.jwt_secret', '');
        if ($jwtSecret === '') {
            return false;
        }

        $token = (string) $request->query('access_token', '');
        if ($token === '' || !$this->verifyJwt($token, $jwtSecret)) {
            return false;
        }

        $payload = $this->decodeJwtPayload($token);
        if (!$payload) {
            return false;
        }

        if (($payload['type'] ?? null) !== $type) {
            return false;
        }

        if ((int) ($payload['id'] ?? 0) !== $id) {
            return false;
        }

        $exp = (int) ($payload['exp'] ?? 0);
        if ($exp <= 0 || $exp < time()) {
            return false;
        }

        return true;
    }

    private function resolveOnlyOfficeAppUrl(Request $request): string
    {
        $raw = (string) config('services.onlyoffice.app_url', '');
        if ($raw === '') {
            $raw = (string) config('app.url', '');
        }
        if ($raw === '') {
            $raw = $request->getSchemeAndHttpHost();
        }

        $parts = parse_url($raw);
        if (!is_array($parts)) {
            return rtrim($request->getSchemeAndHttpHost(), '/');
        }

        $host = (string) ($parts['host'] ?? '');
        if ($host === 'localhost' || $host === '127.0.0.1') {
            $host = 'host.docker.internal';
        }

        $scheme = (string) ($parts['scheme'] ?? $request->getScheme());
        $port = isset($parts['port']) ? ':' . $parts['port'] : '';

        return rtrim($scheme . '://' . $host . $port, '/');
    }

    private function base64url(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}
