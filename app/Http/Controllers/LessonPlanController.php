<?php

namespace App\Http\Controllers;

use App\Models\LessonPlan;
use App\Services\LessonPlanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class LessonPlanController extends Controller
{
    public function __construct(protected LessonPlanService $service) {}

    // ── GET /api/lesson-plans ──────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $plans = LessonPlan::where('user_id', Auth::id())
            ->orderByDesc('updated_at')
            ->get([
                'id', 'title', 'grade_level', 'subject', 'topic',
                'duration', 'ai_model', 'status', 'created_at', 'updated_at',
            ]);

        return response()->json($plans);
    }

    // ── POST /api/lesson-plans/generate ───────────────────────────────────────

    public function generate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'grade_level'         => ['required', 'string', 'max:100'],
            'subject'             => ['required', 'string', 'max:100'],
            'topic'               => ['required', 'string', 'max:255'],
            'duration'            => ['nullable', 'string', 'max:100'],
            'learning_competency' => ['nullable', 'string', 'max:500'],
            'teaching_strategy'   => ['nullable', 'string', 'max:255'],
            'available_resources' => ['nullable', 'string', 'max:500'],
            'course_id'           => ['nullable', 'integer', 'exists:courses,id'],
        ]);

        try {
            $plan = $this->service->generate($data);
            return response()->json($plan, 201);
        } catch (\RuntimeException $e) {
            Log::error('Lesson plan generation failed', ['error' => $e->getMessage(), 'user' => Auth::id()]);
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    // ── GET /api/lesson-plans/{id} ────────────────────────────────────────────

    public function show(int $id): JsonResponse
    {
        $plan = LessonPlan::where('user_id', Auth::id())->findOrFail($id);
        return response()->json($plan);
    }

    // ── PUT /api/lesson-plans/{id} ────────────────────────────────────────────

    public function update(Request $request, int $id): JsonResponse
    {
        $plan = LessonPlan::where('user_id', Auth::id())->findOrFail($id);

        $data = $request->validate([
            'title'               => ['sometimes', 'string', 'max:255'],
            'grade_level'         => ['sometimes', 'string', 'max:100'],
            'subject'             => ['sometimes', 'string', 'max:100'],
            'topic'               => ['sometimes', 'string', 'max:255'],
            'duration'            => ['sometimes', 'string', 'max:100'],
            'learning_competency' => ['nullable', 'string', 'max:500'],
            'teaching_strategy'   => ['nullable', 'string', 'max:255'],
            'available_resources' => ['nullable', 'string', 'max:500'],
            'objectives'          => ['nullable', 'array'],
            'content'             => ['nullable', 'array'],
            'learning_resources'  => ['nullable', 'array'],
            'procedures'          => ['nullable', 'array'],
            'remarks'             => ['nullable', 'array'],
            'reflection'          => ['nullable', 'array'],
            'status'              => ['nullable', 'string', 'in:draft,approved,published'],
        ]);

        $plan->update($data);

        return response()->json($plan);
    }

    // ── DELETE /api/lesson-plans/{id} ─────────────────────────────────────────

    public function destroy(int $id): JsonResponse
    {
        $plan = LessonPlan::where('user_id', Auth::id())->findOrFail($id);
        $plan->delete();

        return response()->json(['success' => true]);
    }

    // ── GET /api/lesson-plans/{id}/export-docx ────────────────────────────────

    public function exportDocx(int $id)
    {
        $plan = LessonPlan::where('user_id', Auth::id())->findOrFail($id);
        $docx = $this->buildDocx($plan);

        $safeName = preg_replace('/[^A-Za-z0-9_\-]+/', '_', $plan->title ?: 'lesson_plan');
        return response()->download($docx, "{$safeName}.docx")->deleteFileAfterSend(true);
    }

    // ── DOCX builder ──────────────────────────────────────────────────────────

    /**
     * Build a plain Open XML .docx from the lesson plan data.
     * We construct the XML manually so we don't need an extra package.
     */
    private function buildDocx(LessonPlan $plan): string
    {
        $lines = [];

        $lines[] = strtoupper($plan->title ?: 'DAILY LESSON LOG');
        $lines[] = '';
        $lines[] = "Grade Level: {$plan->grade_level}    Subject: {$plan->subject}";
        $lines[] = "Topic: {$plan->topic}    Duration: {$plan->duration}";
        if ($plan->learning_competency) {
            $lines[] = "Learning Competency: {$plan->learning_competency}";
        }
        $lines[] = '';

        // Objectives
        $lines[] = 'I. OBJECTIVES';
        $obj = $plan->objectives ?? [];
        $this->appendList($lines, 'A. Knowledge',  $obj['knowledge'] ?? []);
        $this->appendList($lines, 'B. Skills',     $obj['skills']    ?? []);
        $this->appendList($lines, 'C. Attitude',   $obj['attitude']  ?? []);
        $lines[] = '';

        // Content / Subject Matter
        $lines[] = 'II. CONTENT';
        $content = $plan->content ?? [];
        $lines[] = 'Subject Matter: ' . ($content['subject_matter'] ?? '');
        $this->appendList($lines, 'References', $content['references'] ?? []);
        $this->appendList($lines, 'Other Learning Resources', $content['other_learning_resources'] ?? []);
        $lines[] = '';

        // Learning Resources
        $lines[] = 'III. LEARNING RESOURCES / MATERIALS';
        $this->appendList($lines, null, $plan->learning_resources ?? []);
        $lines[] = '';

        // Procedures
        $lines[] = 'IV. PROCEDURES';
        $proc = $plan->procedures ?? [];
        $procLabels = [
            'reviewing_past_lesson'   => 'A. Reviewing Previous Lesson / Presenting New Lesson',
            'establishing_purpose'    => 'B. Establishing Purpose for the Lesson',
            'presenting_examples'     => 'C. Presenting Examples / Instances of New Lesson',
            'discussing_concepts'     => 'D. Discussing New Concepts and Practising New Skills',
            'developing_mastery'      => 'E. Developing Mastery (Leads to Formative Assessment)',
            'finding_applications'    => 'F. Finding Practical Applications of Concepts and Skills',
            'making_generalizations'  => 'G. Making Generalizations and Abstractions about the Lesson',
            'evaluating_learning'     => 'H. Evaluating Learning',
            'additional_activities'   => 'I. Additional Activities for Application or Remediation',
        ];
        foreach ($procLabels as $key => $label) {
            if (!empty($proc[$key])) {
                $lines[] = $label;
                $lines[] = $proc[$key];
                $lines[] = '';
            }
        }

        // Remarks
        $lines[] = 'V. REMARKS';
        $rem = $plan->remarks ?? [];
        if (is_array($rem) && !empty(array_filter($rem))) {
            foreach ($rem as $k => $v) {
                if ($v) $lines[] = ucwords(str_replace('_', ' ', $k)) . ': ' . $v;
            }
        }
        $lines[] = '';

        // Reflection
        $lines[] = 'VI. REFLECTION';
        $ref = $plan->reflection ?? [];
        if (is_array($ref) && !empty(array_filter($ref))) {
            foreach ($ref as $k => $v) {
                if ($v) $lines[] = ucwords(str_replace('_', ' ', $k)) . ': ' . $v;
            }
        }
        $lines[] = '';
        $lines[] = "Generated by Mentora AI · Model: {$plan->ai_model} · " . now()->format('F j, Y');

        return $this->createDocxFile($lines, $plan->title ?: 'Daily Lesson Log');
    }

    private function appendList(array &$lines, ?string $heading, array $items): void
    {
        if ($heading) {
            $lines[] = $heading . ':';
        }
        foreach ($items as $item) {
            $lines[] = '  • ' . $item;
        }
    }

    /**
     * Build a minimal but valid Office Open XML .docx file.
     * Uses a pure-PHP ZIP writer — no ZipArchive extension required.
     */
    private function createDocxFile(array $lines, string $docTitle): string
    {
        $bodyXml = '';
        foreach ($lines as $line) {
            $text   = htmlspecialchars((string) $line, ENT_XML1, 'UTF-8');
            $isBold = preg_match('/^[IVX]+\.\s/', $line) || preg_match('/^[A-Z][A-Z\s]+$/', trim($line));
            $rPr    = $isBold ? '<w:rPr><w:b/><w:sz w:val="22"/></w:rPr>' : '<w:rPr><w:sz w:val="22"/></w:rPr>';
            $bodyXml .= "<w:p><w:pPr><w:spacing w:after=\"80\"/></w:pPr>"
                      . "<w:r>{$rPr}<w:t xml:space=\"preserve\">{$text}</w:t></w:r></w:p>\n";
        }

        $documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            . '<w:body>' . $bodyXml . '</w:body></w:document>';

        $contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            . '<Default Extension="xml"  ContentType="application/xml"/>'
            . '<Override PartName="/word/document.xml"'
            . ' ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            . '</Types>';

        $relsRoot = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1"'
            . ' Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"'
            . ' Target="word/document.xml"/>'
            . '</Relationships>';

        $relsWord = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '</Relationships>';

        // Build ZIP in memory using pure PHP
        $files = [
            '[Content_Types].xml'         => $contentTypes,
            '_rels/.rels'                 => $relsRoot,
            'word/document.xml'           => $documentXml,
            'word/_rels/document.xml.rels'=> $relsWord,
        ];

        $zipData = $this->buildZip($files);

        $tempFile = tempnam(sys_get_temp_dir(), 'dll_') . '.docx';
        file_put_contents($tempFile, $zipData);

        return $tempFile;
    }

    /**
     * Pure-PHP ZIP builder (no extensions).
     * Produces a valid ZIP 2.0 archive with stored (no compression) entries.
     *
     * @param  array<string,string> $files  path => content
     */
    private function buildZip(array $files): string
    {
        $centralDir = '';
        $localFiles = '';
        $offset     = 0;

        foreach ($files as $name => $content) {
            $nameBytes = $name;
            $nameLen   = strlen($nameBytes);
            $dataLen   = strlen($content);
            $crc       = crc32($content);

            // Local file header  (30 bytes + name)
            // Signature(V) version(v) flags(v) method(v) modtime(v) moddate(v) crc(V) csize(V) usize(V) namelen(v) extralen(v)
            $dosTime = $this->dosDateTime();   // [time, date] as two 16-bit words
            $localHeader = pack('VvvvvvVVVvv',
                0x04034b50,      // local file header signature
                20,              // version needed to extract
                0,               // general purpose bit flag
                0,               // compression method: stored
                $dosTime[0],     // last mod file time
                $dosTime[1],     // last mod file date
                $crc,
                $dataLen,        // compressed size
                $dataLen,        // uncompressed size
                $nameLen,
                0                // extra field length
            ) . $nameBytes;

            $localFiles .= $localHeader . $content;

            // Central directory file header (46 bytes + name)
            // sig(V) vermade(v) verneeded(v) flags(v) method(v) modtime(v) moddate(v) crc(V) csize(V) usize(V) namelen(v) extralen(v) commentlen(v) diskstart(v) intattr(v) extattr(V) offset(V)
            $centralDir .= pack('VvvvvvvVVVvvvvvVV',
                0x02014b50,      // central file header signature
                20,              // version made by
                20,              // version needed
                0,               // general purpose bit flag
                0,               // compression: stored
                $dosTime[0],     // last mod file time
                $dosTime[1],     // last mod file date
                $crc,
                $dataLen,        // compressed size
                $dataLen,        // uncompressed size
                $nameLen,
                0,               // extra field length
                0,               // file comment length
                0,               // disk number start
                0,               // internal file attributes
                0,               // external file attributes
                $offset          // relative offset of local header
            ) . $nameBytes;

            $offset += strlen($localHeader) + $dataLen;
        }

        $cdSize    = strlen($centralDir);
        $numFiles  = count($files);

        // End of central directory record (22 bytes)
        // sig(V) disknum(v) diskwithcd(v) entriesondisk(v) totalentries(v) cdsize(V) cdoffset(V) commentlen(v)
        $eocd = pack('VvvvvVVv',
            0x06054b50,  // end of central dir signature
            0,           // number of this disk
            0,           // disk with start of central dir
            $numFiles,   // entries on this disk
            $numFiles,   // total entries in central dir
            $cdSize,     // size of central dir
            $offset,     // offset of central dir
            0            // comment length
        );

        return $localFiles . $centralDir . $eocd;
    }

    /** Returns DOS-format [time, date] as two unsigned 16-bit integers. */
    private function dosDateTime(): array
    {
        $t    = getdate();
        $time = (($t['hours']   & 0x1f) << 11)
              | (($t['minutes'] & 0x3f) << 5)
              | (($t['seconds'] >> 1)   & 0x1f);
        $date = ((($t['year'] - 1980) & 0x7f) << 9)
              | (($t['mon']  & 0x0f) << 5)
              |  ($t['mday'] & 0x1f);
        return [$time & 0xffff, $date & 0xffff];
    }
}
