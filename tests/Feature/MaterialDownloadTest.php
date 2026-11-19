<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Material;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MaterialDownloadTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_view_a_local_material(): void
    {
        Storage::fake('public');

        $user = User::factory()->create();
        $course = Course::factory()->create(['user_id' => $user->id]);
        Storage::disk('public')->put('materials/test.pdf', 'pdf-content');
        $material = Material::create([
            'course_id' => $course->id,
            'title' => 'Test Material',
            'file_path' => 'materials/test.pdf',
        ]);

        $this->actingAs($user)
            ->get("/api/materials/{$material->id}/download")
            ->assertOk();
    }

    public function test_google_material_link_is_redirected(): void
    {
        $user = User::factory()->create();
        $course = Course::factory()->create(['user_id' => $user->id]);
        $material = Material::create([
            'course_id' => $course->id,
            'title' => 'Google Material',
            'source_type' => 'google_classroom',
            'material_type' => 'link',
            'link' => 'https://example.com/material',
        ]);

        $this->actingAs($user)
            ->get("/api/materials/{$material->id}/download")
            ->assertRedirect('https://example.com/material');
    }

    public function test_missing_material_file_returns_not_found(): void
    {
        Storage::fake('public');

        $user = User::factory()->create();
        $course = Course::factory()->create(['user_id' => $user->id]);
        $material = Material::create([
            'course_id' => $course->id,
            'title' => 'Missing Material',
            'file_path' => 'materials/missing.pdf',
        ]);

        $this->actingAs($user)
            ->get("/api/materials/{$material->id}/download")
            ->assertNotFound();
    }
}
