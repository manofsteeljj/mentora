<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('excuse_letters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('attendance_id')->constrained('attendances')->cascadeOnDelete();

            $table->date('submitted_date');
            $table->text('reason');
            $table->json('attachments')->nullable();
            $table->string('status'); // pending|approved|rejected

            $table->string('reviewed_by')->nullable();
            $table->date('review_date')->nullable();
            $table->text('review_notes')->nullable();
            $table->timestamps();

            $table->unique('attendance_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('excuse_letters');
    }
};
