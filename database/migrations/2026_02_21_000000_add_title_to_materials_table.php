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
        if (!Schema::hasColumn('materials', 'title')) {
            Schema::table('materials', function (Blueprint $table) {
                $table->string('title')->default('')->after('course_id');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('materials', 'title')) {
            Schema::table('materials', function (Blueprint $table) {
                $table->dropColumn('title');
            });
        }
    }
};
