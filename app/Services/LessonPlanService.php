<?php

namespace App\Services;

use App\Models\LessonPlan;
use App\Models\Material;
use App\Services\AI\LLMService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

/**
 * Orchestrates lesson-plan generation.
 *
 * Flow:
 *   1. Retrieve relevant uploaded materials (RAG, same approach as ChatController)
 *   2. Build a structured system prompt for the DLL format
 *   3. Call LLMService → get structured JSON back
 *   4. Validate / normalise the JSON
 *   5. Persist a LessonPlan record
 *   6. Return the record
 */
class LessonPlanService
{
    public function __construct(protected LLMService $llm) {}

    /**
     * Generate a Daily Lesson Log and persist it.
     *
     * @param  array{
     *   grade_level: string,
     *   subject: string,
     *   topic: string,
     *   duration: string,
     *   learning_competency: ?string,
     *   teaching_strategy: ?string,
     *   available_resources: ?string,
     *   course_id: ?int,
     * } $input
     */
    public function generate(array $input): LessonPlan
    {
        $ragContext = $this->retrieveContext($input);

        $systemPrompt = $this->buildSystemPrompt($input, $ragContext);
        $userMessage  = $this->buildUserMessage($input);

        $result = $this->llm->complete($systemPrompt, $userMessage, 'lesson_plan');

        $structured = $this->parseStructuredJson($result['text']);

        return LessonPlan::create([
            'user_id'             => Auth::id(),
            'course_id'           => $input['course_id'] ?? null,
            'title'               => $structured['title']               ?? "DLL: {$input['topic']}",
            'grade_level'         => $input['grade_level'],
            'subject'             => $input['subject'],
            'topic'               => $input['topic'],
            'duration'            => $input['duration'] ?? '60 minutes',
            'learning_competency' => $input['learning_competency'] ?? null,
            'teaching_strategy'   => $input['teaching_strategy']   ?? null,
            'available_resources' => $input['available_resources'] ?? null,
            'objectives'          => $structured['objectives']          ?? [],
            'content'             => $structured['content']             ?? [],
            'learning_resources'  => $structured['learning_resources']  ?? [],
            'procedures'          => $structured['procedures']          ?? [],
            'remarks'             => $structured['remarks']             ?? [],
            'reflection'          => $structured['reflection']          ?? [],
            'raw_ai_output'       => $result['text'],
            'ai_model'            => $result['model'],
            'status'              => 'draft',
        ]);
    }

    // ── Private helpers ─────────────────────────────────────────────────────

    /**
     * Retrieve relevant course material snippets via keyword scoring (RAG).
     */
    private function retrieveContext(array $input): string
    {
        $userId   = Auth::id();
        $courseId = $input['course_id'] ?? null;
        $query    = implode(' ', array_filter([
            $input['subject']             ?? '',
            $input['topic']               ?? '',
            $input['learning_competency'] ?? '',
        ]));

        $q = Material::whereHas('course', fn($q) => $q->where('user_id', $userId))
            ->where(function ($q) {
                $q->whereNotNull('extracted_text')->where('extracted_text', '!=', '')
                  ->orWhereNotNull('description')->where('description', '!=', '');
            });

        if ($courseId) {
            $q->where('course_id', $courseId);
        }

        $materials = $q->get();

        if ($materials->isEmpty()) {
            return '';
        }

        $keywords = $this->extractKeywords($query);

        $scored = $materials->map(function ($mat) use ($keywords) {
            $text  = mb_strtolower(($mat->extracted_text ?? '') . ' ' . ($mat->title ?? '') . ' ' . ($mat->description ?? ''));
            $score = array_reduce($keywords, fn($s, $kw) => $s + mb_substr_count($text, $kw), 0);
            return ['mat' => $mat, 'score' => $score];
        })->sortByDesc('score')->take(3);

        $parts = [];
        $used  = 0;
        foreach ($scored as $item) {
            if ($used > 4000) break;
            $mat   = $item['mat'];
            $chunk = mb_substr($mat->extracted_text ?? $mat->description ?? '', 0, 1500);
            if (!$chunk) continue;
            $parts[] = "[{$mat->title}]\n{$chunk}";
            $used   += mb_strlen($chunk);
        }

        return implode("\n\n---\n\n", $parts);
    }

    private function extractKeywords(string $text): array
    {
        $stopWords = ['the','a','an','is','are','and','or','of','in','on','for','to','at','by'];
        $words     = preg_split('/\W+/u', mb_strtolower($text), -1, PREG_SPLIT_NO_EMPTY);
        return array_values(array_filter($words, fn($w) => mb_strlen($w) > 3 && !in_array($w, $stopWords)));
    }

