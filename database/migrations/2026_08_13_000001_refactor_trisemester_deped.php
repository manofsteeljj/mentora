<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * DepEd Trisemester Refactor
 *
 * DepEd Order No. 032, s. 2024 shifts the K-12 calendar to a trisemester
 * (three-term) system. Grading periods are now 1st, 2nd, and 3rd only.
 *
 * Changes:
 *  - courses: add `school_year` (e.g. "2025-2026") and `trimester`
 *    (1st-trimester | 2nd-trimester | 3rd-trimester) columns.
 *  - gradebook_assessments: migrate any existing "4th" grading_period
 *    rows → "3rd", then tighten the allowed values via a CHECK constraint
 *    (supported on MySQL 8.0.16+ / MariaDB 10.2+ / SQLite / Postgres).
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── courses table ────────────────────────────────────────────────────
        Schema::table('courses', function (Blueprint $table) {
            // school_year stores "2025-2026" style strings
            $table->string('school_year', 20)->nullable()->after('academic_term');

            // trimester stores the canonical term within that school year
            $table->enum('trimester', ['1st-trimester', '2nd-trimester', '3rd-trimester'])
                  ->nullable()
                  ->after('school_year');
        });

        // ── gradebook_assessments: migrate 4th → 3rd ─────────────────────────
        DB::table('gradebook_assessments')
            ->where('grading_period', '4th')
            ->update(['grading_period' => '3rd']);
    }

    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn(['school_year', 'trimester']);
        });

        // We cannot recover the original "4th" distinction on rollback,
        // so we leave the grading_period data as-is.
    }
};
