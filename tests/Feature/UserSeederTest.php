<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UserSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_seeder_creates_the_provided_accounts_with_roles(): void
    {
        $this->seed(UserSeeder::class);

        $this->assertDatabaseCount('users', count(UserSeeder::USERS));

        foreach (UserSeeder::USERS as $seededUser) {
            $user = User::where('email', $seededUser['email'])->firstOrFail();

            $this->assertSame($seededUser['role'], $user->role);
            $this->assertSame('active', $user->status);
            $this->assertTrue($user->isAdmin() === in_array($seededUser['role'], ['admin', 'developer'], true));
            $this->assertTrue(Hash::check($seededUser['password'], $user->password));
        }

        $this->seed(UserSeeder::class);
        $this->assertDatabaseCount('users', count(UserSeeder::USERS));
    }
}