    private function buildSystemPrompt(array $input, string $ragContext): string
    {
        $prompt = <<<'PROMPT'
You are an expert Filipino curriculum developer trained in DepEd's Daily Lesson Log (DLL) format.
Your task is to generate a complete, structured DLL for Philippine K-12 education.

CRITICAL OUTPUT RULES:
- You MUST output ONLY a valid JSON object — no prose, no markdown fences, no explanation.
- The JSON must strictly follow the schema below.
- All text values should be in English unless the subject is Filipino.
- Align objectives with Bloom's Taxonomy (knowledge, comprehension, application).
- Follow the 5E or 4As instructional model for procedures.
- Keep objectives concise (1 sentence each).
- Keep procedures clearly sequenced with timing hints.

REQUIRED JSON SCHEMA:
{
  "title": "string — e.g. 'DLL: Fractions - Addition of Dissimilar Fractions'",
  "objectives": {
    "knowledge": ["string", ...],
    "skills":    ["string", ...],
    "attitude":  ["string", ...]
  },
  "content": {
    "subject_matter": "string — specific topic",
    "references": ["string — DepEd module / textbook page refs"],
    "other_learning_resources": ["string"]
  },
  "learning_resources": ["string — materials, manipulatives, tech tools"],
  "procedures": {
    "reviewing_past_lesson": "string — brief review activity (5 min)",
    "establishing_purpose":  "string — motivation / hook (5 min)",
    "presenting_examples":   "string — teacher presentation (15 min)",
    "discussing_concepts":   "string — guided practice / questioning (10 min)",
    "developing_mastery":    "string — formative assessment activity (10 min)",
    "finding_applications":  "string — real-life connection (5 min)",
    "making_generalizations":"string — summary / key takeaways (5 min)",
    "evaluating_learning":   "string — short written/oral assessment (5 min)",
    "additional_activities": "string — assignment / enrichment (optional)"
  },
  "remarks": {
    "no_of_learners_earned_80": "",
    "no_of_learners_for_remediation": "",
    "did_remedial_work": "",
    "no_of_learners_caught_up": "",
    "no_of_learners_continuing_remediation": "",
    "strategies_used": ""
  },
  "reflection": {
    "what_worked_well": "",
    "challenges_encountered": "",
    "innovations_used": ""
  }
}
PROMPT;

        if ($ragContext) {
            $prompt .= "\n\nUse the following uploaded course materials as your PRIMARY source when generating content. "
                . "Do NOT invent curriculum standards not present here.\n\n"
                . "=== COURSE MATERIALS ===\n{$ragContext}\n=== END MATERIALS ===";
        }

        return $prompt;
    }

    private function buildUserMessage(array $input): string
    {
        $lines = [
            "Generate a complete DLL with the following specifications:",
            "- Grade Level: {$input['grade_level']}",
            "- Subject: {$input['subject']}",
            "- Topic: {$input['topic']}",
            "- Duration: " . ($input['duration'] ?? '60 minutes'),
        ];

        if (!empty($input['learning_competency'])) {
            $lines[] = "- Learning Competency: {$input['learning_competency']}";
        }
        if (!empty($input['teaching_strategy'])) {
            $lines[] = "- Preferred Teaching Strategy: {$input['teaching_strategy']}";
        }
        if (!empty($input['available_resources'])) {
            $lines[] = "- Available Resources: {$input['available_resources']}";
        }

        $lines[] = "\nReturn ONLY the JSON object as specified. No extra text.";

        return implode("\n", $lines);
    }

    /**
     * Extract the JSON object from the LLM response.
     * The model may wrap it in markdown fences or add preamble text.
     */
    private function parseStructuredJson(string $rawText): array
    {
        // Strip markdown code fences
        $text = preg_replace('/```(?:json)?\s*/i', '', $rawText);
        $text = str_replace('```', '', $text);
        $text = trim($text);

        // Try direct decode first
        $decoded = json_decode($text, true);
        if (is_array($decoded)) {
            return $decoded;
        }

        // Try to find the outermost { ... } block
        $start = strpos($text, '{');
        $end   = strrpos($text, '}');

        if ($start !== false && $end !== false && $end > $start) {
            $jsonStr = substr($text, $start, $end - $start + 1);
            $decoded = json_decode($jsonStr, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        Log::warning('LessonPlanService: could not parse JSON from LLM response', [
            'snippet' => mb_substr($rawText, 0, 500),
        ]);

        // Return a best-effort fallback so the user still gets something editable
        return [
            'title'              => 'Generated Lesson Plan',
            'objectives'         => ['knowledge' => [], 'skills' => [], 'attitude' => []],
            'content'            => ['subject_matter' => '', 'references' => [], 'other_learning_resources' => []],
            'learning_resources' => [],
            'procedures'         => [
                'reviewing_past_lesson' => '',
                'establishing_purpose'  => '',
                'presenting_examples'   => $rawText, // dump raw in here so nothing is lost
                'discussing_concepts'   => '',
                'developing_mastery'    => '',
                'finding_applications'  => '',
                'making_generalizations'=> '',
                'evaluating_learning'   => '',
                'additional_activities' => '',
            ],
            'remarks'            => [],
            'reflection'         => [],
        ];
    }
}
