<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add missing performance indexes.
 *
 * Covers the hot query paths identified in the optimization audit:
 *  - chats.conversation_id  — loaded on every history request
 *  - chats.user_id          — fallback query for orphaned chats
 *  - conversations.user_id  — loaded on every conversations list
 *  - students.google_classroom_id — looked up on every Google sync
 *  - assessments.google_classroom_id — looked up on every coursework sync
 *  - submissions.google_classroom_id — looked up on every submission sync
 *  - materials.course_id    — used in whereHas / whereIn filters
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('chats', function (Blueprint $table) {
            $table->index('conversation_id', 'chats_conversation_id_idx');
            $table->index('user_id', 'chats_user_id_idx');
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->index('user_id', 'conversations_user_id_idx');
        });

        Schema::table('students', function (Blueprint $table) {
            // Only add if the column exists (it's added in a later migration for Google sync)
            if (Schema::hasColumn('students', 'google_classroom_id')) {
                $table->index('google_classroom_id', 'students_google_classroom_id_idx');
            }
        });

        Schema::table('assessments', function (Blueprint $table) {
            if (Schema::hasColumn('assessments', 'google_classroom_id')) {
                $table->index('google_classroom_id', 'assessments_google_classroom_id_idx');
            }
        });

        Schema::table('submissions', function (Blueprint $table) {
            if (Schema::hasColumn('submissions', 'google_classroom_id')) {
                $table->index('google_classroom_id', 'submissions_google_classroom_id_idx');
            }
        });

        Schema::table('materials', function (Blueprint $table) {
            $table->index('course_id', 'materials_course_id_idx');
        });
    }

    public function down(): void
    {
        Schema::table('chats', function (Blueprint $table) {
            $table->dropIndex('chats_conversation_id_idx');
            $table->dropIndex('chats_user_id_idx');
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->dropIndex('conversations_user_id_idx');
        });

        Schema::table('students', function (Blueprint $table) {
            if (Schema::hasColumn('students', 'google_classroom_id')) {
                $table->dropIndex('students_google_classroom_id_idx');
            }
        });

        Schema::table('assessments', function (Blueprint $table) {
            if (Schema::hasColumn('assessments', 'google_classroom_id')) {
                $table->dropIndex('assessments_google_classroom_id_idx');
            }
        });

        Schema::table('submissions', function (Blueprint $table) {
            if (Schema::hasColumn('submissions', 'google_classroom_id')) {
                $table->dropIndex('submissions_google_classroom_id_idx');
            }
        });

        Schema::table('materials', function (Blueprint $table) {
            $table->dropIndex('materials_course_id_idx');
        });
    }
};
