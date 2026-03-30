<?php

namespace Database\Seeders;

use App\Models\Attendance;
use App\Models\Course;
use App\Models\ExcuseLetter;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class AttendanceSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::where('email', 'faculty@mentora.test')->first();
        if (!$user) {
            $this->command?->warn('AttendanceSeeder: demo user not found, skipping');
            return;
        }

        $courses = Course::where('user_id', $user->id)->get();
        if ($courses->isEmpty()) {
            $this->command?->warn('AttendanceSeeder: no courses found, skipping');
            return;
        }

        $start = now()->subDays(20)->startOfDay();
        $days = 14; // seed 2 weeks

        $attendanceCount = 0;
        $excuseCount = 0;

        foreach ($courses as $course) {
            $students = Student::where('course_id', $course->id)->get();
            if ($students->isEmpty()) continue;

            for ($d = 0; $d < $days; $d++) {
                $date = $start->copy()->addDays($d);
                // Skip weekends to make it feel like class days.
                if (in_array($date->dayOfWeekIso, [6, 7], true)) continue;

                foreach ($students as $student) {
                    // Weighted distribution: mostly present.
                    $roll = random_int(1, 100);
                    $status = 'present';
                    if ($roll <= 8) $status = 'late';
                    elseif ($roll <= 14) $status = 'absent';
                    elseif ($roll <= 18) $status = 'excused';

                    $attendance = Attendance::updateOrCreate(
                        [
                            'course_id' => $course->id,
                            'student_id' => $student->id,
                            'date' => $date->toDateString(),
                        ],
                        [
                            'status' => $status,
                            'remarks' => $status === 'late' ? 'Arrived late' : null,
                        ]
                    );
                    $attendanceCount++;

                    // Add occasional excuse letters for absent/excused.
                    if (in_array($status, ['absent', 'excused'], true) && random_int(1, 100) <= 12) {
                        $letterStatus = random_int(1, 100) <= 60 ? 'pending' : (random_int(0, 1) ? 'approved' : 'rejected');
                        $submittedDate = $date->copy()->subDays(random_int(0, 2))->toDateString();

                        $reason = $letterStatus === 'approved'
                            ? 'Medical appointment'
                            : 'Family emergency';

                        $attachments = random_int(0, 1)
                            ? ['medical-certificate.pdf']
                            : ['supporting-document.jpg'];

                        $excuse = ExcuseLetter::updateOrCreate(
                            ['attendance_id' => $attendance->id],
                            [
                                'submitted_date' => $submittedDate,
                                'reason' => $reason,
                                'attachments' => $attachments,
                                'status' => $letterStatus,
                                'reviewed_by' => $letterStatus === 'pending' ? null : $user->name,
                                'review_date' => $letterStatus === 'pending' ? null : $date->toDateString(),
                                'review_notes' => $letterStatus === 'pending' ? null : ($letterStatus === 'approved' ? 'Approved' : 'Rejected'),
                            ]
                        );
                        $excuseCount++;

                        // Keep attendance consistent.
                        if ($excuse->status === 'approved') {
                            $attendance->status = 'excused';
                            $attendance->save();
                        } elseif ($excuse->status === 'rejected') {
                            $attendance->status = 'absent';
                            $attendance->save();
                        }
                    }
                }
            }
        }

        $this->command?->info("Seeded {$attendanceCount} attendance records and {$excuseCount} excuse letters");
    }
}
