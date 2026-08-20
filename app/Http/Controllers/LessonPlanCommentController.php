<?php

namespace App\Http\Controllers;

use App\Models\LessonPlan;
use App\Models\LessonPlanComment;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Review comments on a lesson plan — shared by the admin reviewer
 * and the owning teacher (shown next to the ONLYOFFICE editor).
 *
 * Endpoints:
 *   GET    /api/lesson-plans/{id}/comments               — list comments
 *   POST   /api/lesson-plans/{id}/comments               — add a comment
 *   DELETE /api/lesson-plans/{id}/comments/{commentId}   — delete a comment
 *
 * Access: the plan's owner (teacher) or the admin (same rule as AdminLessonPlanController).
 */
class LessonPlanCommentController extends Controller
{
    // ── GET /api/lesson-plans/{id}/comments ───────────────────────────────────

    public function index(Request $request, int $id): JsonResponse
    {
        $plan = LessonPlan::findOrFail($id);
        $this->authorizeAccess($request, $plan);

        $comments = $plan->comments()
            ->with('user:id,name,email')
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        return response()->json([
            'comments' => $comments->map(fn (LessonPlanComment $c) => $this->format($c, $request->user())),
        ]);
    }

    // ── POST /api/lesson-plans/{id}/comments ──────────────────────────────────

    public function store(Request $request, int $id): JsonResponse
    {
        $plan = LessonPlan::findOrFail($id);
        $this->authorizeAccess($request, $plan);

        $data = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
        ]);

        $comment = $plan->comments()->create([
            'user_id' => $request->user()->id,
            'body'    => trim($data['body']),
        ]);

        return response()->json([
            'comment' => $this->format($comment->load('user:id,name,email'), $request->user()),
        ], 201);
    }

    // ── DELETE /api/lesson-plans/{id}/comments/{commentId} ────────────────────

    public function destroy(Request $request, int $id, int $commentId): JsonResponse
    {
        $plan = LessonPlan::findOrFail($id);
        $this->authorizeAccess($request, $plan);

        $comment = $plan->comments()->findOrFail($commentId);

        $user = $request->user();
        if ((int) $comment->user_id !== (int) $user->id && !$this->isAdmin($user)) {
            abort(403, 'You can only delete your own comments.');
        }

        $comment->delete();

        return response()->json(['success' => true]);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /** Owner (teacher) or admin may read/write comments on a plan. */
    private function authorizeAccess(Request $request, LessonPlan $plan): void
    {
        $user = $request->user();

        if ($this->isAdmin($user)) {
            return;
        }

        if ((int) $plan->user_id !== (int) $user->id) {
            abort(403, 'You do not have access to this lesson plan.');
        }
    }

    private function isAdmin(User $user): bool
    {
        $email = Str::lower((string) ($user->email ?? ''));
        return $email === 'admin@mentora.local';
    }

    private function format(LessonPlanComment $comment, User $viewer): array
    {
        return [
            'id'         => $comment->id,
            'body'       => $comment->body,
            'created_at' => optional($comment->created_at)->toISOString(),
            'user'       => [
                'id'       => $comment->user?->id,
                'name'     => $comment->user?->name ?? 'Unknown',
                'is_admin' => $comment->user ? $this->isAdmin($comment->user) : false,
            ],
            'can_delete' => $comment->user
                && ((int) $comment->user_id === (int) $viewer->id || $this->isAdmin($viewer)),
        ];
    }
}
