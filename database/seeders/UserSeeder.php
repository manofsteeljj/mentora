<?php

namespace Database\Seeders;

use App\Models\School;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public const USERS = [
        ['name' => 'Mentora Developer', 'email' => 'dev@mentora-mes.tech', 'password' => 'DevAccess#2026!', 'role' => 'developer'],
        ['name' => 'School Principal', 'email' => 'principal@mentora-mes.tech', 'password' => 'principal26', 'role' => 'admin'],
        ['name' => 'Romelyn O. Oballes', 'email' => 'oballes@mentora-mes.tech', 'password' => 'oballes26', 'role' => 'admin'],
        ['name' => 'Joy O. Dela Peña', 'email' => 'delapena@mentora-mes.tech', 'password' => 'delapena26', 'role' => 'admin'],
        ['name' => 'Avelina O. Gavina', 'email' => 'gavina@mentora-mes.tech', 'password' => 'gavina26', 'role' => 'teacher'],
        ['name' => 'Rosel E. Sanchez', 'email' => 'sanchez@mentora-mes.tech', 'password' => 'sanchez26', 'role' => 'teacher'],
        ['name' => 'Lorna C. Saculles', 'email' => 'saculles@mentora-mes.tech', 'password' => 'saculles26', 'role' => 'teacher'],
        ['name' => 'Norwinda R. Valdez', 'email' => 'valdez@mentora-mes.tech', 'password' => 'valdez26', 'role' => 'teacher'],
        ['name' => 'Ofelia O. Olidan', 'email' => 'olidan@mentora-mes.tech', 'password' => 'olidan26', 'role' => 'teacher'],
        ['name' => 'Nora O. Castro', 'email' => 'castro@mentora-mes.tech', 'password' => 'castro26', 'role' => 'teacher'],
        ['name' => 'Glomie N. Almojuela', 'email' => 'almojuela@mentora-mes.tech', 'password' => 'almojuela26', 'role' => 'teacher'],
        ['name' => 'Anne Margaret Leilani U. Bagaoisan', 'email' => 'bagaoisan@mentora-mes.tech', 'password' => 'bagaoisan26', 'role' => 'teacher'],
        ['name' => 'Jenniger S. Palarca', 'email' => 'palarca@mentora-mes.tech', 'password' => 'palarca26', 'role' => 'teacher'],
        ['name' => 'Noemi B. Espiritu', 'email' => 'espiritu@mentora-mes.tech', 'password' => 'espiritu26', 'role' => 'teacher'],
        ['name' => 'Mhelba C. Rodelas', 'email' => 'rodelas@mentora-mes.tech', 'password' => 'rodelas26', 'role' => 'teacher'],
        ['name' => 'Herson O. Gavina', 'email' => 'herson.gavina@mentora-mes.tech', 'password' => 'hgavina26', 'role' => 'teacher'],
        ['name' => 'Mary Grace H. Cañero', 'email' => 'canero@mentora-mes.tech', 'password' => 'canero26', 'role' => 'teacher'],
        ['name' => 'Testing Evaluator Admin', 'email' => 'evaluator@mentora-mes.tech', 'password' => 'evaluator26', 'role' => 'admin', 'school_code' => 'TEST-EVALUATORS'],
    ];

    public function run(): void
    {
        foreach (self::USERS as $user) {
            $schoolCode = $user['school_code'] ?? 'MASUPE-ELEM';
            $schoolId = School::where('code', $schoolCode)->value('id');
            $attributes = $user;
            unset($attributes['school_code']);

            User::updateOrCreate(
                ['school_id' => $schoolId, 'email' => $user['email']],
                [
                    ...$attributes,
                    'school_id' => $schoolId,
                    'password' => Hash::make($user['password']),
                    'status' => 'active',
                    'email_verified_at' => now(),
                ]
            );
        }
    }
}
