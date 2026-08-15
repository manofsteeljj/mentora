<?php

namespace App\Services\AI;

use App\Models\AiRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Unified LLM abstraction that routes to OpenRouter or a local Ollama-compatible provider.
 * Add new providers by implementing LLMProviderInterface and registering in make().
 */
class LLMService
{
    protected string $provider;
    protected int    $timeout;
    protected int    $retries;

    public function __construct()
    {
        $this->provider = mb_strtolower((string) env('AI_PROVIDER', 'openrouter'));
        $this->timeout  = intval(env('AI_TIMEOUT', env('LOCAL_AI_TIMEOUT', 120)));
        $this->retries  = intval(env('AI_RETRIES', env('LOCAL_AI_RETRIES', 2)));
    }

    /**
     * Send a chat-completion request and return the text response.
     *
     * @param  string  $systemPrompt  The system/context instructions
     * @param  string  $userMessage   The user turn
     * @param  string  $feature       Feature name for logging (e.g. 'lesson_plan')
     * @return array{text: string, model: string, prompt_tokens: ?int, completion_tokens: ?int, response_time_ms: int}
     */
    public function complete(string $systemPrompt, string $userMessage, string $feature = 'general'): array
    {
        if (function_exists('set_time_limit')) {
            $exec = intval(env('AI_EXECUTION_TIME', env('LOCAL_AI_EXECUTION_TIME', 300)));
            @set_time_limit($exec);
            @ini_set('max_execution_time', $exec);
        }

        [$url, $headers, $payload, $model] = $this->buildRequest($systemPrompt, $userMessage);

        $startMs  = (int) round(microtime(true) * 1000);
        $resp     = null;
        $lastErr  = null;
        $attempt  = 0;

        while ($attempt <= $this->retries) {
            $attempt++;
            try {
                $http = Http::timeout($this->timeout);
                if (!empty($headers)) {
                    $http = $http->withHeaders($headers);
                }
                $resp = $http->post($url, $payload);
                if (!$resp->failed()) {
                    break;
                }
            } catch (\Throwable $e) {
                $lastErr = $e->getMessage();
                Log::warning("LLMService attempt {$attempt} failed", ['error' => $lastErr]);
            }
            if ($attempt <= $this->retries) {
                sleep($attempt * 2);
            }
        }

        $elapsedMs = (int) round(microtime(true) * 1000) - $startMs;

        if (!$resp || $resp->failed()) {
            $errMsg = $lastErr ?? ($resp ? 'HTTP ' . $resp->status() : 'no response');
            $this->logRequest($feature, $model, $systemPrompt . "\n\n" . $userMessage, null, $elapsedMs, null, null, 'error', $errMsg);
            throw new \RuntimeException("LLM provider ({$this->provider}) failed: {$errMsg}");
        }

        $text           = $this->extractText($resp);
        $promptTokens   = $resp->json('usage.prompt_tokens');
        $completionTokens = $resp->json('usage.completion_tokens');

        $this->logRequest($feature, $model, $systemPrompt . "\n\n" . $userMessage, $text, $elapsedMs, $promptTokens, $completionTokens, 'success', null);

        return [
            'text'              => $text,
            'model'             => $model,
            'prompt_tokens'     => $promptTokens,
            'completion_tokens' => $completionTokens,
            'response_time_ms'  => $elapsedMs,
        ];
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private function buildRequest(string $systemPrompt, string $userMessage): array
    {
        if ($this->provider === 'openrouter') {
            $baseUrl = rtrim((string) config('services.openrouter.base_url', 'https://openrouter.ai/api/v1'), '/');
            $url     = $baseUrl . '/chat/completions';
            $apiKey  = (string) config('services.openrouter.api_key', '');
            $model   = (string) config('services.openrouter.model', 'google/gemma-3-12b-it:free');

            if ($apiKey === '') {
                throw new \RuntimeException('OPENROUTER_API_KEY is not configured.');
            }

            $headers = [
                'Authorization' => 'Bearer ' . $apiKey,
                'HTTP-Referer'  => (string) config('services.openrouter.site_url', config('app.url')),
                'X-Title'       => (string) config('services.openrouter.app_name', config('app.name', 'Mentora')),
            ];

            $payload = [
                'model'       => $model,
                'messages'    => [
                    ['role' => 'system', 'content' => $systemPrompt],
                    ['role' => 'user',   'content' => $userMessage],
                ],
                'temperature' => 0.7,
                'max_tokens'  => 3000,
            ];

            return [$url, $headers, $payload, $model];
        }

        // Local Ollama-compatible
        $baseUrl = rtrim((string) env('LOCAL_AI_URL', 'http://localhost:11434'), '/');
        $path    = ltrim((string) env('LOCAL_AI_PATH', 'api/generate'), '/');
        $model   = (string) env('LOCAL_AI_MODEL', 'llama3:8b-instruct-q4_0');
        $url     = $baseUrl . '/' . $path;

        $payload = [
            'model'   => $model,
            'prompt'  => $systemPrompt . "\n\nUser: " . $userMessage . "\nAssistant:",
            'stream'  => false,
            'options' => [
                'temperature' => 0.7,
                'num_predict' => 3000,
            ],
        ];

        return [$url, [], $payload, $model];
    }

    private function extractText($resp): string
    {
        $body = null;
        try {
            $body = $resp->json();
        } catch (\Throwable) {}

        if (is_array($body)) {
            if (isset($body['choices'][0]['message']['content'])) {
                return trim($body['choices'][0]['message']['content']);
            }
            if (isset($body['response'])) {
                return trim($body['response']);
            }
        }

        // NDJSON streaming fallback
        $collected = '';
        foreach (preg_split('/\r?\n/', (string) $resp->body()) as $line) {
            $line = trim($line);
            if ($line === '') continue;
            $decoded = json_decode($line, true);
            if (is_array($decoded)) {
                if (isset($decoded['choices'][0]['message']['content'])) {
                    $collected .= $decoded['choices'][0]['message']['content'];
                } elseif (isset($decoded['response'])) {
                    $collected .= $decoded['response'];
                }
            }
        }

        return trim($collected ?: (string) $resp->body());
    }

    private function logRequest(
        string  $feature,
        string  $model,
        string  $prompt,
        ?string $response,
        int     $responseTimeMs,
        ?int    $promptTokens,
        ?int    $completionTokens,
        string  $status,
        ?string $errorMessage
    ): void {
        try {
            AiRequest::create([
                'user_id'           => Auth::id(),
                'feature'           => $feature,
                'model'             => $model,
                'prompt'            => mb_substr($prompt, 0, 20000),
                'response'          => $response ? mb_substr($response, 0, 20000) : null,
                'response_time_ms'  => $responseTimeMs,
                'prompt_tokens'     => $promptTokens,
                'completion_tokens' => $completionTokens,
                'status'            => $status,
                'error_message'     => $errorMessage,
            ]);
        } catch (\Throwable $e) {
            Log::warning('Failed to log AI request', ['error' => $e->getMessage()]);
        }
    }
}
