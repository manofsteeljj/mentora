<?php

namespace App\Services;

use App\Models\LessonPlan;
use App\Models\Material;
use App\Services\AI\LLMService;
use DOMDocument;
use DOMElement;
use DOMXPath;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

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
     *   duration: ?string,
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
        $userMessage = $this->buildUserMessage($input);

        $result = $this->llm->complete($systemPrompt, $userMessage, 'lesson_plan');
        $structured = $this->parseStructuredJson($result['text'] ?? '{}');
        $normalized = $this->normalizeStructured($structured, $input);

        $plan = LessonPlan::create([
            'user_id' => Auth::id(),
            'course_id' => $input['course_id'] ?? null,
            'title' => $normalized['title'],
            'grade_level' => $input['grade_level'],
            'subject' => $input['subject'],
            'topic' => $input['topic'],
            'duration' => $input['duration'] ?? '60 minutes',
            'learning_competency' => $input['learning_competency'] ?? null,
            'teaching_strategy' => $input['teaching_strategy'] ?? null,
            'available_resources' => $input['available_resources'] ?? null,
            'objectives' => $normalized['objectives'],
            'content' => $normalized['content'],
            'learning_resources' => $normalized['learning_resources'],
            'procedures' => $normalized['procedures'],
            'remarks' => $normalized['remarks'],
            'reflection' => $normalized['reflection'],
            'raw_ai_output' => $result['text'] ?? null,
            'ai_model' => $result['model'] ?? null,
            'status' => 'draft',
            'docx_version' => 1,
        ]);

        $this->saveDocxToDisk($plan);

        return $plan;
    }

    private function retrieveContext(array $input): string
    {
        $userId = Auth::id();
        $courseId = $input['course_id'] ?? null;
        $query = implode(' ', array_filter([
            $input['subject'] ?? '',
            $input['topic'] ?? '',
            $input['learning_competency'] ?? '',
        ]));

        $q = Material::whereHas('course', fn ($queryBuilder) => $queryBuilder->where('user_id', $userId))
            ->where(function ($queryBuilder) {
                $queryBuilder->whereNotNull('extracted_text')->where('extracted_text', '!=', '')
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
            $text = mb_strtolower(($mat->extracted_text ?? '') . ' ' . ($mat->title ?? '') . ' ' . ($mat->description ?? ''));
            $score = array_reduce($keywords, fn ($sum, $kw) => $sum + mb_substr_count($text, $kw), 0);
            return ['mat' => $mat, 'score' => $score];
        })->sortByDesc('score')->take(3);

        $parts = [];
        $used = 0;

        foreach ($scored as $item) {
            if ($used > 4000) {
                break;
            }

            $mat = $item['mat'];
            $chunk = mb_substr($mat->extracted_text ?? $mat->description ?? '', 0, 1500);
            if (!$chunk) {
                continue;
            }

            $parts[] = "[{$mat->title}]\n{$chunk}";
            $used += mb_strlen($chunk);
        }

        return implode("\n\n---\n\n", $parts);
    }

    private function extractKeywords(string $text): array
    {
        $stopWords = ['the', 'a', 'an', 'is', 'are', 'and', 'or', 'of', 'in', 'on', 'for', 'to', 'at', 'by'];
        $words = preg_split('/\W+/u', mb_strtolower($text), -1, PREG_SPLIT_NO_EMPTY);

        return array_values(array_filter($words, fn ($word) => mb_strlen($word) > 3 && !in_array($word, $stopWords, true)));
    }

    private function buildSystemPrompt(array $input, string $ragContext): string
    {
        $prompt = <<<'PROMPT'
You are an expert Filipino curriculum developer trained in DepEd's Daily Lesson Log (DLL) format.
Your task is to generate a complete, structured TERM lesson plan in JSON based on the provided DLL template labels.

CRITICAL OUTPUT RULES:
- You MUST output ONLY a valid JSON object — no prose, no markdown fences, no explanation.
- The JSON must strictly follow the schema below.
- All text values should be in English unless the subject is Filipino.
- Keep statements practical and classroom-ready.
- Keep each section concise and specific.

REQUIRED JSON SCHEMA:
{
    "title": "string",
    "lesson_title": "string",
    "learning_area": "string",
    "learning_competency_and_curriculum_standards": "string",
    "learning_objectives": {
        "intentions": ["string", ...],
        "flow": ["string", ...],
        "experience": ["string", ...]
  },
    "learner_context": "string",
    "pre_lesson": "string",
    "sessions": [
        {
            "session_label": "SESSION 1",
            "day": "MONDAY",
            "activity": "string"
        }
    ],
    "formative_assessment": "string",
    "extended_learning_opportunities": "string",
    "opportunities_for_integration": "string",
    "learning_resources": ["string", ...],
    "references": ["string", ...],
    "declaration_of_ai_use": {
        "tool": "Copilot",
        "purpose": "string",
        "prompt_used": "string"
  },
    "reflection": {
        "pause_and_reflect": "string",
        "ways_forward": "string",
        "support_needed": "string",
        "share_with_community": "string"
  },
    "remarks": {
        "teacher_notes": "string"
  }
}

Required coverage:
- Include exactly 5 session entries (SESSION 1..SESSION 5) for Monday to Friday.
- Keep session activities aligned to the competency and objectives.
- Use only educationally appropriate wording.
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
            'Generate a complete TERM lesson plan using the DLL template fields:',
            "- Grade Level: {$input['grade_level']}",
            "- Subject: {$input['subject']}",
            "- Topic: {$input['topic']}",
            '- Duration: ' . ($input['duration'] ?? '60 minutes'),
            '- Sessions: 5 (Monday to Friday)',
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

        $lines[] = '\nReturn ONLY the JSON object as specified. No extra text.';

        return implode("\n", $lines);
    }

    private function normalizeStructured(array $structured, array $input): array
    {
        $title = (string) ($structured['title'] ?? $structured['lesson_title'] ?? "DLL: {$input['topic']}");

        if (isset($structured['objectives']) || isset($structured['content']) || isset($structured['procedures'])) {
            return [
                'title' => $title,
                'objectives' => $structured['objectives'] ?? ['knowledge' => [], 'skills' => [], 'attitude' => []],
                'content' => $structured['content'] ?? ['subject_matter' => '', 'references' => [], 'other_learning_resources' => []],
                'learning_resources' => $structured['learning_resources'] ?? [],
                'procedures' => $structured['procedures'] ?? [],
                'remarks' => $structured['remarks'] ?? [],
                'reflection' => $structured['reflection'] ?? [],
            ];
        }

        $learningObjectives = $structured['learning_objectives'] ?? [];

        $objectives = [
            'knowledge' => is_array($learningObjectives['intentions'] ?? null) ? $learningObjectives['intentions'] : [],
            'skills' => is_array($learningObjectives['flow'] ?? null) ? $learningObjectives['flow'] : [],
            'attitude' => is_array($learningObjectives['experience'] ?? null) ? $learningObjectives['experience'] : [],
        ];

        $template = [
            'lesson_title' => (string) ($structured['lesson_title'] ?? $title),
            'learning_area' => (string) ($structured['learning_area'] ?? $input['subject'] ?? ''),
            'learning_competency_and_curriculum_standards' => (string) ($structured['learning_competency_and_curriculum_standards'] ?? $input['learning_competency'] ?? ''),
            'learner_context' => (string) ($structured['learner_context'] ?? ''),
            'pre_lesson' => (string) ($structured['pre_lesson'] ?? ''),
            'sessions' => is_array($structured['sessions'] ?? null) ? $structured['sessions'] : [],
            'formative_assessment' => (string) ($structured['formative_assessment'] ?? ''),
            'extended_learning_opportunities' => (string) ($structured['extended_learning_opportunities'] ?? ''),
            'opportunities_for_integration' => (string) ($structured['opportunities_for_integration'] ?? ''),
            'declaration_of_ai_use' => is_array($structured['declaration_of_ai_use'] ?? null) ? $structured['declaration_of_ai_use'] : [
                'tool' => 'Copilot',
                'purpose' => 'lesson planning',
                'prompt_used' => '',
            ],
        ];

        $content = [
            'subject_matter' => (string) ($structured['topic'] ?? $input['topic'] ?? ''),
            'references' => is_array($structured['references'] ?? null) ? $structured['references'] : [],
            'other_learning_resources' => is_array($structured['learning_resources'] ?? null) ? $structured['learning_resources'] : [],
            'template' => $template,
        ];

        $procedures = [
            'template_sessions' => $template['sessions'],
            'formative_assessment' => $template['formative_assessment'],
            'extended_learning_opportunities' => $template['extended_learning_opportunities'],
            'opportunities_for_integration' => $template['opportunities_for_integration'],
        ];

        $remarks = $structured['remarks'] ?? [];
        if (!is_array($remarks)) {
            $remarks = ['teacher_notes' => (string) $remarks];
        }

        $reflection = $structured['reflection'] ?? [];
        if (!is_array($reflection)) {
            $reflection = ['pause_and_reflect' => (string) $reflection];
        }

        return [
            'title' => $title,
            'objectives' => $objectives,
            'content' => $content,
            'learning_resources' => is_array($structured['learning_resources'] ?? null) ? $structured['learning_resources'] : [],
            'procedures' => $procedures,
            'remarks' => $remarks,
            'reflection' => $reflection,
        ];
    }

    private function parseStructuredJson(string $rawText): array
    {
        $text = preg_replace('/```(?:json)?\s*/i', '', $rawText);
        $text = str_replace('```', '', $text);
        $text = trim($text);

        $decoded = json_decode($text, true);
        if (is_array($decoded)) {
            return $decoded;
        }

        $start = strpos($text, '{');
        $end = strrpos($text, '}');

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

        return [
            'title' => 'Generated Lesson Plan',
            'objectives' => ['knowledge' => [], 'skills' => [], 'attitude' => []],
            'content' => ['subject_matter' => '', 'references' => [], 'other_learning_resources' => []],
            'learning_resources' => [],
            'procedures' => [
                'reviewing_past_lesson' => '',
                'establishing_purpose' => '',
                'presenting_examples' => $rawText,
                'discussing_concepts' => '',
                'developing_mastery' => '',
                'finding_applications' => '',
                'making_generalizations' => '',
                'evaluating_learning' => '',
                'additional_activities' => '',
            ],
            'remarks' => [],
            'reflection' => [],
        ];
    }

    /**
     * Build and store the DOCX file for a lesson plan.
     */
    public function saveDocxToDisk(LessonPlan $plan): void
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

        $obj = $plan->objectives ?? [];
        $cont = $plan->content ?? [];
        $proc = $plan->procedures ?? [];
        $rem = $plan->remarks ?? [];
        $ref = $plan->reflection ?? [];
        $template = is_array($cont['template'] ?? null) ? $cont['template'] : [];

        if (!empty($template['learning_competency_and_curriculum_standards'])) {
            $lines[] = 'Learning Competency and Curriculum Standards:';
            $lines[] = $template['learning_competency_and_curriculum_standards'];
            $lines[] = '';
        }

        if (!empty($template['learner_context'])) {
            $lines[] = 'Learner Context:';
            $lines[] = $template['learner_context'];
            $lines[] = '';
        }

        $lines[] = 'I. OBJECTIVES';
        foreach (['knowledge' => 'A. Knowledge', 'skills' => 'B. Skills', 'attitude' => 'C. Attitude'] as $key => $label) {
            $items = $obj[$key] ?? [];
            if ($items) {
                $lines[] = $label . ':';
                foreach ($items as $item) {
                    $lines[] = '  • ' . $item;
                }
            }
        }
        $lines[] = '';

        $lines[] = 'II. CONTENT';
        $lines[] = 'Subject Matter: ' . ($cont['subject_matter'] ?? '');
        foreach ($cont['references'] ?? [] as $r) {
            $lines[] = '  • ' . $r;
        }
        $lines[] = '';

        $lines[] = 'III. LEARNING RESOURCES';
        foreach ($plan->learning_resources ?? [] as $r) {
            $lines[] = '  • ' . $r;
        }
        $lines[] = '';

        if (!empty($template['pre_lesson'])) {
            $lines[] = 'Pre-Lesson:';
            $lines[] = $template['pre_lesson'];
            $lines[] = '';
        }

        if (!empty($proc['template_sessions']) && is_array($proc['template_sessions'])) {
            $lines[] = 'Sessions';
            foreach ($proc['template_sessions'] as $session) {
                if (!is_array($session)) {
                    continue;
                }
                $label = (string) ($session['session_label'] ?? 'SESSION');
                $day = (string) ($session['day'] ?? '');
                $activity = (string) ($session['activity'] ?? '');
                $lines[] = trim($label . ($day ? ' (' . $day . ')' : ''));
                if ($activity !== '') {
                    $lines[] = $activity;
                }
                $lines[] = '';
            }
        }

        $lines[] = 'IV. PROCEDURES';
        $procLabels = [
            'reviewing_past_lesson' => 'A. Reviewing Previous Lesson',
            'establishing_purpose' => 'B. Establishing Purpose',
            'presenting_examples' => 'C. Presenting Examples',
            'discussing_concepts' => 'D. Discussing Concepts',
            'developing_mastery' => 'E. Developing Mastery',
            'finding_applications' => 'F. Finding Applications',
            'making_generalizations' => 'G. Making Generalizations',
            'evaluating_learning' => 'H. Evaluating Learning',
            'additional_activities' => 'I. Additional Activities',
        ];
        foreach ($procLabels as $key => $label) {
            if (!empty($proc[$key])) {
                $lines[] = $label;
                $lines[] = $proc[$key];
                $lines[] = '';
            }
        }

        if (!empty($proc['formative_assessment'])) {
            $lines[] = 'Formative Assessment:';
            $lines[] = (string) $proc['formative_assessment'];
            $lines[] = '';
        }

        if (!empty($proc['extended_learning_opportunities'])) {
            $lines[] = 'Extended Learning Opportunities:';
            $lines[] = (string) $proc['extended_learning_opportunities'];
            $lines[] = '';
        }

        if (!empty($proc['opportunities_for_integration'])) {
            $lines[] = 'Opportunities for Integration:';
            $lines[] = (string) $proc['opportunities_for_integration'];
            $lines[] = '';
        }

        $lines[] = 'V. REMARKS';
        foreach ($rem as $k => $v) {
            if ($v) {
                $lines[] = ucwords(str_replace('_', ' ', $k)) . ': ' . $v;
            }
        }
        $lines[] = '';

        $lines[] = 'VI. REFLECTION';
        foreach ($ref as $k => $v) {
            if ($v) {
                $lines[] = ucwords(str_replace('_', ' ', $k)) . ': ' . $v;
            }
        }

        if (!empty($template['declaration_of_ai_use']) && is_array($template['declaration_of_ai_use'])) {
            $decl = $template['declaration_of_ai_use'];
            $lines[] = '';
            $lines[] = 'Declaration of AI use';
            if (!empty($decl['tool'])) {
                $lines[] = 'Tool: ' . $decl['tool'];
            }
            if (!empty($decl['purpose'])) {
                $lines[] = 'Purpose: ' . $decl['purpose'];
            }
            if (!empty($decl['prompt_used'])) {
                $lines[] = 'Prompt used: ' . $decl['prompt_used'];
            }
        }

        $lines[] = '';
        $lines[] = 'Generated by Mentora AI · Model: ' . ($plan->ai_model ?? '') . ' · ' . now()->format('F j, Y');

        $docxBytes = $this->buildDocxFromTemplate($plan);
        if ($docxBytes === null) {
            $docxBytes = $this->buildDocxBytes($lines);
        }

        $path = 'documents/lesson-plans/' . $plan->id . '.docx';

        Storage::disk('local')->put($path, $docxBytes);
        $plan->update(['docx_path' => $path]);
    }

    private function buildDocxFromTemplate(LessonPlan $plan): ?string
    {
        $templatePath = base_path('mockup/format/DLL_ENGLISH_COPY.docx');
        if (!is_file($templatePath) || !class_exists('ZipArchive')) {
            return null;
        }

        $zip = new \ZipArchive();
        if ($zip->open($templatePath) !== true) {
            return null;
        }

        $entries = [];
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            if ($name === false) {
                continue;
            }

            $content = $zip->getFromName($name);
            if ($content === false) {
                $content = '';
            }
            $entries[$name] = $content;
        }
        $zip->close();

        $documentXml = $entries['word/document.xml'] ?? null;
        if (!$documentXml) {
            return null;
        }

        $updatedXml = $this->populateTemplateDocumentXml($documentXml, $plan);
        if ($updatedXml === null) {
            return null;
        }

        $entries['word/document.xml'] = $updatedXml;

        return $this->buildZip($entries);
    }

    private function populateTemplateDocumentXml(string $documentXml, LessonPlan $plan): ?string
    {
        $doc = new DOMDocument();
        $doc->preserveWhiteSpace = true;
        $doc->formatOutput = false;

        if (@$doc->loadXML($documentXml) === false) {
            return null;
        }

        $xp = new DOMXPath($doc);
        $xp->registerNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main');

        $content = is_array($plan->content) ? $plan->content : [];
        $template = is_array($content['template'] ?? null) ? $content['template'] : [];
        $procedures = is_array($plan->procedures) ? $plan->procedures : [];
        $reflection = is_array($plan->reflection) ? $plan->reflection : [];
        $references = is_array($content['references'] ?? null) ? $content['references'] : [];
        $resources = is_array($plan->learning_resources) ? $plan->learning_resources : [];

        $teacherName = trim((string) optional($plan->user)->name);
        if ($teacherName === '') {
            $teacherName = '[Teacher Name]';
        }

        $declaration = $template['declaration_of_ai_use'] ?? [];
        $declarationText = 'Consistent with policy guidelines on the use of AI in basic education, I, '
            . $teacherName
            . ', used '
            . ((string) ($declaration['tool'] ?? 'Copilot'))
            . ' for '
            . ((string) ($declaration['purpose'] ?? 'lesson planning'))
            . '. Prompt used: '
            . ((string) ($declaration['prompt_used'] ?? 'N/A'));

        $fieldMap = [
            'Lesson Title' => (string) ($template['lesson_title'] ?? $plan->title ?? ''),
            'Learning Area' => (string) ($template['learning_area'] ?? $plan->subject ?? ''),
            'Name of Teacher/s' => $teacherName,
            'Grade Level and Section' => (string) $plan->grade_level,
            'No. of Sessions' => (string) count(array_filter(is_array($template['sessions'] ?? null) ? $template['sessions'] : [])),
            'References' => $this->implodeList($references),
            'Declaration of AI use' => $declarationText,
        ];

        $rows = $xp->query('(//w:tbl)[1]//w:tr');
        if ($rows !== false) {
            foreach ($rows as $row) {
                $cells = $xp->query('./w:tc', $row);
                if ($cells === false || $cells->length < 2) {
                    continue;
                }

                $label = $this->nodeText($cells->item(0));
                $target = $this->matchFieldByLabel($label, $fieldMap);
                if ($target === null) {
                    continue;
                }

                $this->setCellText($doc, $cells->item(1), $target);
            }
        }

        $this->setParagraphAfterLabel($doc, $xp, 'Learning Competency and Curriculum Standards:', (string) ($template['learning_competency_and_curriculum_standards'] ?? $plan->learning_competency ?? ''));
        $this->setParagraphAfterLabel($doc, $xp, 'Learner Context:', (string) ($template['learner_context'] ?? ''));
        $this->setParagraphAfterLabel($doc, $xp, 'Pre-Lesson:', (string) ($template['pre_lesson'] ?? ''));
        $this->setParagraphAfterLabel($doc, $xp, 'Formative Assessment:', (string) ($procedures['formative_assessment'] ?? ''));
        $this->setParagraphAfterLabel($doc, $xp, 'Extended Learning opportunities:', (string) ($procedures['extended_learning_opportunities'] ?? ''));
        $this->setParagraphAfterLabel($doc, $xp, 'Opportunities for Integration:', (string) ($procedures['opportunities_for_integration'] ?? ''));
        $this->setParagraphAfterLabel($doc, $xp, 'Learning Resources:', $this->implodeList($resources));
        $this->setParagraphAfterLabel($doc, $xp, 'Reflections:', (string) ($reflection['pause_and_reflect'] ?? ''));
        $this->setParagraphAfterLabel($doc, $xp, 'Ways Forward.', (string) ($reflection['ways_forward'] ?? ''));

        $sessions = is_array($template['sessions'] ?? null) ? $template['sessions'] : [];
        foreach ($sessions as $session) {
            if (!is_array($session)) {
                continue;
            }
            $label = (string) ($session['session_label'] ?? '');
            $day = (string) ($session['day'] ?? '');
            $activity = (string) ($session['activity'] ?? '');

            if ($label === '' || $activity === '') {
                continue;
            }

            $sessionText = trim($activity . ($day !== '' ? ' (' . $day . ')' : ''));
            $this->setParagraphAfterLabel($doc, $xp, $label, $sessionText);
        }

        $xml = $doc->saveXML();
        if (!is_string($xml)) {
            return null;
        }

        // Some template sections keep guidance text in the same paragraph or nested runs.
        // Replace these guidance sentences with generated content when available.
        $replaceMap = [
            'Create a task, activity, or questions to evaluate' => (string) ($procedures['formative_assessment'] ?? ''),
            'Suggest other learning experiences outside the' => (string) ($procedures['extended_learning_opportunities'] ?? ''),
            'Write down any possibilities to meaningfully anchor learning areas, special topic, or technology.' => (string) ($procedures['opportunities_for_integration'] ?? ''),
            'List down the learning resources that will help you reach your objectives. Ensure that they are available and inclusive.' => $this->implodeList($resources),
            'Pause and reflect on what happened today.' => (string) ($reflection['pause_and_reflect'] ?? ''),
            'Think about what you need to change for the next' => (string) ($reflection['ways_forward'] ?? ''),
        ];

        foreach ($replaceMap as $from => $to) {
            $to = trim($to);
            if ($to === '') {
                continue;
            }
            $xml = str_replace($from, $to, $xml);
        }

        return $xml;
    }

    private function matchFieldByLabel(string $label, array $fieldMap): ?string
    {
        $normalized = mb_strtolower(trim($label));
        foreach ($fieldMap as $key => $value) {
            if (str_contains($normalized, mb_strtolower($key))) {
                return (string) $value;
            }
        }
        return null;
    }

    private function nodeText(?\DOMNode $node): string
    {
        if (!$node) {
            return '';
        }
        return trim((string) preg_replace('/\s+/u', ' ', $node->textContent));
    }

    /**
     * Run properties for generated value text — matches the template's
     * value cells exactly (Arial Narrow, 10pt, non-bold).
     */
    private function buildValueRunProperties(DOMDocument $doc): DOMElement
    {
        $ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

        $rPr = $doc->createElementNS($ns, 'w:rPr');

        $rFonts = $doc->createElementNS($ns, 'w:rFonts');
        foreach (['w:ascii', 'w:cs', 'w:eastAsia', 'w:hAnsi'] as $attr) {
            $rFonts->setAttribute($attr, 'Arial Narrow');
        }
        $rPr->appendChild($rFonts);

        $rPr->appendChild($doc->createElementNS($ns, 'w:sz'))->setAttribute('w:val', '20');
        $rPr->appendChild($doc->createElementNS($ns, 'w:szCs'))->setAttribute('w:val', '20');
        $rPr->appendChild($doc->createElementNS($ns, 'w:rtl'))->setAttribute('w:val', '0');

        return $rPr;
    }

    private function setCellText(DOMDocument $doc, ?\DOMNode $cell, string $text): void
    {
        if (!$cell instanceof DOMElement) {
            return;
        }

        // Capture the paragraph properties (w:pPr) of the cell's first
        // paragraph so new paragraphs keep the template's exact formatting.
        $paragraphs  = $cell->getElementsByTagName('p');
        $pPrTemplate = null;

        if ($paragraphs->length > 0) {
            $firstP = $paragraphs->item(0);
            $pPr    = $firstP->getElementsByTagName('pPr')->item(0);
            if ($pPr) {
                $pPrTemplate = $pPr->cloneNode(true);
                // The empty template cells carry bold on the paragraph-mark
                // rPr; value text in the template (e.g. the Declaration cell)
                // is non-bold — strip bold to match.
                foreach (iterator_to_array($pPrTemplate->getElementsByTagName('b')) as $b) {
                    $b->parentNode?->removeChild($b);
                }
                foreach (iterator_to_array($pPrTemplate->getElementsByTagName('bCs')) as $bCs) {
                    $bCs->parentNode?->removeChild($bCs);
                }
            }
        }

        // Value runs use the template's value-text style: Arial Narrow 10pt,
        // non-bold — identical to the Declaration cell's filled-in runs.
        $rPrTemplate = $this->buildValueRunProperties($doc);

        // Remove ONLY the paragraphs — keep w:tcPr (gridSpan, borders, vAlign,
        // margins) intact so the table layout is pixel-identical to the template.
        foreach (iterator_to_array($cell->childNodes) as $child) {
            if ($child instanceof DOMElement && $child->localName === 'p') {
                $cell->removeChild($child);
            }
        }

        $lines = preg_split('/\r\n|\r|\n/', trim($text)) ?: [''];
        if (empty($lines)) {
            $lines = [''];
        }

        $namespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
        foreach ($lines as $line) {
            $p = $doc->createElementNS($namespace, 'w:p');
            if ($pPrTemplate) {
                $p->appendChild($pPrTemplate->cloneNode(true));
            }

            $r = $doc->createElementNS($namespace, 'w:r');
            if ($rPrTemplate) {
                $r->appendChild($rPrTemplate->cloneNode(true));
            }

            $t = $doc->createElementNS($namespace, 'w:t');
            $t->setAttribute('xml:space', 'preserve');
            $t->appendChild($doc->createTextNode($line));
            $r->appendChild($t);
            $p->appendChild($r);
            $cell->appendChild($p);
        }
    }

    private function setParagraphAfterLabel(DOMDocument $doc, DOMXPath $xp, string $label, string $value): void
    {
        if (trim($value) === '') {
            return;
        }

        $paragraphs = $xp->query('//w:p');
        if ($paragraphs === false) {
            return;
        }

        $labelLower = mb_strtolower($label);

        foreach ($paragraphs as $p) {
            $text = $this->nodeText($p);

            // The label must START the paragraph — prevents "SESSION 1"
            // matching a body paragraph that merely mentions it.
            if (!str_starts_with(mb_strtolower($text), $labelLower)) {
                continue;
            }

            // Skip label paragraphs that live inside the header table — those
            // are handled by setCellText (e.g. "References(...)" cell).
            if ($p->parentNode && $p->parentNode->parentNode && $p->parentNode->parentNode->localName === 'tc') {
                continue;
            }

            $next = $p->nextSibling;
            while ($next && !($next instanceof DOMElement && $next->localName === 'p')) {
                $next = $next->nextSibling;
            }

            if ($next instanceof DOMElement) {
                $this->setParagraphText($doc, $next, $value);
            }

            return;
        }
    }

    private function setParagraphText(DOMDocument $doc, DOMElement $paragraph, string $text): void
    {
        // Preserve the paragraph's pPr (spacing, tabs, fonts) exactly.
        $pPr = $paragraph->getElementsByTagName('pPr')->item(0);

        // Reuse the paragraph's first run formatting for the new text.
        $rPrTemplate = null;
        foreach ($paragraph->getElementsByTagName('r') as $run) {
            $rPr = $run->getElementsByTagName('rPr')->item(0);
            if ($rPr) {
                $rPrTemplate = $rPr->cloneNode(true);
                break;
            }
        }

        foreach (iterator_to_array($paragraph->childNodes) as $child) {
            $paragraph->removeChild($child);
        }

        if ($pPr) {
            $paragraph->appendChild($pPr);
        }

        $namespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
        $lines = preg_split('/\r\n|\r|\n/', trim($text)) ?: [''];
        if (empty($lines)) {
            $lines = [''];
        }

        foreach ($lines as $idx => $line) {
            if ($idx > 0) {
                $rBr = $doc->createElementNS($namespace, 'w:r');
                if ($rPrTemplate) {
                    $rBr->appendChild($rPrTemplate->cloneNode(true));
                }
                $br = $doc->createElementNS($namespace, 'w:br');
                $rBr->appendChild($br);
                $paragraph->appendChild($rBr);
            }

            $r = $doc->createElementNS($namespace, 'w:r');
            if ($rPrTemplate) {
                $r->appendChild($rPrTemplate->cloneNode(true));
            }
            $t = $doc->createElementNS($namespace, 'w:t');
            $t->setAttribute('xml:space', 'preserve');
            $t->appendChild($doc->createTextNode($line));
            $r->appendChild($t);
            $paragraph->appendChild($r);
        }
    }

    private function implodeList(array $items): string
    {
        $flat = array_values(array_filter(array_map(fn ($item) => trim((string) $item), $items), fn ($v) => $v !== ''));
        return implode("\n", $flat);
    }

    private function buildDocxBytes(array $lines): string
    {
        $bodyXml = '';
        foreach ($lines as $line) {
            $text = htmlspecialchars((string) $line, ENT_XML1, 'UTF-8');
            $isBold = preg_match('/^[IVX]+\.\s/', $line) || preg_match('/^[A-Z][A-Z ]{4,}$/', trim($line));
            $rPr = $isBold ? '<w:rPr><w:b/><w:sz w:val="22"/></w:rPr>' : '<w:rPr><w:sz w:val="22"/></w:rPr>';
            $bodyXml .= "<w:p><w:pPr><w:spacing w:after=\"80\"/></w:pPr><w:r>{$rPr}<w:t xml:space=\"preserve\">{$text}</w:t></w:r></w:p>\n";
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

        return $this->buildZip([
            '[Content_Types].xml' => $contentTypes,
            '_rels/.rels' => $relsRoot,
            'word/document.xml' => $documentXml,
            'word/_rels/document.xml.rels' => $relsWord,
        ]);
    }

    private function buildZip(array $files): string
    {
        $centralDir = '';
        $localFiles = '';
        $offset = 0;

        foreach ($files as $name => $content) {
            $nameLen = strlen($name);
            $dataLen = strlen($content);
            $crc = crc32($content);
            $dosTime = $this->dosDateTime();

            $localHeader = pack('VvvvvvVVVvv',
                0x04034b50, 20, 0, 0,
                $dosTime[0], $dosTime[1],
                $crc, $dataLen, $dataLen,
                $nameLen, 0
            ) . $name;

            $localFiles .= $localHeader . $content;

            $centralDir .= pack('VvvvvvvVVVvvvvvVV',
                0x02014b50, 20, 20, 0, 0,
                $dosTime[0], $dosTime[1],
                $crc, $dataLen, $dataLen,
                $nameLen, 0, 0, 0, 0, 0, $offset
            ) . $name;

            $offset += strlen($localHeader) + $dataLen;
        }

        $eocd = pack('VvvvvVVv',
            0x06054b50, 0, 0,
            count($files), count($files),
            strlen($centralDir), $offset, 0
        );

        return $localFiles . $centralDir . $eocd;
    }

    private function dosDateTime(): array
    {
        $t = getdate();
        $time = (($t['hours'] & 0x1f) << 11) | (($t['minutes'] & 0x3f) << 5) | (($t['seconds'] >> 1) & 0x1f);
        $date = ((($t['year'] - 1980) & 0x7f) << 9) | (($t['mon'] & 0x0f) << 5) | ($t['mday'] & 0x1f);

        return [$time & 0xffff, $date & 0xffff];
    }
}
