<?php

namespace Database\Factories;

use App\Models\Course;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Course>
 */
class CourseFactory extends Factory
{
    protected $model = Course::class;

    public function definition(): array
    {
        $trimester = $this->faker->randomElement(['1st-trimester', '2nd-trimester', '3rd-trimester']);

        return [
            'user_id' => User::factory(),
            'course_code' => strtoupper($this->faker->bothify('CS###')),
            'course_name' => $this->faker->randomElement([
                'Information and Communication Technology',
                'General Mathematics',
                'English for Academic Purposes',
                'Science and Technology',
                'Reading and Writing Skills',
            ]),
            'description' => $this->faker->sentence(10),
            'section' => $this->faker->randomElement(['A', 'B', 'C', 'D']),
            'room' => 'Room ' . $this->faker->numberBetween(101, 410),
            'status' => 'ACTIVE',
            'school_year' => '2025-2026',
            'trimester' => $trimester,
            'academic_term' => '2025-2026 / ' . ucfirst(str_replace('-trimester', ' Trimester', $trimester)),
            'last_synced_at' => now(),
        ];
    }
}
