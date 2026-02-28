<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->string('google_classroom_id')->nullable()->unique()->after('id');
            $table->string('section')->nullable()->after('description');
            $table->string('room')->nullable()->after('section');
            $table->enum('status', ['ACTIVE', 'ARCHIVED', 'PROVISIONED', 'DECLINED'])->default('ACTIVE')->after('room');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn(['google_classroom_id', 'section', 'room', 'status']);
        });
    }
};
