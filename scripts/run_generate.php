<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

// allow long-running CLI script when generating questions
if (function_exists('set_time_limit')) {
    @set_time_limit(0);
    @ini_set('max_execution_time', 0);
}

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

$provider = strtolower((string) env('AI_PROVIDER', 'openrouter'));
$timeout = intval(env('AI_TIMEOUT', env('LOCAL_AI_TIMEOUT', 120)));
$retries = intval(env('AI_RETRIES', env('LOCAL_AI_RETRIES', 2)));
$headers = [];

if ($provider === 'openrouter') {
    $baseUrl = rtrim((string) config('services.openrouter.base_url', 'https://openrouter.ai/api/v1'), '/');
    $url = $baseUrl . '/chat/completions';
    $apiKey = (string) config('services.openrouter.api_key', '');

    if ($apiKey === '') {
        echo "OPENROUTER_API_KEY is not configured.\n";
        exit(1);
    }

    $headers = [
        'Authorization' => 'Bearer ' . $apiKey,
        'HTTP-Referer' => (string) config('services.openrouter.site_url', config('app.url')),
        'X-Title' => (string) config('services.openrouter.app_name', config('app.name', 'Mentora')),
    ];

    $model = (string) config('services.openrouter.model', 'google/gemma-3-12b-it:free');
    $payload = [
        'model' => $model,
        'messages' => [
            ['role' => 'user', 'content' => $prompt],
        ],
        'temperature' => 0.7,
        'max_tokens' => 800,
    ];
} else {
    $baseUrl = rtrim(env('LOCAL_AI_URL', 'http://localhost:11434'), '/');
    $path = ltrim(env('LOCAL_AI_PATH', 'api/generate'), '/');
    $model = env('LOCAL_AI_MODEL', 'llama3:8b-instruct-q4_0');
    $url = $baseUrl . '/' . $path;
    $payload = [
        'model' => $model,
        'prompt' => $prompt,
        'max_tokens' => 800,
    ];
}

echo "Posting to AI provider {$provider}: {$url} (model={$model}) timeout={$timeout}s retries={$retries}\n";

$attempt = 0;
$resp = null;
while ($attempt <= $retries) {
    $attempt++;
    try {
        $request = Http::timeout($timeout);
        if (!empty($headers)) {
            $request = $request->withHeaders($headers);
        }

        $resp = $request->post($url, $payload);
        if (! $resp->failed()) {
            break;
        }
        echo "Request returned HTTP " . $resp->status() . " on attempt {$attempt}\n";
    } catch (\Exception $e) {
        echo "Attempt {$attempt} failed: " . $e->getMessage() . "\n";
    }
    if ($attempt <= $retries) {
        $backoff = $attempt * 2;
        echo "Retrying in {$backoff}s...\n";
        sleep($backoff);
    }
}

if (! $resp || $resp->failed()) {
    echo "AI provider request failed ({$provider}) after {$attempt} attempts.\n";
    if ($resp) { print_r($resp->body()); }
    exit(1);
}

$body = null;
try {
    $body = $resp->json();
} catch (\Exception $e) {
    $body = null;
}

// Extract text from common shapes and assemble streaming/NDJSON responses
$questionsText = '';
$raw = (string) $resp->body();
if (is_array($body)) {
    if (isset($body['text'])) {
        $questionsText = $body['text'];
    } elseif (isset($body['output'])) {
        $questionsText = is_string($body['output']) ? $body['output'] : json_encode($body['output']);
    } elseif (isset($body['results']) && is_array($body['results'])) {
        $first = $body['results'][0] ?? null;
        if (is_string($first)) {
            $questionsText = $first;
        } elseif (is_array($first)) {
            $questionsText = $first['text'] ?? $first['output'] ?? json_encode($first);
        }
    } elseif (isset($body['choices'][0]['message']['content'])) {
        $questionsText = $body['choices'][0]['message']['content'];
    } else {
        $questionsText = json_encode($body);
    }
} else {
    $questionsText = $raw;
}

// If API streamed JSON chunks, attempt to decode and assemble per-line JSON pieces
if ($raw) {
    $collected = '';
    $lines = preg_split('/\r?\n/', $raw);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '') continue;
        $decoded = json_decode($line, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            if (isset($decoded['response'])) { $collected .= $decoded['response']; continue; }
            if (isset($decoded['text'])) { $collected .= $decoded['text']; continue; }
            if (isset($decoded['content'])) { $collected .= (is_string($decoded['content']) ? $decoded['content'] : json_encode($decoded['content'])); continue; }
            if (isset($decoded['output'])) { $collected .= (is_string($decoded['output']) ? $decoded['output'] : json_encode($decoded['output'])); continue; }
            if (isset($decoded['choices'][0]['message']['content'])) { $collected .= $decoded['choices'][0]['message']['content']; continue; }
        }
        if (preg_match('/(\{.*\})/s', $line, $m)) {
            $decoded = json_decode($m[1], true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                if (isset($decoded['response'])) { $collected .= $decoded['response']; continue; }
                if (isset($decoded['text'])) { $collected .= $decoded['text']; continue; }
            }
        }
        $collected .= ' ' . $line;
    }
    $collected = trim($collected);
    if ($collected !== '') { $questionsText = $collected; }
}

echo "AI response length: " . strlen($questionsText) . "\n";

$blocks = preg_split('/\r?\n\r?\n+/', trim($questionsText));
$created = 0;

// Protect against DB column limits; set QUESTION_TEXT_MAX_LENGTH in .env if needed
$maxLen = intval(env('QUESTION_TEXT_MAX_LENGTH', 1000));
if (strlen($questionsText) > $maxLen) {
    try {
        $logPath = storage_path('logs/ai_output_' . date('Ymd_His') . '.log');
        file_put_contents($logPath, $questionsText . PHP_EOL, FILE_APPEND);
    } catch (\Exception $e) {}
}

foreach ($blocks as $block) {
    $text = trim($block);
    if (! $text) continue;

    $fullText = $text;
    if (mb_strlen($text) > $maxLen) {
        try {
            $logPath = storage_path('logs/ai_block_' . date('Ymd_His') . '.log');
            file_put_contents($logPath, $fullText . PHP_EOL, FILE_APPEND);
        } catch (\Exception $e) {}
        $text = mb_substr($text, 0, $maxLen);
    }

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
