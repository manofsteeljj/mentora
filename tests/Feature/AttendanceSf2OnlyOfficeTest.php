<?php

namespace Tests\Feature;

use App\Models\AttendanceDocument;
use App\Models\Course;
use App\Models\Student;
use App\Models\User;
use Database\Factories\CourseFactory;
use Database\Factories\StudentFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AttendanceSf2OnlyOfficeTest extends TestCase
{
    use RefreshDatabase;

    private function makeCourseWithStudents(User $user, int $males = 2, int $females = 1): Course
    {
        $course = CourseFactory::new()->create([
            'user_id' => $user->id,
            'section' => '6 - RIZAL',
        ]);

        for ($i = 0; $i < $males; $i++) {
            StudentFactory::new()->create(["course_id" => $course->id, "gender" => "male"]);
        }
        for ($i = 0; $i < $females; $i++) {
            StudentFactory::new()->create(["course_id" => $course->id, "gender" => "female"]);
        }

        return $course;
    }

    public function test_teacher_can_generate_sf2_for_onlyoffice(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();
        $course = $this->makeCourseWithStudents($user);

        $response = $this->actingAs($user)->postJson('/api/documents/attendance-sf2/generate', [
            'course_id' => $course->id,
            'month' => 8,
            'year' => 2026,
        ]);

        $response->assertCreated();
        $response->assertJsonPath('type', 'attendance-sf2');
        $response->assertJsonPath('extension', 'xls');

        $docId = $response->json('id');
        $this->assertDatabaseHas('attendance_documents', [
            'id' => $docId,
            'user_id' => $user->id,
            'course_id' => $course->id,
            'month' => 8,
            'year' => 2026,
        ]);

        // The stored workbook must be a real SF2 built from the official template.
        Storage::disk('local')->assertExists("documents/attendance-sf2/{$docId}.xls");
        $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load(
            Storage::disk('local')->path("documents/attendance-sf2/{$docId}.xls")
        );
        $sheet = $spreadsheet->getSheet(0);
        $this->assertSame('school_form_2_ver2014.2.1.1', $sheet->getTitle());
        $this->assertSame('AUGUST', $sheet->getCell('AA3')->getValue());
        $this->assertSame('GRADE 6', $sheet->getCell('AA4')->getValue());
        $this->assertSame('RIZAL', $sheet->getCell('AM4')->getValue());
        // 2 males (rows 8-9), male total (10), 1 female (11), female total (12), combined (13)
        $this->assertSame('<=== MALE | TOTAL Per Day ===>', $sheet->getCell('C10')->getValue());
        $this->assertSame('<=== FEMALE | TOTAL Per Day ===>', $sheet->getCell('C12')->getValue());
        $this->assertSame('Combined TOTAL Per Day', $sheet->getCell('C13')->getValue());
    }

    public function test_owner_can_open_generated_sf2_editor_config(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();
        $course = $this->makeCourseWithStudents($user);

        $doc = AttendanceDocument::create([
            'user_id' => $user->id,
            'course_id' => $course->id,
            'month' => 8,
            'year' => 2026,
            'title' => 'SF2 6 - RIZAL August',
            'xls_path' => 'documents/attendance-sf2/1.xls',
        ]);
        Storage::disk('local')->put($doc->xls_path, 'fake-xls-bytes');

        $response = $this->actingAs($user)->getJson('/api/documents/attendance-sf2/' . $doc->id . '/editor');

        $response->assertOk();
        $response->assertJsonPath('id', $doc->id);
        $response->assertJsonPath('type', 'attendance-sf2');
        $response->assertJsonPath('documentType', 'cell');
        $response->assertJsonPath('config.document.fileType', 'xls');
    }

    public function test_other_user_cannot_open_generated_sf2(): void
    {
        Storage::fake('local');
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $course = $this->makeCourseWithStudents($owner);

        $doc = AttendanceDocument::create([
            'user_id' => $owner->id,
            'course_id' => $course->id,
            'month' => 8,
            'year' => 2026,
            'title' => 'SF2 Owner Report',
            'xls_path' => 'documents/attendance-sf2/1.xls',
        ]);
        Storage::disk('local')->put($doc->xls_path, 'fake-xls-bytes');

        $response = $this->actingAs($other)->getJson('/api/documents/attendance-sf2/' . $doc->id . '/editor');

        $response->assertForbidden();
    }

    public function test_sf2_generate_requires_own_course(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();
        $someoneElsesCourse = $this->makeCourseWithStudents(User::factory()->create());

        $response = $this->actingAs($user)->postJson('/api/documents/attendance-sf2/generate', [
            'course_id' => $someoneElsesCourse->id,
            'month' => 8,
            'year' => 2026,
        ]);

        $response->assertStatus(404);
    }
}
