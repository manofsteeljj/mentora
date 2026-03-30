<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add Google Classroom sync fields to assessments and submissions.
     */
    public function up(): void
    {
        Schema::table('assessments', function (Blueprint $table) {
            $table->string('google_classroom_id')->nullable()->after('id');
            $table->integer('max_points')->nullable()->after('instructions');
            $table->timestamp('due_date')->nullable()->after('max_points');
            $table->string('state')->nullable()->after('due_date');
            $table->text('description')->nullable()->after('state');
        });

        // Make type nullable so Google Classroom imports (which don't have quiz/exam) work
        \Illuminate\Support\Facades\DB::statement("ALTER TABLE assessments MODIFY `type` ENUM('quiz','exam') NULL DEFAULT NULL");

        Schema::table('submissions', function (Blueprint $table) {
            $table->string('google_classroom_id')->nullable()->after('id');
            $table->string('state')->nullable()->after('assessment_id');
            $table->decimal('assigned_grade', 8, 2)->nullable()->after('state');
            $table->decimal('draft_grade', 8, 2)->nullable()->after('assigned_grade');
            $table->boolean('late')->default(false)->after('draft_grade');
            $table->timestamp('submitted_at')->nullable()->after('late');
            $table->text('feedback')->nullable()->after('submitted_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('assessments', function (Blueprint $table) {
            $table->dropColumn(['google_classroom_id', 'max_points', 'due_date', 'state', 'description']);
        });

        Schema::table('submissions', function (Blueprint $table) {
            $table->dropColumn(['google_classroom_id', 'state', 'assigned_grade', 'draft_grade', 'late', 'submitted_at', 'feedback']);
        });
    }
};
