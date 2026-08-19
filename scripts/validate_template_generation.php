<?php

declare(strict_types=1);

use App\Models\User;
use App\Services\LessonPlanService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;

require __DIR__ . '/../vendor/autoload.php';

$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

config([
    'AI_PROVIDER' => 'local',
    'LOCAL_AI_URL' => 'http://localhost:11434',
    'LOCAL_AI_PATH' => 'api/generate',
    'LOCAL_AI_MODEL' => 'llama3:8b-instruct-q4_0',
]);

Http::fake([
    'http://localhost:11434/api/generate' => Http::response([
        'response' => json_encode([
            'title' => 'TERM 1 LESSON PLAN - ENGLISH',
            'lesson_title' => 'Reading Comprehension Strategies',
            'learning_area' => 'English',
            'learning_competency_and_curriculum_standards' => 'Identify main idea and supporting details in grade-level texts.',
            'learning_objectives' => [
                'intentions' => ['Identify main idea in short passages.'],
                'flow' => ['Annotate key details as evidence.'],
                'experience' => ['Participate respectfully in group reading tasks.'],
            ],
            'learner_context' => 'Learners are mixed-ability readers with strong oral participation.',
            'pre_lesson' => "Review yesterday's vocabulary and activate prior knowledge.",
            'sessions' => [
                ['session_label' => 'SESSION 1', 'day' => 'MONDAY', 'activity' => 'Model think-aloud reading with one short text.'],
                ['session_label' => 'SESSION 2', 'day' => 'TUESDAY', 'activity' => 'Guided group analysis of supporting details.'],
                ['session_label' => 'SESSION 3', 'day' => 'WEDNESDAY', 'activity' => 'Pair annotation task with feedback rounds.'],
                ['session_label' => 'SESSION 4', 'day' => 'THURSDAY', 'activity' => 'Independent reading check and peer discussion.'],
                ['session_label' => 'SESSION 5', 'day' => 'FRIDAY', 'activity' => 'Synthesis activity and short performance check.'],
            ],
            'formative_assessment' => 'Exit ticket: identify main idea and two details from a new paragraph.',
            'extended_learning_opportunities' => 'Home reading log and parent-assisted discussion prompts.',
            'opportunities_for_integration' => 'Integrate with Araling Panlipunan informational texts.',
            'learning_resources' => ['Short passages', 'Chart paper', 'Highlighters'],
            'references' => ['DepEd English Module Week 6'],
            'declaration_of_ai_use' => [
                'tool' => 'Copilot',
                'purpose' => 'lesson planning',
                'prompt_used' => 'Generate a DLL-aligned weekly lesson sequence.',
            ],
            'reflection' => [
                'pause_and_reflect' => 'Most learners improved evidence selection accuracy.',
                'ways_forward' => 'Add differentiated passages next week.',
                'support_needed' => 'Need additional leveled reading texts.',
                'share_with_community' => 'Share annotation strategy in LAC session.',
            ],
            'remarks' => ['teacher_notes' => 'Monitor two learners for reading fluency support.'],
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
    ]),
]);

$user = User::factory()->create();
Auth::login($user);

$plan = app(LessonPlanService::class)->generate([
    'grade_level' => 'Grade 6 - Rizal',
    'subject' => 'English',
    'topic' => 'Main Idea and Supporting Details',
    'duration' => '60 minutes',
    'learning_competency' => 'Identify main idea and supporting details.',
    'teaching_strategy' => '4As',
    'available_resources' => 'Module + chart paper',
    'course_id' => null,
]);

$path = storage_path('app/private/' . $plan->docx_path);
$zip = new ZipArchive();
if ($zip->open($path) !== true) {
    fwrite(STDERR, "DOCX_OPEN_FAIL\n");
    exit(1);
}

$xml = (string) $zip->getFromName('word/document.xml');
$zip->close();

$checks = [
    'Reading Comprehension Strategies',
    'Learning Competency and Curriculum Standards',
    'SESSION 1',
    'Exit ticket: identify main idea',
    'Declaration of AI use',
];

$allOk = true;
foreach ($checks as $check) {
    $ok = str_contains($xml, $check);
    echo ($ok ? 'OK: ' : 'MISS: ') . $check . PHP_EOL;
    if (!$ok) {
        $allOk = false;
    }
}

echo 'DOCX_PATH: ' . $plan->docx_path . PHP_EOL;

exit($allOk ? 0 : 2);
