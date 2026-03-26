<?php

namespace Database\Seeders;

use App\Models\Course;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class CourseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed demo courses for a known faculty user.
     */
    public function run(): void
    {
        $faculty = User::firstOrCreate(
            ['email' => 'faculty@mentora.test'],
            [
                'name' => 'Faculty Demo',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );

        $courses = [
            ['course_code' => 'CS101', 'course_name' => 'Introduction to Computer Science'],
            ['course_code' => 'IT202', 'course_name' => 'Web Development Fundamentals'],
            ['course_code' => 'DS305', 'course_name' => 'Data Structures & Algorithms'],
            ['course_code' => 'SE210', 'course_name' => 'Software Engineering'],
            ['course_code' => 'AI410', 'course_name' => 'Applied AI in Education'],
        ];

        foreach ($courses as $index => $data) {
            Course::updateOrCreate(
                ['user_id' => $faculty->id, 'course_code' => $data['course_code']],
                [
                    'google_classroom_id' => null,
                    'course_name' => $data['course_name'],
                    'description' => 'Seeded demo course for Mentora.',
                    'section' => chr(ord('A') + $index),
                    'room' => 'Room ' . (100 + $index),
                    'status' => 'ACTIVE',
                    'academic_term' => 'AY 2025-2026 / 2nd Semester',
                    'last_synced_at' => now(),
                ]
            );
        }

        $this->command?->info('Seeded demo courses for faculty@mentora.test');
    }
}
