<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lesson_plans', function (Blueprint $table) {
            $table->string('docx_path')->nullable()->after('raw_ai_output');
            $table->unsignedInteger('docx_version')->default(1)->after('docx_path');
        });
    }

    public function down(): void
    {
        Schema::table('lesson_plans', function (Blueprint $table) {
            $table->dropColumn(['docx_path', 'docx_version']);
        });
    }
};
