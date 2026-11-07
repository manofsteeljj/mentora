<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('schools', function (Blueprint $table) {
            $table->id();
            $table->string('code', 50)->unique();
            $table->string('name');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        DB::table('schools')->insert([
            [
                'code' => 'MASUPE-ELEM',
                'name' => 'Masupe Elementary School',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'code' => 'TEST-EVALUATORS',
                'name' => 'Testing/Evaluators School',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        $defaultSchoolId = DB::table('schools')->where('code', 'MASUPE-ELEM')->value('id');

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('school_id')->nullable()->after('id')->constrained('schools')->nullOnDelete();
        });
        DB::table('users')->whereNull('school_id')->update(['school_id' => $defaultSchoolId]);
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique('users_email_unique');
            $table->unique(['school_id', 'email']);
        });

        foreach (['courses', 'materials', 'students'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->foreignId('school_id')->nullable()->after('id')->constrained('schools')->nullOnDelete();
            });
        }

        DB::table('courses')->update(['school_id' => $defaultSchoolId]);
        DB::table('materials')->update([
            'school_id' => DB::raw('(SELECT school_id FROM courses WHERE courses.id = materials.course_id)'),
        ]);
        DB::table('students')->update([
            'school_id' => DB::raw('(SELECT school_id FROM courses WHERE courses.id = students.course_id)'),
        ]);

        foreach (['courses', 'materials', 'students'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->index(['school_id']);
            });
        }
    }

    public function down(): void
    {
        foreach (['courses', 'materials', 'students'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropForeign(['school_id']);
                $table->dropColumn('school_id');
            });
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique('users_school_id_email_unique');
            $table->dropForeign(['school_id']);
            $table->dropColumn('school_id');
            $table->unique('email');
        });
        Schema::dropIfExists('schools');
    }
};
