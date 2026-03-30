<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('materials', function (Blueprint $table) {
            $table->string('google_classroom_id')->nullable()->after('id');
            $table->string('google_drive_file_id')->nullable()->after('google_classroom_id');
            $table->string('source_type')->default('local')->after('google_drive_file_id'); // local, google_classroom
            $table->string('material_type')->default('file')->after('source_type');          // file, drive_file, youtube, link, form
            $table->text('description')->nullable()->after('title');
            $table->string('link')->nullable()->after('file_path');
            $table->string('thumbnail_url')->nullable()->after('link');

            // Make file_path nullable (Google materials may not have a local file)
            $table->string('file_path')->nullable()->change();

            $table->index('google_classroom_id');
            $table->index('source_type');
        });
    }

    public function down(): void
    {
        Schema::table('materials', function (Blueprint $table) {
            $table->dropIndex(['google_classroom_id']);
            $table->dropIndex(['source_type']);
            $table->dropColumn([
                'google_classroom_id',
                'google_drive_file_id',
                'source_type',
                'material_type',
                'description',
                'link',
                'thumbnail_url',
            ]);
        });
    }
};
