<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Chat;
use App\Models\Conversation;
use App\Models\Material;
use App\Models\Course;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class ChatController extends Controller
{
    /**
     * Send a message to the configured AI provider and return the response.
     * If no conversation_id is provided, a new conversation is created.
     */
    public function send(Request $request)
    {
        $request->validate([
            'message'         => 'required|string|max:5000',
            'conversation_id' => 'nullable|integer|exists:conversations,id',
            'course_id'       => 'nullable|integer|exists:courses,id',
        ]);

        if (function_exists('set_time_limit')) {
            $executionTime = intval(env('AI_EXECUTION_TIME', env('LOCAL_AI_EXECUTION_TIME', 300)));
            @set_time_limit($executionTime);
            @ini_set('max_execution_time', $executionTime);
        }

        $userMessage    = $request->input('message');
        $conversationId = $request->input('conversation_id');
        $courseId        = $request->input('course_id');

        // Create or fetch the conversation
        if ($conversationId) {
            $conversation = Conversation::where('id', $conversationId)
                ->where('user_id', Auth::id())
                ->firstOrFail();
        } else {
            // Auto-generate a title from the first ~50 chars of the message
            $title = mb_strlen($userMessage) > 50
                ? mb_substr($userMessage, 0, 50) . '...'
                : $userMessage;

            $conversation = Conversation::create([
                'user_id' => Auth::id(),
                'title'   => $title,
            ]);
        }

        // Build conversation context from recent messages in THIS conversation
        $recentChats = Chat::where('conversation_id', $conversation->id)
            ->orderBy('created_at', 'desc')
            ->take(10)
            ->get()
            ->reverse();

        $conversationContext = '';
        foreach ($recentChats as $chat) {
            $conversationContext .= "User: {$chat->message}\nAssistant: {$chat->response}\n\n";
        }

        $preferAllMaterials = $this->isMaterialGroundedTask($userMessage);

        $isQuizRequest = (bool) preg_match('/\b(quiz|question|questions|test|exam)\b/i', $userMessage);
        $requestedCount = null;
        if (preg_match('/\b(\d{1,3})\b/', $userMessage, $m)) {
            $requestedCount = intval($m[1]);
        } elseif (preg_match('/\bten\b/i', $userMessage)) {
            $requestedCount = 10;
        }

        // ── RAG: Retrieve relevant materials ──────────────────────────────
        $ragResult   = $this->retrieveRelevantMaterials($userMessage, $courseId, $preferAllMaterials);
        $ragContext   = $ragResult['context'];
        $ragSources   = $ragResult['sources'];

        $systemPrompt = "You are Mentora, a helpful AI teaching assistant for college educators. "
            . "You help with lesson planning, quiz generation, grading assistance, assignment creation, "
            . "and answering questions about course materials. Be concise, helpful, and professional.\n\n"
            . "FORMATTING RULES (you MUST follow these):\n"
            . "- Always use Markdown formatting in every response.\n"
            . "- Use ## headings to separate major sections.\n"
            . "- Use ### sub-headings for sub-sections.\n"
            . "- Use **bold** for key terms and important concepts.\n"
            . "- Use bullet points (-) or numbered lists (1. 2. 3.) to organize information.\n"
            . "- Add blank lines between sections for readability.\n"
            . "- Use > blockquotes for definitions or important notes.\n"
            . "- Use code blocks with ``` for any code, commands, or configuration examples.\n"
            . "- NEVER output a wall of text in a single paragraph. Always break content into structured sections.\n"
            . "- For study guides, quizzes, and lesson plans, use clear sections with headings, lists, and separators.\n"
            . "- Do NOT paste long excerpts from the COURSE MATERIALS. Never quote more than 1-2 short lines; summarize instead.";


        if ($ragContext) {
            $systemPrompt .= "\n\nIMPORTANT: Below are relevant excerpts from the instructor's uploaded course materials. "
                . "Use these as your PRIMARY source of information when answering. "
                . "Ground your responses in this material. If the question cannot be answered from the materials, "
                . "say so and provide general knowledge as a supplement.\n\n"
                . "=== COURSE MATERIALS ===\n" . $ragContext . "\n=== END MATERIALS ===";
        }

        if ($preferAllMaterials && $ragContext) {
            $systemPrompt .= "\n\nTASK-SPECIFIC RULES:\n"
                . "- The user is asking for work based on already-loaded course materials. Do NOT ask them to provide the materials again.\n"
                . "- If the request is to generate a quiz, questions, study guide, or lesson content, generate it directly from the provided materials.\n"
                . "- When the materials are broad, cover the major topics represented in the sources instead of asking clarifying questions first.\n"
                . "- Mention any assumptions briefly only if the materials are incomplete.";

            if ($isQuizRequest) {
                $n = $requestedCount && $requestedCount > 0 ? $requestedCount : 10;
                $systemPrompt .= "\n\nQUIZ OUTPUT FORMAT:\n"
                    . "- Start with exactly: 'Based on the uploaded materials, here are {$n} questions:'\n"
                    . "- Then output exactly {$n} questions as a numbered list (1. ...).\n"
                    . "- Do not include the course material text, previews, or extra sections after the list.";
            }
        }

        $prompt = $systemPrompt . "\n\n";
        if ($conversationContext) {
            $prompt .= "Previous conversation:\n" . $conversationContext;
        }
        $prompt .= "User: " . $userMessage . "\nAssistant:";

        $provider = mb_strtolower((string) env('AI_PROVIDER', 'openrouter'));
        $timeout = intval(env('AI_TIMEOUT', env('LOCAL_AI_TIMEOUT', 120)));
        $retries = intval(env('AI_RETRIES', env('LOCAL_AI_RETRIES', 2)));

        $headers = [];

        if ($provider === 'openrouter') {
            $baseUrl = rtrim((string) config('services.openrouter.base_url', 'https://openrouter.ai/api/v1'), '/');
            $url = $baseUrl . '/chat/completions';
            $apiKey = (string) config('services.openrouter.api_key', '');

            if ($apiKey === '') {
                return response()->json([
                    'response' => 'AI provider is not configured. Set OPENROUTER_API_KEY on the server.',
                    'conversation_id' => $conversation->id,
                ], 200);
            }

            $headers = [
                'Authorization' => 'Bearer ' . $apiKey,
                'HTTP-Referer' => (string) config('services.openrouter.site_url', config('app.url')),
                'X-Title' => (string) config('services.openrouter.app_name', config('app.name', 'Mentora')),
            ];

            $userPrompt = $conversationContext
                ? "Previous conversation:\n" . $conversationContext . "User: " . $userMessage
                : $userMessage;

            $payload = [
                'model' => (string) config('services.openrouter.model', 'google/gemma-3-12b-it:free'),
                'messages' => [
                    ['role' => 'system', 'content' => $systemPrompt],
                    ['role' => 'user', 'content' => $userPrompt],
                ],
                'temperature' => 0.7,
                'max_tokens' => 2048,
            ];
        } else {
            $baseUrl = rtrim(env('LOCAL_AI_URL', 'http://localhost:11434'), '/');
            $model = env('LOCAL_AI_MODEL', 'llama3:8b-instruct-q4_0');
            $url = $baseUrl . '/api/generate';

            $payload = [
                'model' => $model,
                'prompt' => $prompt,
                'stream' => false,
                'options' => [
                    'temperature' => 0.7,
                    'num_predict' => 2048,
                ],
            ];
        }

        $attempt = 0;
        $resp    = null;
        $err     = null;

        while ($attempt <= $retries) {
            $attempt++;
            try {
                $request = Http::timeout($timeout);
                if (!empty($headers)) {
                    $request = $request->withHeaders($headers);
                }

                $resp = $request->post($url, $payload);
                if (!$resp->failed()) {
                    break;
                }
            } catch (\Exception $e) {
                $err = $e->getMessage();
            }
            if ($attempt <= $retries) {
                sleep($attempt * 2);
            }
        }

        if (!$resp || $resp->failed()) {
            $msg = $err ?? ($resp ? 'HTTP ' . $resp->status() : 'no response');
            if (!$err && $resp) {
                $bodySnippet = trim(mb_substr((string) $resp->body(), 0, 200));
                if ($bodySnippet !== '') {
                    $msg .= ' - ' . $bodySnippet;
                }
            }
            return response()->json([
                'response'        => 'Sorry, I could not connect to the AI provider (' . $provider . '). Error: ' . $msg,
                'conversation_id' => $conversation->id,
            ], 200);
        }

        $responseText = $this->extractResponse($resp);

        // Save to database
        Chat::create([
            'user_id'         => Auth::id(),
            'conversation_id' => $conversation->id,
            'course_id'       => $courseId,
            'message'         => $userMessage,
            'response'        => $responseText,
        ]);

        // Touch conversation so updated_at reflects last activity
        $conversation->touch();

        return response()->json([
            'response'        => $responseText,
            'conversation_id' => $conversation->id,
            'sources'         => $ragSources,
        ]);
    }

    /**
     * List all conversations for the authenticated user (most recent first).
     */
    public function conversations(Request $request)
    {
        $conversations = Conversation::where('user_id', Auth::id())
            ->withCount('chats')
            ->orderBy('updated_at', 'desc')
            ->take(30)
            ->get()
            ->map(function ($c) {
                return [
                    'id'         => $c->id,
                    'title'      => $c->title,
                    'chat_count' => $c->chats_count,
                    'updated_at' => $c->updated_at->toISOString(),
                    'created_at' => $c->created_at->toISOString(),
                ];
            });

        return response()->json($conversations);
    }

    /**
     * Get all messages for a specific conversation.
     */
    public function history(Request $request, $conversationId = null)
    {
        if ($conversationId) {
            $conversation = Conversation::where('id', $conversationId)
                ->where('user_id', Auth::id())
                ->firstOrFail();

            $chats = Chat::where('conversation_id', $conversation->id)
                ->orderBy('created_at', 'asc')
                ->get();
        } else {
            $chats = Chat::where('user_id', Auth::id())
                ->whereNull('conversation_id')
                ->orderBy('created_at', 'asc')
                ->take(50)
                ->get();
        }

        return response()->json($chats);
    }

    /**
     * Delete a conversation and all its messages.
     */
    public function deleteConversation($conversationId)
    {
        $conversation = Conversation::where('id', $conversationId)
            ->where('user_id', Auth::id())
            ->firstOrFail();

        $conversation->delete();

        return response()->json(['success' => true]);
    }

    /**
     * Export selected chat content as a DOCX file.
     */
    public function exportDocx(Request $request)
    {
        $data = $request->validate([
            'content' => ['required', 'string', 'max:200000'],
            'title' => ['nullable', 'string', 'max:255'],
        ]);

        $title = trim((string) ($data['title'] ?? 'Generated Questions'));
        if ($title === '') {
            $title = 'Generated Questions';
        }

        $lines = [];
        $contentLines = preg_split('/\r?\n/', (string) $data['content']);
        foreach ($contentLines as $line) {
            $lines[] = rtrim($line);
        }

        $tempFile = $this->createDocxFromLines($lines);

        $safeTitle = preg_replace('/[^A-Za-z0-9_-]+/', '_', $title);
        $safeTitle = trim((string) $safeTitle, '_');
        if ($safeTitle === '') {
            $safeTitle = 'generated_questions';
        }

        $fileName = $safeTitle . '.docx';

        return response()->download($tempFile, $fileName)->deleteFileAfterSend(true);
    }

    /**
     * Retrieve relevant material chunks using keyword-based scoring (RAG).
     * Returns the concatenated context string and an array of source metadata.
     */
    private function retrieveRelevantMaterials(string $query, ?int $courseId = null, bool $preferAllMaterials = false): array
    {
        $userId = Auth::id();

        // Get all materials for the user's courses (optionally filtered by course).
        // Use extracted text when available, but fall back to title/description metadata
        // so Google Classroom links and other non-file materials can still ground responses.
        $materialsQuery = Material::whereHas('course', function ($q) use ($userId) {
            $q->where('user_id', $userId);
        })->where(function ($q) {
            $q->whereNotNull('extracted_text')->where('extracted_text', '!=', '')
              ->orWhereNotNull('description')->where('description', '!=', '')
              ->orWhereNotNull('title')->where('title', '!=', '');
        });

        if ($courseId) {
            $materialsQuery->where('course_id', $courseId);
        }

        $materials = $materialsQuery->with('course:id,course_code,course_name')->get();

        if ($materials->isEmpty()) {
            return ['context' => '', 'sources' => []];
        }

        // ── Keyword extraction ──────────────────────────────────────────
        // Remove common stop words and extract meaningful terms
        $stopWords = ['the','a','an','is','are','was','were','be','been','being',
            'have','has','had','do','does','did','will','would','shall','should',
            'may','might','must','can','could','i','me','my','we','our','you',
            'your','he','she','it','they','them','their','this','that','these',
            'those','am','or','and','but','if','of','at','by','for','with',
            'about','to','from','in','on','up','out','not','so','what','which',
            'who','when','where','how','all','each','some','any','no','than',
            'too','very','just','also','into','over','after','before','between',
            'under','again','then','here','there','why','own','same','other',
            'make','create','generate','help','please','based','using','give',
            'tell','explain','describe','provide','show','write','list'];

        $queryLower = mb_strtolower($query);
        $words = preg_split('/[\s,.\;:!?\(\)\[\]\{\}"\'\/\\\\\-]+/', $queryLower, -1, PREG_SPLIT_NO_EMPTY);
        $keywords = array_values(array_filter($words, function ($w) use ($stopWords) {
            return mb_strlen($w) > 2 && !in_array($w, $stopWords);
        }));

        if (empty($keywords)) {
            // Fall back to first few words if all got filtered
            $keywords = array_slice($words, 0, 3);
        }

        // ── Score each material by keyword relevance ────────────────────
        $scored = [];
        foreach ($materials as $material) {
            $searchText = $this->buildMaterialSearchText($material);
            $textLower = mb_strtolower($searchText);
            $titleLower = mb_strtolower($material->title ?? '');
            $score = 0;
            $matchedKeywords = [];

            foreach ($keywords as $kw) {
                // Count occurrences in text (weighted)
                $textHits  = mb_substr_count($textLower, $kw);
                $titleHits = mb_substr_count($titleLower, $kw);

                if ($textHits > 0 || $titleHits > 0) {
                    // Title matches worth more; text matches have diminishing returns
                    $score += ($titleHits * 10) + min($textHits, 20);
                    $matchedKeywords[] = $kw;
                }
            }

            if ($score > 0) {
                $scored[] = [
                    'material'  => $material,
                    'score'     => $score,
                    'keywords'  => array_unique($matchedKeywords),
                ];
            }
        }

        if (empty($scored)) {
            foreach ($materials as $material) {
                $scored[] = [
                    'material'  => $material,
                    'score'     => 1,
                    'keywords'  => [],
                ];
            }
        }

        // For quiz/study-guide style requests, prefer broader course coverage over narrow matches.
        if ($preferAllMaterials) {
            $seenMaterialIds = [];
            foreach ($materials as $material) {
                if (isset($seenMaterialIds[$material->id])) {
                    continue;
                }
                $seenMaterialIds[$material->id] = true;

                $existingIndex = null;
                foreach ($scored as $index => $item) {
                    if ($item['material']->id === $material->id) {
                        $existingIndex = $index;
                        break;
                    }
                }

                if ($existingIndex === null) {
                    $scored[] = [
                        'material' => $material,
                        'score'    => 1,
                        'keywords' => [],
                    ];
                }
            }
        }

        // Sort by score descending
        usort($scored, fn($a, $b) => $b['score'] <=> $a['score']);

        // ── Build context string from top materials ─────────────────────
        $maxContextChars = $preferAllMaterials ? 9000 : 6000;
        $usedChars       = 0;
        $contextParts    = [];
        $sources         = [];
        $maxSources      = $preferAllMaterials ? 5 : 3;

        foreach ($scored as $item) {
            $mat  = $item['material'];
            $text = $this->buildMaterialSearchText($mat);

            // Extract the most relevant chunk around keyword matches
            $chunk = $this->extractRelevantChunk($text, $keywords, 1500);

            $remaining = $maxContextChars - $usedChars;
            if ($remaining <= 200) break;

            if (mb_strlen($chunk) > $remaining) {
                $chunk = mb_substr($chunk, 0, $remaining) . '...';
            }

            $courseLabel = $mat->course
                ? "{$mat->course->course_code} - {$mat->course->course_name}"
                : 'Unknown Course';

            $contextParts[] = "[Source: {$mat->title} | Course: {$courseLabel}]\n{$chunk}";
            $usedChars += mb_strlen($chunk) + 100;

            $sources[] = [
                'id'     => $mat->id,
                'title'  => $mat->title,
                'course' => $courseLabel,
                'score'  => $item['score'],
                'has_text' => !empty($mat->extracted_text),
            ];

            if (count($sources) >= $maxSources) break;
        }

        Log::debug('RAG retrieval', [
            'query'    => $query,
            'keywords' => $keywords,
            'sources'  => count($sources),
            'chars'    => $usedChars,
        ]);

        return [
            'context' => implode("\n\n---\n\n", $contextParts),
            'sources' => $sources,
        ];
    }

    /**
     * Extract the most relevant chunk from a document around keyword matches.
     */
    private function extractRelevantChunk(string $text, array $keywords, int $maxLength = 1500): string
    {
        if (mb_strlen($text) <= $maxLength) {
            return $text;
        }

        if (empty($keywords)) {
            return trim(mb_substr($text, 0, $maxLength));
        }

        // Find the best position — the area with the most keyword density
        $textLower = mb_strtolower($text);
        $bestPos   = 0;
        $bestScore = 0;
        $windowSize = $maxLength;
        $step       = 200;

        for ($pos = 0; $pos < mb_strlen($text) - $windowSize; $pos += $step) {
            $window = mb_substr($textLower, $pos, $windowSize);
            $score  = 0;
            foreach ($keywords as $kw) {
                $score += mb_substr_count($window, $kw);
            }
            if ($score > $bestScore) {
                $bestScore = $score;
                $bestPos   = $pos;
            }
        }

        // Extract the chunk, trying to start/end at sentence boundaries
        $start = max(0, $bestPos);
        $chunk = mb_substr($text, $start, $windowSize);

        // Trim to sentence boundary at start
        if ($start > 0) {
            $firstPeriod = mb_strpos($chunk, '. ');
            if ($firstPeriod !== false && $firstPeriod < 100) {
                $chunk = mb_substr($chunk, $firstPeriod + 2);
            }
        }

        // Trim to sentence boundary at end
        $lastPeriod = mb_strrpos($chunk, '. ');
        if ($lastPeriod !== false && $lastPeriod > mb_strlen($chunk) - 100) {
            // already near the end, keep it
        } elseif ($lastPeriod !== false && $lastPeriod > mb_strlen($chunk) * 0.7) {
            $chunk = mb_substr($chunk, 0, $lastPeriod + 1);
        }

        return trim($chunk);
    }

    private function buildMaterialSearchText($material): string
    {
        $parts = [];

        if (!empty($material->title)) {
            $parts[] = 'Title: ' . $material->title;
        }

        if (!empty($material->description)) {
            $parts[] = 'Description: ' . $material->description;
        }

        if (!empty($material->material_type)) {
            $parts[] = 'Material Type: ' . $material->material_type;
        }

        if (!empty($material->extracted_text)) {
            $parts[] = 'Content: ' . $material->extracted_text;
        }

        if (!empty($material->link)) {
            $parts[] = 'Reference Link: ' . $material->link;
        }

        return trim(implode("\n", $parts));
    }

    private function isMaterialGroundedTask(string $query): bool
    {
        $query = mb_strtolower($query);
        $phrases = [
            'loaded material',
            'available material',
            'uploaded material',
            'course material',
            'based on the material',
            'based on my material',
            'generate quiz',
            'create quiz',
            'quiz questions',
            'study guide',
            'lesson plan',
            'summarize',
        ];

        foreach ($phrases as $phrase) {
            if (str_contains($query, $phrase)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Extract the response text from provider HTTP responses.
     */
    private function extractResponse($resp): string
    {
        $raw  = (string) $resp->body();
        $body = null;

        try {
            $body = $resp->json();
        } catch (\Exception $e) {
            $body = null;
        }

        if (is_array($body) && isset($body['response'])) {
            return trim($body['response']);
        }

        if (is_array($body) && isset($body['choices'][0]['message']['content'])) {
            return trim($body['choices'][0]['message']['content']);
        }

        if ($raw) {
            $collected = '';
            $lines = preg_split('/\r?\n/', $raw);
            foreach ($lines as $line) {
                $line = trim($line);
                if ($line === '') continue;
                $decoded = json_decode($line, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                    if (isset($decoded['response'])) {
                        $collected .= $decoded['response'];
                        continue;
                    }
                    if (isset($decoded['text'])) {
                        $collected .= $decoded['text'];
                        continue;
                    }
                    if (isset($decoded['content'])) {
                        $collected .= is_string($decoded['content']) ? $decoded['content'] : json_encode($decoded['content']);
                        continue;
                    }
                }
            }
            $collected = trim($collected);
            if ($collected !== '') {
                return $collected;
            }
        }

        return $raw ?: 'No response received from AI model.';
    }

    private function createDocxFromLines(array $lines): string
    {
        if (!class_exists('ZipArchive')) {
            abort(500, 'DOCX export requires ZipArchive extension.');
        }

        $zip = new \ZipArchive();
        $tmpPath = tempnam(sys_get_temp_dir(), 'chat_docx_');
        if ($tmpPath === false) {
            abort(500, 'Unable to create temporary export file.');
        }

        $docxPath = $tmpPath . '.docx';
        @unlink($docxPath);

        $opened = $zip->open($docxPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE);
        if ($opened !== true) {
            @unlink($tmpPath);
            abort(500, 'Unable to initialize DOCX export.');
        }

        $paragraphs = [];
        foreach ($lines as $line) {
            $chunks = preg_split('/\r?\n/', (string) $line);
            foreach ($chunks as $chunk) {
                $text = htmlspecialchars($chunk, ENT_XML1 | ENT_COMPAT, 'UTF-8');
                if ($text === '') {
                    $paragraphs[] = '<w:p/>';
                } else {
                    $paragraphs[] = '<w:p><w:r><w:t xml:space="preserve">' . $text . '</w:t></w:r></w:p>';
                }
            }
        }

        $documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"'
            . ' xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"'
            . ' xmlns:o="urn:schemas-microsoft-com:office:office"'
            . ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
            . ' xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"'
            . ' xmlns:v="urn:schemas-microsoft-com:vml"'
            . ' xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"'
            . ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"'
            . ' xmlns:w10="urn:schemas-microsoft-com:office:word"'
            . ' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
            . ' xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"'
            . ' xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"'
            . ' xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"'
            . ' xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"'
            . ' xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14">'
            . '<w:body>'
            . implode('', $paragraphs)
            . '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>'
            . '</w:body></w:document>';

        $contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            . '<Default Extension="xml" ContentType="application/xml"/>'
            . '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            . '</Types>';

        $rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            . '</Relationships>';

        $zip->addFromString('[Content_Types].xml', $contentTypes);
        $zip->addFromString('_rels/.rels', $rels);
        $zip->addFromString('word/document.xml', $documentXml);
        $zip->close();

        @unlink($tmpPath);

        return $docxPath;
    }
}
