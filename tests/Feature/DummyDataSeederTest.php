<?php

namespace Tests\Feature;

use App\Models\Assessment;
use App\Models\Course;
use App\Models\Student;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Database\Seeders\UserSeeder;
use Tests\TestCase;

class DummyDataSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_seed_creates_realistic_dummy_data(): void
    {
        config([
            'app.seed_user_passwords' => collect(UserSeeder::USERS)
                ->mapWithKeys(fn (array $user) => [$user['email'] => 'test-only-password'])
                ->all(),
        ]);

        $this->artisan('db:seed')->assertSuccessful();

        $this->assertGreaterThan(0, Course::count());
        $this->assertGreaterThan(0, Student::count());
        $this->assertGreaterThan(0, Assessment::count());

        $this->assertDatabaseHas('courses', [
            'trimester' => '2nd-trimester',
        ]);
    }
}
