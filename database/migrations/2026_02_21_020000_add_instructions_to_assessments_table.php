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
        if (!Schema::hasColumn('assessments', 'instructions')) {
            Schema::table('assessments', function (Blueprint $table) {
                $table->text('instructions')->nullable()->after('title');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('assessments', 'instructions')) {
            Schema::table('assessments', function (Blueprint $table) {
                $table->dropColumn('instructions');
            });
        }
    }
};
