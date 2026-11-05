<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\View\View;

class RecoveryPasswordController extends Controller
{
    public function create(): View
    {
        return view('auth.forgot-password');
    }

    public function store(Request $request): RedirectResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => ['required', 'email'],
            'recovery_key' => ['required', 'string', 'max:255'],
            'password' => ['required', Password::defaults(), 'confirmed'],
        ]);

        if ($validator->fails()) {
            return back()
                ->withErrors($validator)
                ->withInput($request->except(['recovery_key', 'password', 'password_confirmation']));
        }

        $validated = $validator->validated();
        $user = User::whereRaw('LOWER(email) = ?', [mb_strtolower($validated['email'])])->first();

        if (
            ! $user
            || ! $user->recovery_key_hash
            || ! Hash::check($validated['recovery_key'], $user->recovery_key_hash)
        ) {
            return back()
                ->withErrors(['recovery_key' => 'The email or recovery key is invalid.'])
                ->withInput($request->only('email'));
        }

        $user->forceFill([
            'password' => Hash::make($validated['password']),
            'remember_token' => Str::random(60),
        ])->save();

        event(new PasswordReset($user));

        return redirect()->route('password.request')->with('status', 'Your password has been reset. You can now sign in.');
    }
}
