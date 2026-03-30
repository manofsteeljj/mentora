<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add google_classroom_id to students for upsert tracking,
     * and last_synced_at to users/courses for sync status.
     */
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->string('google_classroom_id')->nullable()->after('id');
            $table->string('photo_url')->nullable()->after('email');
        });

        Schema::table('courses', function (Blueprint $table) {
            $table->timestamp('last_synced_at')->nullable()->after('status');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('last_synced_at')->nullable()->after('avatar');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->dropColumn(['google_classroom_id', 'photo_url']);
        });

        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn('last_synced_at');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('last_synced_at');
        });
    }
};
