<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class RecoveryKeyImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_recovery_keys_can_be_imported_from_csv(): void
    {
        $user = User::factory()->create(['email' => 'teacher@example.test']);
        $path = tempnam(sys_get_temp_dir(), 'recovery-keys-');

        try {
            file_put_contents($path, "email,recovery_key\nteacher@example.test,provided-key\n");

            $this->artisan('users:import-recovery-keys', ['file' => $path])
                ->expectsOutput('Imported recovery keys for 1 account(s).')
                ->assertExitCode(0);

            $this->assertTrue(Hash::check('provided-key', $user->refresh()->recovery_key_hash));
        } finally {
            if (is_file($path)) {
                unlink($path);
            }
        }
    }
}
