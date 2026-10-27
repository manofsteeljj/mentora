<?php

namespace Tests\Feature;

use App\Models\LessonPlan;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class LessonPlanReviewTest extends TestCase
{
    use RefreshDatabase;

    private function fakeLlm(): void
    {
        Http::fake([
            'http://localhost:11434/api/generate' => Http::response([
                'response' => json_encode([
                    'title' => 'DLL: Photosynthesis',
                    'objectives' => [
                        'knowledge' => ['Explain photosynthesis.'],
                        'skills' => ['Diagram the process.'],
                        'attitude' => ['Value plants.'],
                    ],
                    'content' => [
                        'subject_matter' => 'Photosynthesis',
                        'references' => ['Science 7 LM'],
                        'other_learning_resources' => [],
                    ],
                    'learning_resources' => ['Charts'],
                    'procedures' => [
                        'reviewing_past_lesson' => 'Review plant parts.',
                    ],
                    'remarks' => [],
                    'reflection' => [],
                ]),
            ]),
        ]);

        config()->set('AI_PROVIDER', 'local');
        config()->set('LOCAL_AI_URL', 'http://localhost:11434');
        config()->set('LOCAL_AI_PATH', 'api/generate');
        config()->set('LOCAL_AI_MODEL', 'llama3:8b-instruct-q4_0');
    }

    private function admin(): User
    {
        return User::factory()->create(['email' => 'admin@mentora.local']);
    }

    public function test_generated_lesson_plan_is_pending_and_visible_to_admin(): void
    {
        $this->fakeLlm();
        $teacher = User::factory()->create();

        $response = $this->actingAs($teacher)->postJson('/api/lesson-plans/generate', [
            'grade_level' => 'Grade 7',
            'subject' => 'Science',
            'topic' => 'Photosynthesis',
        ]);

        $response->assertCreated();
        $response->assertJsonPath('status', LessonPlan::STATUS_PENDING);

        $this->assertDatabaseHas('lesson_plans', [
            'user_id' => $teacher->id,
            'status' => 'pending',
        ]);
        $this->assertNotNull($response->json('submitted_at'));

        // Admin sees the new plan in the review list
        $admin = $this->admin();
        $list = $this->actingAs($admin)->getJson('/api/admin/lesson-plans');
        $list->assertOk();
        $list->assertJsonPath('counts.pending', 1);
        $list->assertJsonPath('plans.0.teacher.name', $teacher->name);
    }

    public function test_teacher_cannot_access_admin_review_endpoints(): void
    {
        $teacher = User::factory()->create();
        $plan = LessonPlan::create([
            'user_id' => $teacher->id,
            'title' => 'DLL',
            'grade_level' => 'Grade 7',
            'subject' => 'Science',
            'topic' => 'Photosynthesis',
            'status' => 'pending',
        ]);

        $this->actingAs($teacher)->getJson('/api/admin/lesson-plans')->assertForbidden();
        $this->actingAs($teacher)->postJson("/api/admin/lesson-plans/{$plan->id}/approve")->assertForbidden();
    }

    public function test_admin_can_deny_with_feedback_and_teacher_can_resubmit(): void
    {
        $teacher = User::factory()->create();
        $admin = $this->admin();

        $plan = LessonPlan::create([
            'user_id' => $teacher->id,
            'title' => 'DLL',
            'grade_level' => 'Grade 7',
            'subject' => 'Science',
            'topic' => 'Photosynthesis',
            'status' => 'pending',
        ]);

        // Admin denies with feedback
        $this->actingAs($admin)
            ->postJson("/api/admin/lesson-plans/{$plan->id}/deny", [
                'feedback' => 'Competency mismatch for Grade 7.',
            ])
            ->assertOk()
            ->assertJsonPath('status', 'denied');

        $this->assertDatabaseHas('lesson_plans', [
            'id' => $plan->id,
            'status' => 'denied',
            'admin_feedback' => 'Competency mismatch for Grade 7.',
            'reviewed_by' => $admin->id,
        ]);

        // Teacher sees the feedback in their list
        $index = $this->actingAs($teacher)->getJson('/api/lesson-plans');
        $index->assertOk();
        $index->assertJsonPath('0.status', 'denied');
        $index->assertJsonPath('0.admin_feedback', 'Competency mismatch for Grade 7.');

        // Teacher resubmits
        $submit = $this->actingAs($teacher)->postJson("/api/lesson-plans/{$plan->id}/submit");
        $submit->assertOk();
        $submit->assertJsonPath('status', 'pending');

        $this->assertDatabaseHas('lesson_plans', [
            'id' => $plan->id,
            'status' => 'pending',
            'admin_feedback' => null,
        ]);
    }

    public function test_teacher_cannot_resubmit_a_pending_plan(): void
    {
        $teacher = User::factory()->create();

        $plan = LessonPlan::create([
            'user_id' => $teacher->id,
            'title' => 'DLL',
            'grade_level' => 'Grade 7',
            'subject' => 'Science',
            'topic' => 'Photosynthesis',
            'status' => 'pending',
        ]);

        $this->actingAs($teacher)
            ->postJson("/api/lesson-plans/{$plan->id}/submit")
            ->assertStatus(422);
    }

    public function test_admin_can_request_revision_then_approve(): void
    {
        $teacher = User::factory()->create();
        $admin = $this->admin();

        $plan = LessonPlan::create([
            'user_id' => $teacher->id,
            'title' => 'DLL',
            'grade_level' => 'Grade 7',
            'subject' => 'Science',
            'topic' => 'Photosynthesis',
            'status' => 'needs_revision',
        ]);

        // Resubmittable → teacher sends it back to pending
        $this->actingAs($teacher)->postJson("/api/lesson-plans/{$plan->id}/submit")->assertOk();

        // Admin requests revision, then approves after another resubmit
        $this->actingAs($admin)
            ->postJson("/api/admin/lesson-plans/{$plan->id}/request-revision", [
                'feedback' => 'Expand Session 3.',
            ])
            ->assertOk()
            ->assertJsonPath('status', 'needs_revision');

        $this->actingAs($teacher)->postJson("/api/lesson-plans/{$plan->id}/submit")->assertOk();

        $this->actingAs($admin)
            ->postJson("/api/admin/lesson-plans/{$plan->id}/approve")
            ->assertOk()
            ->assertJsonPath('status', 'approved');

        $this->assertDatabaseHas('lesson_plans', ['id' => $plan->id, 'status' => 'approved']);
    }

    public function test_teacher_cannot_self_approve_via_update(): void
    {
        $teacher = User::factory()->create();

        $plan = LessonPlan::create([
            'user_id' => $teacher->id,
            'title' => 'DLL',
            'grade_level' => 'Grade 7',
            'subject' => 'Science',
            'topic' => 'Photosynthesis',
            'status' => 'pending',
        ]);

        $this->actingAs($teacher)
            ->putJson("/api/lesson-plans/{$plan->id}", [
                'title' => 'Renamed DLL',
                'status' => 'approved',
            ])
            ->assertOk();

        // Title changed, but status must stay pending — only admins approve.
        $this->assertDatabaseHas('lesson_plans', [
            'id' => $plan->id,
            'title' => 'Renamed DLL',
            'status' => 'pending',
        ]);
    }
}
