<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserSettingsController extends Controller
{
    private const DEFAULTS = [
        'response_detail' => 'balanced',
        'include_code_examples' => true,
        'auto_load_course_context' => true,
        'show_related_topics' => true,
        'email_notifications' => true,
        'new_material_alerts' => true,
        'quiz_reminders' => true,
        'save_chat_history' => true,
    ];

    public function show(Request $request): JsonResponse
    {
        return response()->json($this->settingsFor($request));
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'response_detail' => ['sometimes', 'string', 'in:concise,balanced,detailed'],
            'include_code_examples' => ['sometimes', 'boolean'],
            'auto_load_course_context' => ['sometimes', 'boolean'],
            'show_related_topics' => ['sometimes', 'boolean'],
            'email_notifications' => ['sometimes', 'boolean'],
            'new_material_alerts' => ['sometimes', 'boolean'],
            'quiz_reminders' => ['sometimes', 'boolean'],
            'save_chat_history' => ['sometimes', 'boolean'],
        ]);

        $user = $request->user();
        $user->settings = array_merge($this->settingsFor($request), $validated);
        $user->save();

        return response()->json($user->settings);
    }

    private function settingsFor(Request $request): array
    {
        return array_merge(self::DEFAULTS, $request->user()->settings ?? []);
    }
}
