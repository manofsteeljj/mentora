<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Course;
use App\Models\Student;
use App\Models\Attendance;
use App\Services\SF2ExportService;

// Find a course with students
$course = Course::withCount('students')->has('students')->first();
if (!$course) {
    $course = Course::first();
    echo "No course with students; using course id=" . ($course?->id ?? 'none') . "\n";
}

echo "Course: {$course->id} — {$course->course_name} / section={$course->section}\n";
echo "Students: " . Student::where('course_id', $course->id)->count() . "\n";
echo "Genders: " . Student::where('course_id', $course->id)->selectRaw('gender, count(*) as c')->groupBy('gender')->get()->map(fn($r) => "{$r->gender}={$r->c}")->implode(', ') . "\n";
echo "Attendance records: " . Attendance::where('course_id', $course->id)->count() . "\n";

$service = new SF2ExportService();
$out = __DIR__ . '/SF2_Test_Export_New.xls';
$service->generate($course, 8, 2026, [
    'school_name' => 'Masupe Elementary School',
    'school_id' => '100882',
    'grade_level' => 'Grade 6',
    'adviser_name' => strtoupper($course->user->name ?? 'TEST ADVISER'),
    'school_head' => 'ROMELYN OAYAS OBALLES',
], $out);

echo "Generated: $out (" . filesize($out) . " bytes)\n";

// Dump the generated file for verification
$ss = \PhpOffice\PhpSpreadsheet\IOFactory::createReaderForFile($out)->load($out);
$sheet = $ss->getSheet(0);
echo "Sheet: {$sheet->getTitle()}\n";
echo "Merges: " . count($sheet->getMergeCells()) . "\n";

echo "--- KEY CELLS ---\n";
$cells = ['A1','F3','M3','AA3','F4','AA4','AM4','A5','C5','F6','H6','K6','L6','AM7','AO7',
          'A8','C8','AM8','AO8','A15','C15','A16','C16','A23','C23','A24','C24','AM24','AO24',
          'AM25','AP25','AR27','AS27','AT27','AR29','AT29','AR33','AT33','AR35','AT35','AR37','AT37','AR39','AT39','AR40','AT40','AN50','AN56','Z57'];
foreach ($cells as $c) {
    $v = $sheet->getCell($c)->getValue();
    echo "$c: " . str_replace("\n", '\\n', (string)$v) . "\n";
}
echo "--- ROW 6 DATES (F..AK) ---\n";
$dates = [];
foreach (['F','H','I','J','K','L','N','O','P','Q','R','T','U','V','X','Z','AB','AC','AD','AE','AF','AG','AI','AJ','AK'] as $col) {
    $v = $sheet->getCell($col . '6')->getValue();
    if ($v !== null && $v !== '') $dates[] = "$col=$v";
}
echo implode(' ', $dates) . "\n";
echo "--- STUDENT NAMES (col C, rows 8-30) ---\n";
for ($r = 8; $r <= 30; $r++) {
    $v = $sheet->getCell('C' . $r)->getValue();
    $a = $sheet->getCell('A' . $r)->getValue();
    if ($v) echo "Row $r [A=$a]: $v\n";
}
echo "--- MERGES rows 8-30 ---\n";
foreach ($sheet->getMergeCells() as $m) {
    if (preg_match('/^([A-Z]+)(\d+):/', $m, $mm) && $mm[2] >= 8 && $mm[2] <= 30) echo $m . ' ';
}
echo "\n";
echo "--- ROW HEIGHTS 8-30 ---\n";
$hs = [];
foreach ($sheet->getRowDimensions() as $r => $d) { if ($r >= 8 && $r <= 30) $hs[] = "$r={$d->getRowHeight()}"; }
echo implode(' ', $hs) . "\n";
