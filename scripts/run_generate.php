<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Material;
use App\Models\Assessment;
use App\Models\Question;
use Illuminate\Support\Facades\Http;

$materialId = $argv[1] ?? 3;
$assessmentId = $argv[2] ?? 1;

$material = Material::find($materialId);
$assessment = Assessment::find($assessmentId);
if (! $material) { echo "Material {$materialId} not found\n"; exit(1); }
if (! $assessment) { echo "Assessment {$assessmentId} not found\n"; exit(1); }

echo "Using material {$material->id} (course {$material->course_id}), assessment {$assessment->id}\n";

$prompt = "Generate 5 multiple choice questions (with 4 options each and correct answer) based on the following text:\n\n" . ($material->extracted_text ?? '');

$apiKey = env('OPENAI_API_KEY');
if (! $apiKey) { echo "OPENAI_API_KEY not set in .env\n"; exit(1); }

$resp = Http::withToken($apiKey)
    ->post('https://api.openai.com/v1/chat/completions', [
        'model' => 'gpt-4',
        'messages' => [
            ['role' => 'system', 'content' => 'You are an AI teaching assistant. Generate clear MCQs with correct answers.'],
            ['role' => 'user', 'content' => $prompt],
        ],
        'max_tokens' => 800,
    ]);

if ($resp->failed()) {
    echo "OpenAI request failed: ";
    print_r($resp->body());
    exit(1);
}

$body = $resp->json();
$questionsText = $body['choices'][0]['message']['content'] ?? '';
echo "AI response length: " . strlen($questionsText) . "\n";

$blocks = preg_split('/\r?\n\r?\n+/', trim($questionsText));
$created = 0;
foreach ($blocks as $block) {
    $text = trim($block);
    if (! $text) continue;
    Question::create([
        'assessment_id' => $assessment->id,
        'question_type' => 'mcq',
        'question_text' => $text,
        'points' => 1,
    ]);
    $created++;
}

echo "Created {$created} questions for assessment {$assessment->id}\n";

if ($created) {
    $qs = Question::where('assessment_id', $assessment->id)->get();
    foreach ($qs as $q) {
        echo "- Q{$q->id}: " . substr(preg_replace('/\s+/', ' ', $q->question_text), 0, 150) . "\n";
    }
}
