<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;
use App\Models\Course;
use App\Models\AttendanceDocument;
use App\Services\SF2ExportService;
use Illuminate\Support\Facades\Storage;

// Simulate the generate endpoint
$course = Course::with('user')->first();
$user = $course->user;
echo "User: {$user->name} ({$user->id}), Course: {$course->id}\n";

$monthName = date('F', mktime(0,0,0,8,1,2026));
$doc = AttendanceDocument::create([
    'user_id' => $user->id,
    'course_id' => $course->id,
    'month' => 8,
    'year' => 2026,
    'title' => sprintf('SF2 %s %s', trim((string) $course->section), $monthName),
]);
$path = 'documents/attendance-sf2/' . $doc->id . '.xls';
app(SF2ExportService::class)->generate($course, 8, 2026, ['adviser_name' => strtoupper($user->name)], Storage::disk('local')->path($path));
$doc->update(['xls_path' => $path]);

echo "Doc created: id={$doc->id}, key={$doc->docxKey()}\n";
echo "File stored: " . Storage::disk('local')->path($path) . " (" . Storage::disk('local')->size($path) . " bytes)\n";

// Verify stored file is a valid SF2
$ss = \PhpOffice\PhpSpreadsheet\IOFactory::createReaderForFile(Storage::disk('local')->path($path))->load(Storage::disk('local')->path($path));
$sheet = $ss->getSheet(0);
echo "Stored sheet: {$sheet->getTitle()}, merges=" . count($sheet->getMergeCells()) . ", A8=" . $sheet->getCell('A8')->getValue() . ", C8=" . $sheet->getCell('C8')->getValue() . "\n";
echo "AA3 month: " . $sheet->getCell('AA3')->getValue() . ", M3 SY: " . $sheet->getCell('M3')->getValue() . "\n";

// Clean up test doc
$doc->delete();
Storage::disk('local')->delete($path);
echo "Cleaned up test doc.\n";

// Route check
exec('php artisan route:list 2>&1 | grep -E "documents"', $routes);
echo "\nRoutes:\n" . implode("\n", $routes) . "\n";
