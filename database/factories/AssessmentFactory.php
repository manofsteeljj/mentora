<?php

namespace Database\Factories;

use App\Models\Assessment;
use App\Models\Course;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Assessment>
 */
class AssessmentFactory extends Factory
{
    protected $model = Assessment::class;

    public function definition(): array
    {
        return [
            'course_id' => Course::factory(),
            'title' => $this->faker->randomElement([
                'Quiz 1',
                'Performance Task',
                'Long Quiz',
                'Unit Test',
                'Midterm Exam',
            ]),
            'instructions' => $this->faker->sentence(12),
            'max_points' => $this->faker->numberBetween(20, 100),
            'due_date' => now()->addDays($this->faker->numberBetween(3, 21)),
            'state' => 'PUBLISHED',
            'description' => $this->faker->paragraph(),
            'google_classroom_id' => null,
        ];
    }
}
