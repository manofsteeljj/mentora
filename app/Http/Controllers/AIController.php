<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Material;
use App\Models\Assessment;
use App\Models\Question;
use App\Models\Course;
use Illuminate\Support\Facades\Http;

class AIController extends Controller
{
    public function generateQuestions($materialId, $assessmentId)
    {
        if (function_exists('set_time_limit')) {
            // allow longer running requests when calling local models
            @set_time_limit(intval(env('LOCAL_AI_EXECUTION_TIME', 300)));
            @ini_set('max_execution_time', intval(env('LOCAL_AI_EXECUTION_TIME', 300)));
        }
        $material = Material::findOrFail($materialId);
        $assessment = Assessment::findOrFail($assessmentId);
        $prompt = "Generate 5 multiple choice questions (with 4 options each and correct answer) based on the following text:\n\n" . ($material->extracted_text ?? '');

        // Local AI server settings (configure in .env)
        $baseUrl = rtrim(env('LOCAL_AI_URL', 'http://localhost:11434'), '/');
        $path = ltrim(env('LOCAL_AI_PATH', 'api/generate'), '/');
        $model = env('LOCAL_AI_MODEL', 'llama3:8b-instruct-q4_0');

        $url = $baseUrl . '/' . $path;

        $payload = [
            'model' => $model,
            'prompt' => $prompt,
            'max_tokens' => 800,
        ];

        // POST to local server (no API key by default)
        $timeout = intval(env('LOCAL_AI_TIMEOUT', 120));
        $retries = intval(env('LOCAL_AI_RETRIES', 2));

        $attempt = 0;
        $resp = null;
        while ($attempt <= $retries) {
            $attempt++;
            try {
                $resp = Http::timeout($timeout)->post($url, $payload);
                if (! $resp->failed()) {
                    break;
                }
            } catch (\Exception $e) {
                $err = $e->getMessage();
            }
            if ($attempt <= $retries) {
                sleep($attempt * 2);
            }
        }

        if (! $resp || $resp->failed()) {
            $msg = isset($err) ? $err : ($resp ? 'HTTP ' . $resp->status() : 'no response');
            return redirect()->back()->with('error', 'Local AI request failed after attempts: ' . $msg);
        }

        $body = null;
        try {
            $body = $resp->json();
        } catch (\Exception $e) {
            $body = null;
        }

        // Try to extract text from common response shapes. Also handle streaming / NDJSON
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
                // openai-compatible shape
                $questionsText = $body['choices'][0]['message']['content'];
            } else {
                $questionsText = json_encode($body);
            }
        } else {
            $questionsText = $raw;
        }

        // If the raw response looks like streaming JSON chunks (many JSON objects), try to assemble them
        if ($raw) {
            // split into lines and decode each line if possible (NDJSON) or try to extract JSON objects per-line
            $collected = '';
            $lines = preg_split('/\r?\n/', $raw);
            foreach ($lines as $line) {
                $line = trim($line);
                if ($line === '') continue;
                $decoded = json_decode($line, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                    // pull common fields
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
                    if (isset($decoded['output'])) {
                        $collected .= is_string($decoded['output']) ? $decoded['output'] : json_encode($decoded['output']);
                        continue;
                    }
                    if (isset($decoded['choices'][0]['message']['content'])) {
                        $collected .= $decoded['choices'][0]['message']['content'];
                        continue;
                    }
                }

                // fallback: try to find a JSON object inside the line
                if (preg_match('/(\{.*\})/s', $line, $m)) {
                    $decoded = json_decode($m[1], true);
                    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                        if (isset($decoded['response'])) {
                            $collected .= $decoded['response'];
                            continue;
                        }
                        if (isset($decoded['text'])) {
                            $collected .= $decoded['text'];
                            continue;
                        }
                    }
                }

                // otherwise append the raw line
                $collected .= ' ' . $line;
            }

            $collected = trim($collected);
            if ($collected !== '') {
                $questionsText = $collected;
            }
        }

        // Simple parsing: split by two newlines into blocks (each block should represent one question)
        $blocks = preg_split('/\r?\n\r?\n+/', trim($questionsText));

        // Ensure we don't exceed DB column length. If you prefer, change column to TEXT in a migration.
        $maxLen = intval(env('QUESTION_TEXT_MAX_LENGTH', 1000));

        // Log full AI output if it's large to help debugging/troubleshooting
        if (strlen($questionsText) > $maxLen) {
            try {
                $logPath = storage_path('logs/ai_output_' . date('Ymd_His') . '.log');
                file_put_contents($logPath, $questionsText . PHP_EOL, FILE_APPEND);
            } catch (\Exception $e) {
                // ignore logging errors
            }
        }

        foreach ($blocks as $block) {
            $text = trim($block);
            if (! $text) continue;

            $fullText = $text;
            if (mb_strlen($text) > $maxLen) {
                // log this particular block and truncate before inserting
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
                'points' => 1
            ]);
        }

        return redirect()->route('assessments.show', ['id' => $assessment->id])->with('success', 'Questions generated successfully!');
    }

    /**
     * Temporary: create an assessment for the course (if needed) and generate questions
     */
    public function generateForCourse($courseId)
    {
        if (function_exists('set_time_limit')) {
            @set_time_limit(intval(env('LOCAL_AI_EXECUTION_TIME', 300)));
            @ini_set('max_execution_time', intval(env('LOCAL_AI_EXECUTION_TIME', 300)));
        }

        $course = Course::findOrFail($courseId);

        $material = $course->materials()->latest()->first();
        if (! $material) {
            return redirect()->back()->with('error', 'No materials found for this course');
        }

        // create a new assessment for this course
        $assessment = Assessment::create([
            'course_id' => $course->id,
            'title' => 'Auto-generated Assessment ' . now()->format('Y-m-d H:i:s'),
        ]);

        return $this->generateQuestions($material->id, $assessment->id);
    }
}
