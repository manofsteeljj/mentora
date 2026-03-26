<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Optional: generate more users
        // User::factory(10)->create();

        // Create a stable demo account you can log in with.
        User::firstOrCreate(
            ['email' => 'faculty@mentora.test'],
            [
                'name' => 'Faculty Demo',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );

        $this->call([
            CourseSeeder::class,
            StudentSeeder::class,
            AssessmentSeeder::class,
            GradeSeeder::class,
        ]);
    }
}
