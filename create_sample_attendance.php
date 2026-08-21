<?php

// Run this with: php create_sample_attendance.php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\Course;
use App\Models\Student;
use App\Models\Attendance;

echo "Creating sample attendance data...\n";

// Get first course
$course = Course::first();

if (!$course) {
    echo "Error: No courses found. Please create a course first.\n";
    exit(1);
}

echo "Using course: {$course->course_name} (ID: {$course->id})\n";

// Get students for this course
$students = Student::where('course_id', $course->id)->get();

if ($students->isEmpty()) {
    echo "Error: No students found in this course.\n";
    exit(1);
}

echo "Found {$students->count()} students\n";

// Create attendance for August 2026 (first 10 weekdays)
$year = 2026;
$month = 8;
$daysToCreate = 10;
$created = 0;

for ($day = 1; $day <= 31 && $created < $daysToCreate; $day++) {
    $date = sprintf('%04d-%02d-%02d', $year, $month, $day);
    $dayOfWeek = date('N', strtotime($date)); // 1=Monday, 7=Sunday
    
    // Skip weekends
    if ($dayOfWeek >= 6) {
        continue;
    }
    
    echo "Creating attendance for {$date}...\n";
    
    foreach ($students as $student) {
        // Vary the status for testing
        $status = 'present';
        
        if ($student->id % 7 == 0) {
            $status = 'absent';
        } elseif ($student->id % 5 == 0) {
            $status = 'late';
        } elseif ($student->id % 11 == 0) {
            $status = 'excused';
        }
        
        Attendance::create([
            'course_id' => $course->id,
            'student_id' => $student->id,
            'date' => $date,
            'status' => $status,
            'remarks' => null,
        ]);
    }
    
    $created++;
}

$totalAttendance = Attendance::count();
echo "\n✅ Done! Created attendance records for {$created} days.\n";
echo "Total attendance records: {$totalAttendance}\n";
echo "\nYou can now test the SF2 export with:\n";
echo "Course ID: {$course->id}\n";
echo "Month: 8 (August)\n";
echo "Year: 2026\n";
