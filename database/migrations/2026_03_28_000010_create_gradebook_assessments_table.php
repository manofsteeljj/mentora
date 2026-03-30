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
        Schema::create('gradebook_assessments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained()->onDelete('cascade');
            $table->string('grading_period');
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('type');
            $table->unsignedInteger('max_score');
            $table->unsignedInteger('weight');
            $table->timestamps();

            $table->index(['course_id', 'grading_period']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('gradebook_assessments');
    }
};
