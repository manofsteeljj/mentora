<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Material;
use App\Models\School;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SchoolTenancyTest extends TestCase
{
    use RefreshDatabase;

    public function test_school_list_contains_the_default_and_testing_schools(): void
    {
        $this->getJson('/api/schools')
            ->assertOk()
            ->assertJsonFragment(['code' => 'MASUPE-ELEM'])
            ->assertJsonFragment(['code' => 'TEST-EVALUATORS']);
    }

    public function test_login_requires_the_selected_school_for_duplicate_accounts(): void
    {
        $masupe = School::where('code', 'MASUPE-ELEM')->firstOrFail();
        $testing = School::where('code', 'TEST-EVALUATORS')->firstOrFail();
        $password = 'password';

        User::factory()->create(['email' => 'shared@example.com', 'password' => $password, 'school_id' => $masupe->id]);
        User::factory()->create(['email' => 'shared@example.com', 'password' => $password, 'school_id' => $testing->id]);

        $this->post('/login', [
            'email' => 'shared@example.com',
            'password' => $password,
            'school_id' => $testing->id,
        ])->assertRedirect('/dashboard');

        $this->assertAuthenticatedAs(User::withoutGlobalScope('school')->where('school_id', $testing->id)->where('email', 'shared@example.com')->firstOrFail());
    }

    public function test_authenticated_user_lookup_does_not_recurse_through_the_school_scope(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get('/api/schools')
            ->assertOk();

        $this->assertSame($user->id, auth()->user()->id);
    }

    public function test_course_material_and_student_queries_are_school_scoped(): void
    {
        Storage::fake('public');
        $masupe = School::where('code', 'MASUPE-ELEM')->firstOrFail();
        $testing = School::where('code', 'TEST-EVALUATORS')->firstOrFail();
        $masupeUser = User::factory()->create(['school_id' => $masupe->id]);
        $testingUser = User::factory()->create(['school_id' => $testing->id]);
        $masupeCourse = Course::create(['user_id' => $masupeUser->id, 'school_id' => $masupe->id, 'course_code' => 'M-1', 'course_name' => 'Masupe']);
        $testingCourse = Course::create(['user_id' => $testingUser->id, 'school_id' => $testing->id, 'course_code' => 'T-1', 'course_name' => 'Testing']);
        Material::create(['course_id' => $testingCourse->id, 'school_id' => $testing->id, 'title' => 'Private', 'file_path' => 'private.pdf']);
        Student::create(['course_id' => $testingCourse->id, 'school_id' => $testing->id, 'student_number' => '1', 'name' => 'Private Student']);

        $this->actingAs($masupeUser);

        $this->assertTrue(Course::whereKey($masupeCourse->id)->exists());
        $this->assertFalse(Course::whereKey($testingCourse->id)->exists());
        $this->assertFalse(Material::where('course_id', $testingCourse->id)->exists());
        $this->assertFalse(Student::where('course_id', $testingCourse->id)->exists());
    }

    public function test_admin_dashboard_activity_is_school_scoped(): void
    {
        $masupe = School::where('code', 'MASUPE-ELEM')->firstOrFail();
        $testing = School::where('code', 'TEST-EVALUATORS')->firstOrFail();
        $evaluator = User::factory()->create([
            'school_id' => $testing->id,
            'role' => 'admin',
        ]);
        $masupeTeacher = User::factory()->create([
            'school_id' => $masupe->id,
            'name' => 'Masupe-only faculty',
        ]);
        $testingTeacher = User::factory()->create([
            'school_id' => $testing->id,
            'name' => 'Evaluator faculty',
        ]);

        $this->actingAs($evaluator)
            ->getJson('/api/dashboard/admin')
            ->assertOk()
            ->assertJsonMissing(['user' => $masupeTeacher->name])
            ->assertJsonFragment(['user' => $testingTeacher->name]);
    }
}
