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
        Schema::create('gradebook_grades', function (Blueprint $table) {
            $table->id();
            $table->foreignId('assessment_id')->constrained('gradebook_assessments')->onDelete('cascade');
            $table->foreignId('student_id')->constrained()->onDelete('cascade');
            $table->decimal('score', 8, 2)->nullable();
            $table->timestamps();

            $table->unique(['assessment_id', 'student_id']);
            $table->index(['student_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('gradebook_grades');
    }
};
