<?php

namespace Tests\Feature\Auth;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    public function test_recovery_page_can_be_rendered(): void
    {
        $this->get('/forgot-password')
            ->assertOk()
            ->assertSee('Recovery Key');
    }

    public function test_email_only_password_reset_is_not_available(): void
    {
        $this->post('/forgot-password', ['email' => 'teacher@example.test'])
            ->assertSessionHasErrors(['recovery_key', 'password']);

        $this->get('/reset-password/any-token')->assertNotFound();
    }
}
