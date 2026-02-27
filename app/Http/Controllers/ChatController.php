<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Chat;
use App\Models\Conversation;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Auth;

class ChatController extends Controller
{
    /**
     * Send a message to the local Ollama AI and return the response.
     * If no conversation_id is provided, a new conversation is created.
     */
    public function send(Request $request)
    {
        $request->validate([
            'message'         => 'required|string|max:5000',
            'conversation_id' => 'nullable|integer|exists:conversations,id',
        ]);

        if (function_exists('set_time_limit')) {
            @set_time_limit(intval(env('LOCAL_AI_EXECUTION_TIME', 300)));
            @ini_set('max_execution_time', intval(env('LOCAL_AI_EXECUTION_TIME', 300)));
        }

        $userMessage    = $request->input('message');
        $conversationId = $request->input('conversation_id');

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
        $model   = env('LOCAL_AI_MODEL', 'llama3:8b-instruct-q4_0');
        $url     = $baseUrl . '/api/generate';

        $payload = [
            'model'   => $model,
            'prompt'  => $prompt,
            'stream'  => false,
            'options' => [
                'temperature' => 0.7,
                'num_predict' => 1024,
            ],
        ];

        $timeout = intval(env('LOCAL_AI_TIMEOUT', 120));
        $retries = intval(env('LOCAL_AI_RETRIES', 2));

        $attempt = 0;
        $resp    = null;
        $err     = null;

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
                'response'        => 'Sorry, I could not connect to the AI model. Please make sure Ollama is running. Error: ' . $msg,
                'conversation_id' => $conversation->id,
            ], 200);
        }

        $responseText = $this->extractResponse($resp);

        // Save to database
        Chat::create([
            'user_id'         => Auth::id(),
            'conversation_id' => $conversation->id,
            'course_id'       => null,
            'message'         => $userMessage,
            'response'        => $responseText,
        ]);

        // Touch conversation so updated_at reflects last activity
        $conversation->touch();

        return response()->json([
            'response'        => $responseText,
            'conversation_id' => $conversation->id,
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
     * Extract the response text from the Ollama HTTP response.
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
}
