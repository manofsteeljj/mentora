<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lesson_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_id')->nullable()->constrained()->nullOnDelete();

            // Header metadata
            $table->string('title')->default('');
            $table->string('grade_level')->default('');
            $table->string('subject')->default('');
            $table->string('topic')->default('');
            $table->string('duration')->default('60 minutes');
            $table->string('learning_competency')->nullable();
            $table->string('teaching_strategy')->nullable();
            $table->string('available_resources')->nullable();

            // Structured DLL sections (stored as JSON)
            $table->json('objectives')->nullable();      // learning objectives
            $table->json('content')->nullable();         // subject matter / content
            $table->json('learning_resources')->nullable();
            $table->json('procedures')->nullable();      // teaching procedures / activities
            $table->json('remarks')->nullable();
            $table->json('reflection')->nullable();

            // Raw AI output for reference
            $table->longText('raw_ai_output')->nullable();

            // Tracking
            $table->string('ai_model')->nullable();
            $table->string('status')->default('draft'); // draft | approved | published
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index(['user_id', 'subject']);
        });

        Schema::create('ai_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('feature')->default('lesson_plan'); // lesson_plan | quiz | etc.
            $table->string('model')->nullable();
            $table->longText('prompt')->nullable();
            $table->longText('response')->nullable();
            $table->integer('response_time_ms')->nullable();
            $table->integer('prompt_tokens')->nullable();
            $table->integer('completion_tokens')->nullable();
            $table->string('status')->default('success'); // success | error
            $table->text('error_message')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'feature']);
            $table->index(['model', 'feature']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_requests');
        Schema::dropIfExists('lesson_plans');
    }
};
