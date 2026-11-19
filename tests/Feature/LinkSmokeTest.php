<?php

namespace Tests\Feature;

use Tests\TestCase;

class LinkSmokeTest extends TestCase
{
    public function test_public_pages_are_reachable(): void
    {
        $this->get('/')->assertStatus(200);
        $this->get('/login')->assertStatus(200);
        $this->get('/register')->assertStatus(200);
        $this->get('/forgot-password')->assertStatus(200);
        $this->get('/support')->assertStatus(200);
        $this->get('/terms')->assertStatus(200);
        $this->get('/privacy')->assertStatus(200);
    }

    public function test_guest_is_redirected_from_protected_pages(): void
    {
        $this->get('/dashboard')->assertRedirect('/login');
        $this->get('/profile')->assertRedirect('/login');
    }

    public function test_google_redirect_reports_missing_configuration(): void
    {
        config([
            'services.google.client_id' => 'your_client_id',
            'services.google.client_secret' => 'your_client_secret',
        ]);

        $this->get('/auth/google/redirect')
            ->assertRedirect('/login')
            ->assertSessionHas('error');
    }
}
