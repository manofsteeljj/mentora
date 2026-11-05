<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserRoleAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_and_developer_roles_can_access_admin_dashboard(): void
    {
        foreach (['admin', 'developer'] as $role) {
            $user = User::factory()->create(['role' => $role]);

            $this->actingAs($user)
                ->getJson('/api/dashboard/admin')
                ->assertOk();
        }
    }

    public function test_teacher_cannot_access_admin_dashboard(): void
    {
        $teacher = User::factory()->create(['role' => 'teacher']);

        $this->actingAs($teacher)
            ->getJson('/api/dashboard/admin')
            ->assertForbidden();
    }
}
