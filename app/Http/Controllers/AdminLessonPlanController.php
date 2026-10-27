<?php

namespace App\Http\Controllers;

use App\Models\LessonPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AdminLessonPlanController extends Controller
{
    // ── Admin check helper (same rule as FacultyController) ───────────────────

    private function assertAdmin(Request $request): void
    {
        $email = Str::lower((string) ($request->user()->email ?? ''));
        abort_if($email !== 'admin@mentora.local', 403, 'Forbidden');
    }

    // ── GET /api/admin/lesson-plans ──────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $this->assertAdmin($request);

        $status = $request->query('status');
        if ($status && $status !== 'all') {
            $plans = LessonPlan::with('user:id,name,email')->where('status', $status);
        } else {
            $plans = LessonPlan::with('user:id,name,email');
        }

        $plans = $plans->orderByDesc('submitted_at')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (LessonPlan $plan) => $this->formatListItem($plan));

        $counts = [
            'total'    => LessonPlan::count(),
            'pending'  => LessonPlan::where('status', LessonPlan::STATUS_PENDING)->count(),
            'approved' => LessonPlan::where('status', LessonPlan::STATUS_APPROVED)->count(),
            'denied'   => LessonPlan::where('status', LessonPlan::STATUS_DENIED)->count(),
            'revision' => LessonPlan::where('status', LessonPlan::STATUS_NEEDS_REVISION)->count(),
        ];

        return response()->json(['plans' => $plans, 'counts' => $counts]);
    }

    // ── GET /api/admin/lesson-plans/{id} ─────────────────────────────────────

    public function show(Request $request, int $id): JsonResponse
    {
        $this->assertAdmin($request);

        $plan = LessonPlan::with(['user:id,name,email', 'reviewer:id,name'])->findOrFail($id);

        return response()->json([
            'plan'     => $plan,
            'teacher'  => [
                'id'    => $plan->user?->id,
                'name'  => $plan->user?->name,
                'email' => $plan->user?->email,
            ],
            'reviewer' => $plan->reviewer ? ['id' => $plan->reviewer->id, 'name' => $plan->reviewer->name] : null,
        ]);
    }

    // ── POST /api/admin/lesson-plans/{id}/approve ────────────────────────────

    public function approve(Request $request, int $id): JsonResponse
    {
        return $this->review($request, $id, LessonPlan::STATUS_APPROVED);
    }

    // ── POST /api/admin/lesson-plans/{id}/deny ───────────────────────────────

    public function deny(Request $request, int $id): JsonResponse
    {
        return $this->review($request, $id, LessonPlan::STATUS_DENIED);
    }

    // ── POST /api/admin/lesson-plans/{id}/request-revision ───────────────────

    public function requestRevision(Request $request, int $id): JsonResponse
    {
        return $this->review($request, $id, LessonPlan::STATUS_NEEDS_REVISION);
    }

    // ── Shared review handler ────────────────────────────────────────────────

    private function review(Request $request, int $id, string $status): JsonResponse
    {
        $this->assertAdmin($request);

        $data = $request->validate([
            'feedback' => ['nullable', 'string', 'max:2000'],
        ]);

        $plan = LessonPlan::findOrFail($id);
        $plan->update([
            'status'         => $status,
            'admin_feedback' => $data['feedback'] ?? null,
            'reviewed_by'    => $request->user()->id,
            'reviewed_at'    => now(),
        ]);

        return response()->json([
            'success' => true,
            'status'  => $plan->status,
            'plan'    => $this->formatListItem($plan->load('user:id,name,email')),
        ]);
    }

    // ── Private formatter ─────────────────────────────────────────────────────

    private function formatListItem(LessonPlan $plan): array
    {
        return [
            'id'             => $plan->id,
            'title'          => $plan->title,
            'grade_level'    => $plan->grade_level,
            'subject'        => $plan->subject,
            'topic'          => $plan->topic,
            'duration'       => $plan->duration,
            'ai_model'       => $plan->ai_model,
            'status'         => $plan->status,
            'admin_feedback' => $plan->admin_feedback,
            'teacher'        => [
                'id'    => $plan->user?->id,
                'name'  => $plan->user?->name ?? 'Unknown teacher',
                'email' => $plan->user?->email,
            ],
            'submitted_at'   => optional($plan->submitted_at ?? $plan->created_at)->toISOString(),
            'reviewed_at'    => optional($plan->reviewed_at)->toISOString(),
            'created_at'     => optional($plan->created_at)->toISOString(),
            'updated_at'     => optional($plan->updated_at)->toISOString(),
        ];
    }
}
