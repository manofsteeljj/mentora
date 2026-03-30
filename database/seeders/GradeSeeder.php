<?php

namespace Database\Seeders;

use App\Models\Assessment;
use App\Models\Course;
use App\Models\Grade;
use App\Models\Question;
use App\Models\Student;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class GradeSeeder extends Seeder
{
    use WithoutModelEvents;

    private function randFloat(float $min, float $max): float
    {
        return $min + (mt_rand() / mt_getrandmax()) * ($max - $min);
    }

    /**
     * Seed demo submissions + per-question grades ("activities") for assessments.
     */
    public function run(): void
    {
        $faculty = User::where('email', 'faculty@mentora.test')->first();

        $courses = $faculty
            ? Course::where('user_id', $faculty->id)->get()
            : Course::query()->limit(10)->get();

        if ($courses->isEmpty()) {
            $this->command?->warn('No courses found for grade seeding. Run CourseSeeder first.');
            return;
        }

        $submissionsTouched = 0;
        $gradesTouched = 0;

        foreach ($courses as $course) {
            $assessments = Assessment::where('course_id', $course->id)->get();
            if ($assessments->isEmpty()) {
                continue;
            }

            $students = Student::where('course_id', $course->id)->inRandomOrder()->get();
            if ($students->isEmpty()) {
                continue;
            }

            // Assign performance tiers so we get a realistic distribution.
            // Top: 10% (85-100%), Above: 20% (70-84%), Average: 40% (55-69%), Below: 20% (40-54%), Low: 10% (10-39%)
            $studentIds = $students->pluck('id')->all();
            shuffle($studentIds);
            $count = count($studentIds);
            $tierSizes = [
                'top' => (int) round($count * 0.10),
                'above' => (int) round($count * 0.20),
                'avg' => (int) round($count * 0.40),
                'below' => (int) round($count * 0.20),
                'low' => $count, // fill remainder
            ];
            $tierRanges = [
                'top' => [0.85, 1.00],
                'above' => [0.70, 0.84],
                'avg' => [0.55, 0.69],
                'below' => [0.40, 0.54],
                'low' => [0.10, 0.39],
            ];
            $tierByStudentId = [];
            $cursor = 0;
            foreach (['top', 'above', 'avg', 'below'] as $tier) {
                $size = $tierSizes[$tier];
                for ($i = 0; $i < $size && $cursor < $count; $i++, $cursor++) {
                    $tierByStudentId[$studentIds[$cursor]] = $tier;
                }
            }
            while ($cursor < $count) {
                $tierByStudentId[$studentIds[$cursor]] = 'low';
                $cursor++;
            }

            foreach ($assessments as $assessment) {
                $questions = Question::where('assessment_id', $assessment->id)->get();
                if ($questions->isEmpty()) {
                    continue;
                }

                foreach ($students as $student) {
                    $tier = $tierByStudentId[$student->id] ?? 'avg';
                    [$tierMin, $tierMax] = $tierRanges[$tier];

                    // Small per-student variability so not all scores look identical.
                    $studentBias = $this->randFloat(-0.04, 0.04);
                    $targetMin = max(0.0, $tierMin + $studentBias);
                    $targetMax = min(1.0, $tierMax + $studentBias);

                    $submission = Submission::updateOrCreate(
                        ['student_id' => $student->id, 'assessment_id' => $assessment->id],
                        [
                            'google_classroom_id' => null,
                            'state' => 'TURNED_IN',
                            'assigned_grade' => null,
                            'draft_grade' => null,
                            'late' => (rand(1, 100) <= 10),
                            'submitted_at' => now()->subDays(rand(0, 10))->subMinutes(rand(0, 59)),
                            'feedback' => null,
                        ]
                    );
                    $submissionsTouched++;

                    $earned = 0;
                    $possible = 0;

                    foreach ($questions as $question) {
                        $possible += (int) ($question->points ?? 0);
                        $maxPoints = (int) ($question->points ?? 0);

                        // Generate a score around the student's target range.
                        // Add per-question noise so it feels natural.
                        $percent = $this->randFloat($targetMin, $targetMax) + $this->randFloat(-0.08, 0.08);
                        $percent = max(0.0, min(1.0, $percent));
                        $score = $maxPoints === 0 ? 0 : (int) round($maxPoints * $percent);
                        $score = max(0, min($maxPoints, $score));
                        $earned += $score;

                        $answer = null;
                        if ($question->question_type === 'essay') {
                            $answer = ($tier === 'low' && $this->randFloat(0, 1) < 0.25)
                                ? null
                                : fake()->paragraph(2);
                        } elseif ($question->question_type === 'mcq') {
                            $answer = ['A', 'B', 'C', 'D'][rand(0, 3)];
                        }

                        Grade::updateOrCreate(
                            ['submission_id' => $submission->id, 'question_id' => $question->id],
                            [
                                'student_answer' => $answer,
                                'score' => $score,
                            ]
                        );
                        $gradesTouched++;
                    }

                    $submission->assigned_grade = $earned;
                    $submission->draft_grade = $earned;
                    if ($possible > 0) {
                        $ratio = $earned / $possible;
                        $submission->feedback = $ratio >= 0.85
                            ? 'Excellent work. Strong mastery of the topic.'
                            : ($ratio >= 0.70
                                ? 'Good work. Keep it up!'
                                : ($ratio >= 0.55
                                    ? 'Fair attempt. Review key concepts to improve.'
                                    : 'Needs improvement. Please review the materials and try again.'));
                    } else {
                        $submission->feedback = null;
                    }
                    $submission->save();
                }
            }
        }

        $this->command?->info("Seeded {$submissionsTouched} submissions and {$gradesTouched} grades");
    }
}
