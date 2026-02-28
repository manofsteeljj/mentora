<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Laravel\Socialite\Facades\Socialite;

class GoogleAuthController extends Controller
{
    /**
     * Redirect to Google OAuth with Classroom scopes.
     */
    public function redirect()
    {
        return Socialite::driver('google')
            ->scopes([
                'https://www.googleapis.com/auth/classroom.courses.readonly',
                'https://www.googleapis.com/auth/classroom.rosters.readonly',
                'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
            ])
            ->with(['access_type' => 'offline', 'prompt' => 'consent'])
            ->redirect();
    }

    /**
     * Handle the callback from Google, create/update user, store tokens.
     */
    public function callback()
    {
        try {
            $googleUser = Socialite::driver('google')->user();
        } catch (\Exception $e) {
            Log::error('Google OAuth callback failed', ['error' => $e->getMessage()]);
            return redirect('/login')->with('error', 'Google login failed. Please try again.');
        }

        // Find existing user by google_id or email, or create new
        $user = User::where('google_id', $googleUser->getId())
            ->orWhere('email', $googleUser->getEmail())
            ->first();

        if ($user) {
            // Update existing user with latest Google data
            $user->update([
                'google_id'            => $googleUser->getId(),
                'google_token'         => $googleUser->token,
                'google_refresh_token' => $googleUser->refreshToken ?? $user->google_refresh_token,
                'avatar'               => $googleUser->getAvatar(),
                'name'                 => $googleUser->getName(),
            ]);
        } else {
            // Create new user
            $user = User::create([
                'name'                 => $googleUser->getName(),
                'email'                => $googleUser->getEmail(),
                'google_id'            => $googleUser->getId(),
                'google_token'         => $googleUser->token,
                'google_refresh_token' => $googleUser->refreshToken,
                'avatar'               => $googleUser->getAvatar(),
                'password'             => null,
                'email_verified_at'    => now(),
            ]);
        }

        Auth::login($user, true);

        Log::info('Google login successful', ['user_id' => $user->id, 'email' => $user->email]);

        return redirect('/dashboard');
    }

    /**
     * Return the authenticated user's Google connection status.
     */
    public function status(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'connected'     => !empty($user->google_id),
            'has_token'     => !empty($user->google_token),
            'has_refresh'   => !empty($user->google_refresh_token),
            'email'         => $user->email,
            'avatar'        => $user->avatar,
        ]);
    }
}
