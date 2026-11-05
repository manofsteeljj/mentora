<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class RecoveryPasswordTest extends TestCase
{
    use RefreshDatabase;

    public function test_recovery_page_can_be_rendered(): void
    {
        $this->get('/forgot-password')
            ->assertOk()
            ->assertSee('Recovery Key');
    }

    public function test_password_can_be_recovered_with_the_users_recovery_key(): void
    {
        $user = User::factory()->create();
        $user->forceFill(['recovery_key_hash' => Hash::make('user-recovery-key')])->save();

        $this->post('/forgot-password', [
            'email' => $user->email,
            'recovery_key' => 'user-recovery-key',
            'password' => 'a-new-secure-password',
            'password_confirmation' => 'a-new-secure-password',
        ])
            ->assertRedirect(route('password.request'))
            ->assertSessionHas('status');

        $this->assertTrue(Hash::check('a-new-secure-password', $user->refresh()->password));
    }

    public function test_password_cannot_be_recovered_with_an_invalid_key(): void
    {
        $user = User::factory()->create();
        $user->forceFill(['recovery_key_hash' => Hash::make('user-recovery-key')])->save();

        $this->from('/forgot-password')->post('/forgot-password', [
            'email' => $user->email,
            'recovery_key' => 'wrong-key',
            'password' => 'a-new-secure-password',
            'password_confirmation' => 'a-new-secure-password',
        ])
            ->assertRedirect('/forgot-password')
            ->assertSessionHasErrors('recovery_key')
            ->assertSessionMissing('_old_input.recovery_key');

        $this->assertTrue(Hash::check('password', $user->refresh()->password));
    }

    public function test_legacy_email_reset_routes_are_not_available(): void
    {
        $this->get('/reset-password/any-token')->assertNotFound();
        $this->post('/reset-password')->assertNotFound();
    }
}
