<?php

namespace Tests\Feature;

use App\Models\LessonPlan;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class LessonPlanCommentTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['email' => 'admin@mentora.local']);
    }

    private function makePlan(User $teacher, string $status = 'pending'): LessonPlan
    {
        return LessonPlan::create([
            'user_id'      => $teacher->id,
            'title'        => 'DLL: Photosynthesis',
            'grade_level'  => 'Grade 7',
            'subject'      => 'Science',
            'topic'        => 'Photosynthesis',
            'status'       => $status,
            'submitted_at' => now(),
        ]);
    }

    // ── Comments API ────────────────────────────────────────────────────────────

    public function test_teacher_can_list_and_add_comments_on_own_plan(): void
    {
        $teacher = User::factory()->create();
        $plan = $this->makePlan($teacher);

        // Teacher adds a comment
        $this->actingAs($teacher)
            ->postJson("/api/lesson-plans/{$plan->id}/comments", [
                'body' => 'Adding more examples to Session 2.',
            ])
            ->assertCreated()
            ->assertJsonPath('comment.body', 'Adding more examples to Session 2.')
            ->assertJsonPath('comment.user.name', $teacher->name)
            ->assertJsonPath('comment.user.is_admin', false)
            ->assertJsonPath('comment.can_delete', true);

        // Teacher lists comments
        $this->actingAs($teacher)
            ->getJson("/api/lesson-plans/{$plan->id}/comments")
            ->assertOk()
            ->assertJsonCount(1, 'comments')
            ->assertJsonPath('comments.0.body', 'Adding more examples to Session 2.');

        // Comment count is exposed on the teacher's plan list
        $this->actingAs($teacher)
            ->getJson('/api/lesson-plans')
            ->assertOk()
            ->assertJsonPath('0.comments_count', 1);
    }

    public function test_admin_can_comment_on_teachers_plan(): void
    {
        $teacher = User::factory()->create();
        $admin = $this->admin();
        $plan = $this->makePlan($teacher);

        $this->actingAs($admin)
            ->postJson("/api/lesson-plans/{$plan->id}/comments", [
                'body' => 'Please align Session 3 with the learning competency.',
            ])
            ->assertCreated()
            ->assertJsonPath('comment.user.is_admin', true);

        // The teacher sees the admin's comment on their side
        $this->actingAs($teacher)
            ->getJson("/api/lesson-plans/{$plan->id}/comments")
            ->assertOk()
            ->assertJsonCount(1, 'comments')
            ->assertJsonPath('comments.0.user.is_admin', true)
            ->assertJsonPath('comments.0.user.name', $admin->name)
            ->assertJsonPath('comments.0.can_delete', false);
    }

    public function test_other_teacher_cannot_access_comments(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $plan = $this->makePlan($owner);

        $this->actingAs($other)
            ->getJson("/api/lesson-plans/{$plan->id}/comments")
            ->assertForbidden();

        $this->actingAs($other)
            ->postJson("/api/lesson-plans/{$plan->id}/comments", ['body' => 'Hi'])
            ->assertForbidden();
    }

    public function test_comment_deletion_is_limited_to_author_or_admin(): void
    {
        $teacher = User::factory()->create();
        $admin = $this->admin();
        $plan = $this->makePlan($teacher);

        $adminComment = $plan->comments()->create([
            'user_id' => $admin->id,
            'body'    => 'Needs work on objectives.',
        ]);
        $teacherComment = $plan->comments()->create([
            'user_id' => $teacher->id,
            'body'    => 'Noted — updating now.',
        ]);

        // Teacher cannot delete the admin's comment
        $this->actingAs($teacher)
            ->deleteJson("/api/lesson-plans/{$plan->id}/comments/{$adminComment->id}")
            ->assertForbidden();

        // Author can delete their own comment
        $this->actingAs($teacher)
            ->deleteJson("/api/lesson-plans/{$plan->id}/comments/{$teacherComment->id}")
            ->assertOk();

        // Admin can delete any comment
        $this->actingAs($admin)
            ->deleteJson("/api/lesson-plans/{$plan->id}/comments/{$adminComment->id}")
            ->assertOk();

        $this->assertDatabaseCount('lesson_plan_comments', 0);
    }

    // ── ONLYOFFICE admin review access ────────────────────────────────────────

    public function test_admin_can_open_teachers_lesson_plan_in_view_mode(): void
    {
        Storage::fake('local');

        $teacher = User::factory()->create();
        $admin = $this->admin();
        $plan = $this->makePlan($teacher);

        $response = $this->actingAs($admin)
            ->getJson("/api/documents/lesson-plan/{$plan->id}/editor?mode=view")
            ->assertOk();

        $response->assertJsonPath('config.editorConfig.mode', 'view');

        // A DOCX is generated on demand so the admin always has something to view
        $this->assertDatabaseHas('lesson_plans', [
            'id'        => $plan->id,
            'docx_path' => 'documents/lesson-plans/' . $plan->id . '.docx',
        ]);
    }

    public function test_teacher_editor_defaults_to_edit_mode(): void
    {
        Storage::fake('local');

        $teacher = User::factory()->create();
        $plan = $this->makePlan($teacher);

        $this->actingAs($teacher)
            ->getJson("/api/documents/lesson-plan/{$plan->id}/editor")
            ->assertOk()
            ->assertJsonPath('config.editorConfig.mode', 'edit');
    }

    public function test_teacher_cannot_open_another_teachers_lesson_plan_editor(): void
    {
        Storage::fake('local');

        $owner = User::factory()->create();
        $other = User::factory()->create();
        $plan = $this->makePlan($owner);

        $this->actingAs($other)
            ->getJson("/api/documents/lesson-plan/{$plan->id}/editor")
            ->assertForbidden();
    }
}
