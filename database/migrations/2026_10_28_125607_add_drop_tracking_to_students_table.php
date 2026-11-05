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
        Schema::table('students', function (Blueprint $table) {
            $table->enum('status', ['enrolled', 'dropped', 'withdrawn'])
                  ->default('enrolled')
                  ->after('email');
            $table->timestamp('dropped_at')->nullable()->after('status');
            $table->text('drop_reason')->nullable()->after('dropped_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->dropColumn(['status', 'dropped_at', 'drop_reason']);
        });
    }
};
