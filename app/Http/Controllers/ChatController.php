<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Chat;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Auth;

class ChatController extends Controller
{
    /**
     * Send a message to the local Ollama AI and return the response.
     */
    public function send(Request $request)
    {
        $request->validate([
            'message' => 'required|string|max:5000',
        ]);

        if (function_exists('set_time_limit')) {
            @set_time_limit(intval(env('LOCAL_AI_EXECUTION_TIME', 300)));
            @ini_set('max_execution_time', intval(env('LOCAL_AI_EXECUTION_TIME', 300)));
        }

        $userMessage = $request->input('message');

        // Build conversation context from recent chat history
        $recentChats = Chat::where('user_id', Auth::id())
            ->orderBy('created_at', 'desc')
            ->take(5)
            ->get()
            ->reverse();

        $conversationContext = '';
        foreach ($recentChats as $chat) {
            $conversationContext .= "User: {$chat->message}\nAssistant: {$chat->response}\n\n";
        }

        $systemPrompt = "You are Mentora, a helpful AI teaching assistant for college educators. "
            . "You help with lesson planning, quiz generation, grading assistance, assignment creation, "
            . "and answering questions about course materials. Be concise, helpful, and professional. "
            . "Format your responses with clear structure using bullet points or numbered lists when appropriate.";

        $prompt = $systemPrompt . "\n\n";
        if ($conversationContext) {
            $prompt .= "Previous conversation:\n" . $conversationContext;
        }
        $prompt .= "User: " . $userMessage . "\nAssistant:";

        // Local AI server settings
        $baseUrl = rtrim(env('LOCAL_AI_URL', 'http://localhost:11434'), '/');
        $model = env('LOCAL_AI_MODEL', 'llama3:8b-instruct-q4_0');

        // Use the Ollama /api/generate endpoint
        $url = $baseUrl . '/api/generate';

        $payload = [
            'model'  => $model,
            'prompt' => $prompt,
            'stream' => false,  // Get the full response at once
            'options' => [
                'temperature'   => 0.7,
                'num_predict'   => 1024,
            ],
        ];

        $timeout = intval(env('LOCAL_AI_TIMEOUT', 120));
        $retries = intval(env('LOCAL_AI_RETRIES', 2));

        $attempt = 0;
        $resp = null;
        $err = null;

        while ($attempt <= $retries) {
            $attempt++;
            try {
                $resp = Http::timeout($timeout)->post($url, $payload);
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
            return response()->json([
                'response' => 'Sorry, I could not connect to the AI model. Please make sure Ollama is running. Error: ' . $msg,
            ], 200); // Return 200 so the frontend can display the error message gracefully
        }

        // Extract the response text
        $responseText = $this->extractResponse($resp);

        // Save to database
        Chat::create([
            'user_id'   => Auth::id(),
            'course_id' => null,
            'message'   => $userMessage,
            'response'  => $responseText,
        ]);

        return response()->json([
            'response' => $responseText,
        ]);
    }

    /**
     * Get chat history for the authenticated user.
     */
    public function history(Request $request)
    {
        $chats = Chat::where('user_id', Auth::id())
            ->orderBy('created_at', 'asc')
            ->take(50)
            ->get();

        return response()->json($chats);
    }

    /**
     * Extract the response text from the Ollama HTTP response.
     * Handles both regular JSON and streaming NDJSON.
     */
    private function extractResponse($resp): string
    {
        $raw = (string) $resp->body();
        $body = null;

        try {
            $body = $resp->json();
        } catch (\Exception $e) {
            $body = null;
        }

        // Standard Ollama response shape
        if (is_array($body) && isset($body['response'])) {
            return trim($body['response']);
        }

        // OpenAI-compatible shape
        if (is_array($body) && isset($body['choices'][0]['message']['content'])) {
            return trim($body['choices'][0]['message']['content']);
        }

        // Try NDJSON streaming assembly
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

        // Fallback
        return $raw ?: 'No response received from AI model.';
    }
}
