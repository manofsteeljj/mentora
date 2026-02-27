<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('title');
            $table->timestamps();
        });

        // Add conversation_id to existing chats table
        Schema::table('chats', function (Blueprint $table) {
            $table->foreignId('conversation_id')->nullable()->after('id')->constrained()->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::table('chats', function (Blueprint $table) {
            $table->dropForeign(['conversation_id']);
            $table->dropColumn('conversation_id');
        });

        Schema::dropIfExists('conversations');
    }
};
