<?php

namespace Database\Seeders;

use App\Models\Course;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class StudentSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database with demo students for demo courses.
     */
    public function run(): void
    {
        $faculty = User::where('email', 'faculty@mentora.test')->first();

        $courses = $faculty
            ? Course::where('user_id', $faculty->id)->get()
            : Course::query()->limit(10)->get();

        if ($courses->isEmpty()) {
            $this->command?->warn('No courses found for student seeding. Run CourseSeeder first.');
            return;
        }

        $totalCreatedOrUpdated = 0;
        $studentsPerCourse = 30;

        foreach ($courses as $courseIndex => $course) {
            for ($i = 1; $i <= $studentsPerCourse; $i++) {
                $studentNumber = sprintf('2026%02d%03d', ($courseIndex + 1), $i);
                $name = fake()->name();
                $email = strtolower(str_replace(' ', '.', $name)) . "+{$course->id}{$i}@student.lorma.edu";

                Student::updateOrCreate(
                    ['course_id' => $course->id, 'student_number' => $studentNumber],
                    [
                        'name' => $name,
                        'email' => $email,
                        'google_classroom_id' => null,
                        'photo_url' => null,
                    ]
                );

                $totalCreatedOrUpdated++;
            }
        }

        $this->command?->info("Seeded {$totalCreatedOrUpdated} demo students across {$courses->count()} course(s)");
    }
}
