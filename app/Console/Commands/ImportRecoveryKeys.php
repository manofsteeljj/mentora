<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class ImportRecoveryKeys extends Command
{
    protected $signature = 'users:import-recovery-keys {file : CSV file with email,recovery_key columns}';

    protected $description = 'Import per-account password recovery keys from a CSV file';

    public function handle(): int
    {
        $path = $this->argument('file');

        if (! is_file($path) || ! is_readable($path)) {
            $this->error('The CSV file does not exist or cannot be read.');

            return self::FAILURE;
        }

        $file = fopen($path, 'r');
        if ($file === false) {
            $this->error('The CSV file could not be opened.');

            return self::FAILURE;
        }

        try {
            $headers = fgetcsv($file);
            if ($headers === false) {
                $this->error('The CSV file is empty.');

                return self::FAILURE;
            }

            $headers[0] = preg_replace('/^\xEF\xBB\xBF/', '', (string) $headers[0]);
            $headers = array_map(static fn ($header) => trim((string) $header), $headers);

            if ($headers !== ['email', 'recovery_key']) {
                $this->error('CSV headers must be exactly: email,recovery_key');

                return self::FAILURE;
            }

            $updates = [];
            $seenEmails = [];
            $line = 1;

            while (($row = fgetcsv($file)) !== false) {
                $line++;

                if ($row === [null] || $row === []) {
                    continue;
                }

                if (count($row) !== 2) {
                    $this->error("Invalid CSV row at line {$line}; expected email and recovery_key.");

                    return self::FAILURE;
                }

                $email = mb_strtolower(trim((string) $row[0]));
                $recoveryKey = trim((string) $row[1]);

                if (! filter_var($email, FILTER_VALIDATE_EMAIL) || $recoveryKey === '') {
                    $this->error("Invalid email or missing recovery key at line {$line}.");

                    return self::FAILURE;
                }

                if (isset($seenEmails[$email])) {
                    $this->error("Duplicate email at line {$line}.");

                    return self::FAILURE;
                }
                $seenEmails[$email] = true;

                $user = User::whereRaw('LOWER(email) = ?', [$email])->first();
                if (! $user) {
                    $this->error("No account found for the email at line {$line}.");

                    return self::FAILURE;
                }

                $updates[] = [$user, $recoveryKey];
            }

            if ($updates === []) {
                $this->error('The CSV contains no recovery keys to import.');

                return self::FAILURE;
            }

            DB::transaction(function () use ($updates): void {
                foreach ($updates as [$user, $recoveryKey]) {
                    $user->forceFill([
                        'recovery_key_hash' => Hash::make($recoveryKey),
                    ])->save();
                }
            });

            $this->info('Imported recovery keys for '.count($updates).' account(s).');

            return self::SUCCESS;
        } finally {
            fclose($file);
        }
    }
}
