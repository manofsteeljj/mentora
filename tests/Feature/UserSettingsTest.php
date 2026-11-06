<?php

namespace Tests\Feature;

use App\Models\Chat;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_receives_default_settings(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson('/api/settings')
            ->assertOk()
            ->assertJson([
                'response_detail' => 'balanced',
                'include_code_examples' => true,
                'save_chat_history' => true,
            ]);
    }

    public function test_authenticated_user_can_update_settings(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->patchJson('/api/settings', [
                'response_detail' => 'detailed',
                'save_chat_history' => false,
            ])
            ->assertOk()
            ->assertJson([
                'response_detail' => 'detailed',
                'save_chat_history' => false,
            ]);

        $this->assertSame('detailed', $user->refresh()->settings['response_detail']);
        $this->assertFalse($user->settings['save_chat_history']);
    }

    public function test_user_can_clear_only_their_chat_history(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        Conversation::create(['user_id' => $user->id, 'title' => 'Mine']);
        Conversation::create(['user_id' => $otherUser->id, 'title' => 'Theirs']);
        Chat::create(['user_id' => $user->id, 'message' => 'Old', 'response' => 'Reply']);

        $this->actingAs($user)
            ->deleteJson('/api/chat/conversations')
            ->assertOk()
            ->assertJson(['success' => true]);

        $this->assertDatabaseMissing('conversations', ['user_id' => $user->id]);
        $this->assertDatabaseHas('conversations', ['user_id' => $otherUser->id]);
        $this->assertDatabaseMissing('chats', ['user_id' => $user->id]);
    }

    public function test_disabling_chat_history_does_not_create_a_conversation(): void
    {
        $user = User::factory()->create(['settings' => ['save_chat_history' => false]]);
        config(['services.openrouter.api_key' => '']);

        $this->actingAs($user)
            ->postJson('/api/chat', ['message' => 'Do not save this'])
            ->assertOk()
            ->assertJsonPath('conversation_id', null);

        $this->assertDatabaseMissing('conversations', ['user_id' => $user->id]);
        $this->assertDatabaseMissing('chats', ['user_id' => $user->id]);
    }
}
