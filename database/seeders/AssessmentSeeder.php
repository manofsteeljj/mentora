<?php

namespace Database\Seeders;

use App\Models\Assessment;
use App\Models\Course;
use App\Models\Question;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class AssessmentSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed demo assessments and questions for each demo course.
     */
    public function run(): void
    {
        $faculty = User::where('email', 'faculty@mentora.test')->first();

        $courses = $faculty
            ? Course::where('user_id', $faculty->id)->get()
            : Course::query()->limit(10)->get();

        if ($courses->isEmpty()) {
            $this->command?->warn('No courses found for assessment seeding. Run CourseSeeder first.');
            return;
        }

        $assessmentsCreated = 0;
        $questionsCreated = 0;

        foreach ($courses as $course) {
            $templates = [
                ['type' => 'quiz', 'title' => "{$course->course_code} Quiz 1", 'questions' => 10],
                ['type' => 'quiz', 'title' => "{$course->course_code} Quiz 2", 'questions' => 12],
                ['type' => 'exam', 'title' => "{$course->course_code} Midterm Exam", 'questions' => 20],
            ];

            foreach ($templates as $tpl) {
                $assessment = Assessment::where('course_id', $course->id)
                    ->where('title', $tpl['title'])
                    ->first();

                if (!$assessment) {
                    $assessment = new Assessment();
                    $assessment->course_id = $course->id;
                    $assessment->title = $tpl['title'];
                    $assessment->type = $tpl['type'];
                    $assessment->total_points = 0;
                    $assessment->instructions = 'Answer all questions. Show your work where applicable.';
                    $assessment->max_points = null; // kept for Google sync compatibility
                    $assessment->due_date = now()->addDays(rand(3, 14));
                    $assessment->state = 'PUBLISHED';
                    $assessment->description = 'Seeded assessment for demo data.';
                    $assessment->google_classroom_id = null;
                    $assessment->save();
                    $assessmentsCreated++;
                }

                // Only seed questions once per assessment (idempotent seeding).
                if ($assessment->questions()->count() === 0) {
                    for ($q = 1; $q <= $tpl['questions']; $q++) {
                        $questionType = (rand(1, 100) <= 70) ? 'mcq' : 'essay';
                        $points = ($questionType === 'essay') ? rand(3, 5) : 1;

                        $questionText = $questionType === 'mcq'
                            ? "Q{$q}. " . fake()->sentence(10) . '?'
                            : "Q{$q}. " . fake()->sentence(12) . ' Explain briefly.';

                        Question::create([
                            'assessment_id' => $assessment->id,
                            'question_text' => $questionText,
                            'question_type' => $questionType,
                            'points' => $points,
                        ]);
                        $questionsCreated++;
                    }
                }

                $totalPoints = (int) $assessment->questions()->sum('points');
                // Keep both total_points and max_points in sync for convenience.
                $assessment->total_points = $totalPoints;
                $assessment->max_points = $totalPoints;
                $assessment->save();
            }
        }

        $this->command?->info("Seeded {$assessmentsCreated} assessments and {$questionsCreated} questions");
    }
}
