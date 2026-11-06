<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserDocument;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PersonalDocumentEditorTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_upload_and_list_a_personal_document(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();
        $file = UploadedFile::fake()->create(
            'lesson.docx',
            10,
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );

        $this->actingAs($user)
            ->postJson('/api/documents/personal/upload', ['file' => $file])
            ->assertCreated()
            ->assertJsonPath('extension', 'docx');

        $document = UserDocument::first();
        Storage::disk('local')->assertExists($document->storage_path);

        $this->actingAs($user)
            ->getJson('/api/documents/personal')
            ->assertOk()
            ->assertJsonPath('0.id', $document->id);
    }

    public function test_user_can_create_a_template_and_open_it_in_editor(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/documents/personal/template', ['kind' => 'sf2'])
            ->assertCreated();

        $document = UserDocument::first();
        Storage::disk('local')->assertExists($document->storage_path);

        $this->actingAs($user)
            ->getJson('/api/documents/personal/' . $document->id . '/editor')
            ->assertOk()
            ->assertJsonPath('type', 'personal')
            ->assertJsonPath('documentType', 'cell');
    }

    public function test_user_cannot_open_another_users_personal_document(): void
    {
        Storage::fake('local');
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $document = UserDocument::create([
            'user_id' => $owner->id,
            'title' => 'Private',
            'kind' => 'uploaded',
            'extension' => 'xlsx',
            'storage_path' => 'documents/personal/private.xlsx',
            'mime_type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);

        $this->actingAs($other)
            ->getJson('/api/documents/personal/' . $document->id . '/editor')
            ->assertNotFound();
    }

    public function test_onlyoffice_save_callback_persists_personal_document_changes(): void
    {
        Storage::fake('local');
        config()->set('services.onlyoffice.jwt_secret', '');
        Http::fake(['https://onlyoffice.test/updated.xlsx' => Http::response('updated-file')]);
        $user = User::factory()->create();
        Storage::disk('local')->put('documents/personal/1.xlsx', 'original-file');
        $document = UserDocument::create([
            'user_id' => $user->id,
            'title' => 'Saved File',
            'kind' => 'uploaded',
            'extension' => 'xlsx',
            'storage_path' => 'documents/personal/1.xlsx',
            'mime_type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);

        $this->postJson('/api/documents/onlyoffice/callback?type=personal&id=' . $document->id, [
            'status' => 2,
            'url' => 'https://onlyoffice.test/updated.xlsx',
        ])->assertOk()->assertJson(['error' => 0]);

        Storage::disk('local')->assertExists($document->storage_path);
        $this->assertSame('updated-file', Storage::disk('local')->get($document->storage_path));
        $this->assertSame(2, $document->refresh()->version);
    }
}
