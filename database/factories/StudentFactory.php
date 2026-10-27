<?php

namespace Database\Factories;

use App\Models\Course;
use App\Models\Student;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Student>
 */
class StudentFactory extends Factory
{
    protected $model = Student::class;

    public function definition(): array
    {
        return [
            'course_id' => Course::factory(),
            'student_number' => '2026' . $this->faker->unique()->numerify('####'),
            'name' => $this->faker->name(),
            'email' => $this->faker->unique()->safeEmail(),
            'google_classroom_id' => null,
            'photo_url' => null,
        ];
    }
}
