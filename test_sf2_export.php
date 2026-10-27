<?php

// Test SF2 Export
// Run this with: php test_sf2_export.php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Course;
use App\Services\SF2ExportService;

echo "Testing SF2 Export...\n\n";

// Get first course
$course = Course::with('user')->first();

if (!$course) {
    echo "❌ Error: No courses found.\n";
    exit(1);
}

echo "Course: {$course->course_name}\n";
echo "Section: {$course->section}\n";
echo "ID: {$course->id}\n\n";

// Export parameters
$month = 8;  // August
$year = 2026;

$config = [
    'school_name' => 'Masupe Elementary School',
    'school_id' => '123456',
    'grade_level' => 'Grade 6',
    'adviser_name' => 'ROSEL ELEGORES SANCHEZ',
    'school_head' => 'ROMELYN OAYAS OBALLES',
];

echo "Generating SF2 for August 2026...\n";

try {
    $service = new SF2ExportService();
    $filePath = $service->generate($course, $month, $year, $config);
    
    echo "✅ Success!\n\n";
    echo "File generated at: {$filePath}\n";
    echo "File size: " . filesize($filePath) . " bytes\n";
    
    // Copy to easier location
    $destFile = __DIR__ . '/SF2_Test_Export.xls';
    copy($filePath, $destFile);
    
    echo "\nCopied to: {$destFile}\n";
    echo "\n✅ Open this file in Excel to verify the format!\n";
    
} catch (\Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    echo "\nStack trace:\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
}
