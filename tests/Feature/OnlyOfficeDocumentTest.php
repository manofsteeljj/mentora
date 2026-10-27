<?php

namespace Tests\Feature;

use App\Models\ClassRecordDocument;
use App\Models\LessonPlan;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class OnlyOfficeDocumentTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_upload_class_record_xlsx(): void
    {
        Storage::fake('local');

        $user = User::factory()->create();
        $file = UploadedFile::fake()->create('class-record.xlsx', 1, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        $response = $this->actingAs($user)->postJson('/api/documents/class-record/upload', [
            'title' => 'My Class Record',
            'file' => $file,
        ]);

        $response->assertCreated();
        $response->assertJsonPath('title', 'My Class Record');
        $this->assertDatabaseHas('class_record_documents', [
            'user_id' => $user->id,
            'title' => 'My Class Record',
        ]);
    }

    public function test_other_user_cannot_open_another_users_class_record(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('documents/class-records/99.xlsx', 'test-content');

        $owner = User::factory()->create();
        $other = User::factory()->create();

        $doc = ClassRecordDocument::create([
            'user_id' => $owner->id,
            'title' => 'Owner Record',
            'xlsx_path' => 'documents/class-records/99.xlsx',
            'xlsx_version' => 1,
        ]);

        $response = $this->actingAs($other)->getJson('/api/documents/class-record/' . $doc->id . '/editor');

        $response->assertForbidden();
    }

    public function test_owner_can_open_own_class_record(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('documents/class-records/42.xlsx', 'test-content');

        $owner = User::factory()->create();

        $doc = ClassRecordDocument::create([
            'user_id' => $owner->id,
            'title' => 'Owner Record',
            'xlsx_path' => 'documents/class-records/42.xlsx',
            'xlsx_version' => 1,
        ]);

        $response = $this->actingAs($owner)->getJson('/api/documents/class-record/' . $doc->id . '/editor');

        $response->assertOk();
        $response->assertJsonPath('id', $doc->id);
        $response->assertJsonPath('type', 'class-record');
        $response->assertJsonPath('documentType', 'cell');
    }

    public function test_user_can_generate_a_lesson_plan(): void
    {
        Http::fake([
            'http://localhost:11434/api/generate' => Http::response([
                'response' => json_encode([
                    'title' => 'DLL: Fractions - Addition of Dissimilar Fractions',
                    'objectives' => [
                        'knowledge' => ['Describe like fractions.'],
                        'skills' => ['Add fractions correctly.'],
                        'attitude' => ['Show patience in solving.'],
                    ],
                    'content' => [
                        'subject_matter' => 'Addition of Dissimilar Fractions',
                        'references' => ['LM Unit 3'],
                        'other_learning_resources' => ['Fraction circles'],
                    ],
                    'learning_resources' => ['Manila paper', 'Markers'],
                    'procedures' => [
                        'reviewing_past_lesson' => 'Review equivalent fractions in 5 minutes.',
                        'establishing_purpose' => 'Show a real-life sharing problem in 5 minutes.',
                        'presenting_examples' => 'Model how to find common denominators in 15 minutes.',
                        'discussing_concepts' => 'Guide learners through examples in 10 minutes.',
                        'developing_mastery' => 'Have pairs solve practice items in 10 minutes.',
                        'finding_applications' => 'Connect the skill to cooking and measuring in 5 minutes.',
                        'making_generalizations' => 'Summarize how to find the common denominator in 5 minutes.',
                        'evaluating_learning' => 'Give a short exit ticket in 5 minutes.',
                        'additional_activities' => 'Assign practice problems for homework.',
                    ],
                    'remarks' => [
                        'no_of_learners_earned_80' => '18',
                        'no_of_learners_for_remediation' => '5',
                        'did_remedial_work' => 'Yes',
                        'no_of_learners_caught_up' => '3',
                        'no_of_learners_continuing_remediation' => '2',
                        'strategies_used' => 'Differentiated instruction',
                    ],
                    'reflection' => [
                        'what_worked_well' => 'Students enjoyed the manipulative activity.',
                        'challenges_encountered' => 'Some learners needed more review on equivalent fractions.',
                        'innovations_used' => 'Used fraction circles to scaffold understanding.',
                    ],
                ]),
            ]),
        ]);

        config()->set('AI_PROVIDER', 'local');
        config()->set('LOCAL_AI_URL', 'http://localhost:11434');
        config()->set('LOCAL_AI_PATH', 'api/generate');
        config()->set('LOCAL_AI_MODEL', 'llama3:8b-instruct-q4_0');

        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/lesson-plans/generate', [
            'grade_level' => 'Grade 5',
            'subject' => 'Mathematics',
            'topic' => 'Addition of Dissimilar Fractions',
            'duration' => '60 minutes',
            'learning_competency' => 'Add dissimilar fractions.',
            'teaching_strategy' => '5E Model',
            'available_resources' => 'Fraction circles',
        ]);

        $response->assertCreated();
        $response->assertJsonPath('grade_level', 'Grade 5');
        $this->assertDatabaseHas('lesson_plans', [
            'user_id' => $user->id,
            'subject' => 'Mathematics',
            'topic' => 'Addition of Dissimilar Fractions',
        ]);
    }

    public function test_lesson_plan_editor_token_uses_direct_config_payload_shape(): void
    {
        Storage::fake('local');
        config()->set('services.onlyoffice.jwt_secret', 'test-onlyoffice-secret');

        $owner = User::factory()->create();

        $plan = LessonPlan::create([
            'user_id' => $owner->id,
            'title' => 'DLL Token Test',
            'grade_level' => 'Grade 6',
            'subject' => 'English',
            'topic' => 'Reading Comprehension',
            'duration' => '60 minutes',
            'status' => 'draft',
            'docx_version' => 1,
            'docx_path' => 'documents/lesson-plans/1.docx',
        ]);

        Storage::disk('local')->put($plan->docx_path, 'fake-docx-bytes');

        $response = $this->actingAs($owner)->getJson('/api/documents/lesson-plan/' . $plan->id . '/editor');

        $response->assertOk();
        $token = $response->json('config.token');

        $this->assertIsString($token);
        $parts = explode('.', $token);
        $this->assertCount(3, $parts, 'JWT must contain exactly 3 parts.');

        $payloadJson = base64_decode(strtr($parts[1], '-_', '+/'));
        $payload = json_decode($payloadJson, true);

        $this->assertIsArray($payload);
        $this->assertArrayHasKey('document', $payload);
        $this->assertArrayHasKey('documentType', $payload);
        $this->assertArrayHasKey('editorConfig', $payload);
        $this->assertArrayNotHasKey('payload', $payload, 'Token payload must not be wrapped inside a payload key.');
    }
}
