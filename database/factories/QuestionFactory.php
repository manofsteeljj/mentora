<?php

namespace Database\Factories;

use App\Models\Assessment;
use App\Models\Question;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Question>
 */
class QuestionFactory extends Factory
{
    protected $model = Question::class;

    public function definition(): array
    {
        $type = $this->faker->randomElement(['mcq', 'essay']);

        return [
            'assessment_id' => Assessment::factory(),
            'question_type' => $type,
            'question_text' => $this->faker->sentence(12) . '?',
            'points' => $this->faker->numberBetween(2, 10),
            'correct_answer' => $type === 'mcq' ? $this->faker->randomElement(['A', 'B', 'C', 'D']) : null,
            'options' => $type === 'mcq'
                ? ['A' => $this->faker->word(), 'B' => $this->faker->word(), 'C' => $this->faker->word(), 'D' => $this->faker->word()]
                : null,
        ];
    }
}
