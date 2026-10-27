<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CourseTrisemesterTest extends TestCase
{
    use RefreshDatabase;

    public function test_legacy_semester_payload_is_normalized_to_deped_trimester(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/courses', [
            'course_code' => 'ICT101',
            'course_name' => 'ICT Fundamentals',
            'academic_year' => '2025-2026',
            'semester' => '2nd-semester',
        ]);

        $response->assertCreated();
        $response->assertJsonPath('school_year', '2025-2026');
        $response->assertJsonPath('trimester', '2nd-trimester');
        $this->assertDatabaseHas('courses', [
            'user_id' => $user->id,
            'course_code' => 'ICT101',
            'school_year' => '2025-2026',
            'trimester' => '2nd-trimester',
        ]);
    }
}
