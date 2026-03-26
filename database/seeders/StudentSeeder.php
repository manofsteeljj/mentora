<?php

namespace Database\Seeders;

use App\Models\Course;
use App\Models\Student;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class StudentSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database with dummy students for Account ID #4
     */
    public function run(): void
    {
        // Get all courses for Account ID #4 (user_id = 4)
        $courses = Course::where('user_id', 4)->get();

        // If no courses exist, create a dummy course
        if ($courses->isEmpty()) {
            $course = Course::create([
                'user_id' => 4,
                'course_code' => 'CS101',
                'course_name' => 'Introduction to Computer Science',
                'description' => 'Dummy course for seeding students',
                'section' => 'A',
                'room' => 'Room 101',
                'status' => 'active',
                'academic_term' => '2026 Spring',
            ]);
            $courses = Course::where('user_id', 4)->get();
            $this->command->info('Created dummy course for Account ID #4');
        }

        // Dummy student data
        $studentData = [
            ['number' => '2024001', 'name' => 'Maria Santos', 'email' => 'maria.santos@student.lorma.edu'],
            ['number' => '2024002', 'name' => 'Juan Dela Cruz', 'email' => 'juan.delacruz@student.lorma.edu'],
            ['number' => '2024003', 'name' => 'Ana Garcia', 'email' => 'ana.garcia@student.lorma.edu'],
            ['number' => '2024004', 'name' => 'Carlos Reyes', 'email' => 'carlos.reyes@student.lorma.edu'],
            ['number' => '2024005', 'name' => 'Rosa Mendoza', 'email' => 'rosa.mendoza@student.lorma.edu'],
            ['number' => '2024006', 'name' => 'Miguel Torres', 'email' => 'miguel.torres@student.lorma.edu'],
            ['number' => '2024007', 'name' => 'Sofia Lim', 'email' => 'sofia.lim@student.lorma.edu'],
            ['number' => '2024008', 'name' => 'Ramon Cruz', 'email' => 'ramon.cruz@student.lorma.edu'],
        ];

        // Add students to each course
        foreach ($courses as $course) {
            foreach ($studentData as $data) {
                Student::create([
                    'course_id' => $course->id,
                    'student_number' => $data['number'],
                    'name' => $data['name'],
                    'email' => $data['email'],
                    'google_classroom_id' => null,
                    'photo_url' => null,
                ]);
            }
        }

        $this->command->info('Created ' . count($studentData) * $courses->count() . ' dummy students for Account ID #4');
    }
}
