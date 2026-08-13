<?php

namespace Tests\Feature;

use App\Models\Assessment;
use App\Models\Course;
use App\Models\Student;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DummyDataSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_seed_creates_realistic_dummy_data(): void
    {
        $this->artisan('db:seed')->assertSuccessful();

        $this->assertGreaterThan(0, Course::count());
        $this->assertGreaterThan(0, Student::count());
        $this->assertGreaterThan(0, Assessment::count());

        $this->assertDatabaseHas('courses', [
            'trimester' => '2nd-trimester',
        ]);
    }
}
