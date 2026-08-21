<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Student;
use App\Models\User;
use Database\Factories\CourseFactory;
use Database\Factories\StudentFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AttendanceSf2ExportTest extends TestCase
{
    use RefreshDatabase;

    public function test_export_sf2_downloads_official_template_format(): void
    {
        $user = User::factory()->create();
        $course = CourseFactory::new()->create([
            'user_id' => $user->id,
            'section' => '6 - RIZAL',
        ]);
        StudentFactory::new()->create(['course_id' => $course->id, 'gender' => 'male']);
        StudentFactory::new()->create(['course_id' => $course->id, 'gender' => 'female']);

        $response = $this->actingAs($user)->get('/api/attendance/export-sf2?' . http_build_query([
            'course_id' => $course->id,
            'month' => 8,
            'year' => 2026,
        ]));

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/vnd.ms-excel');

        // Filename follows the reference file: SF2_{SY}_{Grade}-{Section}_{Month}.xls
        $this->assertStringContainsString('SF2_2026_Grade 6-RIZAL_August.xls', $response->headers->get('Content-Disposition'));

        // The downloaded workbook must carry the official SF2 layout.
        // BinaryFileResponse::getContent() returns false (no buffered body),
        // so capture the bytes the response actually streams instead.
        $tmp = tempnam(sys_get_temp_dir(), 'sf2test_') . '.xls';
        ob_start();
        $response->sendContent();
        file_put_contents($tmp, ob_get_clean());
        $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($tmp);
        $sheet = $spreadsheet->getSheet(0);

        $this->assertSame('school_form_2_ver2014.2.1.1', $sheet->getTitle());
        $this->assertSame('School Form 2 (SF2) Daily Attendance Report of Learners', $sheet->getCell('A1')->getValue());
        $this->assertSame('AUGUST', $sheet->getCell('AA3')->getValue());
        $this->assertSame('2026 - 2027', $sheet->getCell('M3')->getValue());
        $this->assertSame('GRADE 6', $sheet->getCell('AA4')->getValue());
        $this->assertSame('RIZAL', $sheet->getCell('AM4')->getValue());

        // August 2026 starts on a Saturday → first school day (Mon 3) sits on the first M column.
        $this->assertSame(3, $sheet->getCell('F6')->getValue());
        $this->assertSame(7, $sheet->getCell('K6')->getValue());
        $this->assertNull($sheet->getCell('AK6')->getValue());

        // Section structure: 1 male (row 8), male total (9), 1 female (10), female total (11), combined (12)
        $this->assertSame('<=== MALE | TOTAL Per Day ===>', $sheet->getCell('C9')->getValue());
        $this->assertSame('<=== FEMALE | TOTAL Per Day ===>', $sheet->getCell('C11')->getValue());
        $this->assertSame('Combined TOTAL Per Day', $sheet->getCell('C12')->getValue());
        $this->assertSame(2, $sheet->getCell('A12')->getValue());

        // Layout fidelity: the 47 template column widths and the merge set survive.
        $template = \PhpOffice\PhpSpreadsheet\IOFactory::load(resource_path('templates/sf2_template.xls'))->getSheet(0);
        $widths = fn ($s) => collect($s->getColumnDimensions())->mapWithKeys(fn ($d, $c) => [$c => $d->getWidth()])->all();
        $this->assertSame($widths($template), $widths($sheet));

        unlink($tmp);
    }

    public function test_export_sf2_rejects_foreign_course(): void
    {
        $user = User::factory()->create();
        $course = CourseFactory::new()->create(['user_id' => User::factory()->create()->id]);

        $response = $this->actingAs($user)->get('/api/attendance/export-sf2?' . http_build_query([
            'course_id' => $course->id,
            'month' => 8,
            'year' => 2026,
        ]));

        $response->assertStatus(404);
    }
}
