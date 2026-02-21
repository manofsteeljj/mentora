<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Material;
use App\Models\Assessment;
use App\Models\Question;
use Illuminate\Support\Facades\Http;

class AIController extends Controller
{
    public function generateQuestions($materialId, $assessmentId)
    {
        $material = Material::findOrFail($materialId);
        $assessment = Assessment::findOrFail($assessmentId);

        $prompt = "Generate 5 multiple choice questions (with 4 options each and correct answer) based on the following text:\n\n" . ($material->extracted_text ?? '');

        $apiKey = env('OPENAI_API_KEY');
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
            return redirect()->back()->with('error', 'OpenAI API request failed');
        }

        $body = $resp->json();
        $questionsText = $body['choices'][0]['message']['content'] ?? '';

        // Very simple parsing: split by two newlines into blocks.
        $blocks = preg_split('/\r?\n\r?\n+/', trim($questionsText));
        foreach ($blocks as $block) {
            $text = trim($block);
            if (!$text) continue;

            // Save as a single question record; advanced parsing can extract options/answers.
            Question::create([
                'assessment_id' => $assessment->id,
                'question_type' => 'mcq',
                'question_text' => $text,
                'points' => 1
            ]);
        }

        return redirect()->back()->with('success', 'Questions generated successfully!');
    }
}
