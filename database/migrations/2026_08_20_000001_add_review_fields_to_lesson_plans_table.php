<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lesson_plans', function (Blueprint $table) {
            // Admin review workflow
            $table->timestamp('submitted_at')->nullable()->after('status');   // when teacher submitted/resubmitted
            $table->text('admin_feedback')->nullable()->after('submitted_at'); // denial / revision reason
            $table->foreignId('reviewed_by')->nullable()->after('admin_feedback')->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable()->after('reviewed_by');
        });

        // Move existing rows onto the new review workflow:
        // draft    -> pending (generated plans now await admin review)
        // published -> approved
        DB::table('lesson_plans')->where('status', 'draft')->update([
            'status'       => 'pending',
            'submitted_at' => DB::raw('updated_at'),
        ]);
        DB::table('lesson_plans')->where('status', 'published')->update(['status' => 'approved']);
    }

    public function down(): void
    {
        Schema::table('lesson_plans', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reviewed_by');
            $table->dropColumn(['submitted_at', 'admin_feedback', 'reviewed_at']);
        });

        DB::table('lesson_plans')->whereIn('status', ['pending', 'needs_revision'])->update(['status' => 'draft']);
        DB::table('lesson_plans')->where('status', 'approved')->update(['status' => 'published']);
    }
};
