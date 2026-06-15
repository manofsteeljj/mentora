<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureAccountIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = Auth::user();

        if (!$user) {
            return $next($request);
        }

        if ($user->isPending()) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            // API requests get JSON
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Your account is pending administrator approval.'], 403);
            }

            return redirect()->route('approval.pending');
        }

        if ($user->isRejected()) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            if ($request->expectsJson()) {
                return response()->json(['message' => 'Your registration was not approved.'], 403);
            }

            return redirect()->route('login')
                ->withErrors(['email' => 'Your registration was not approved. Please contact the administrator.']);
        }

        return $next($request);
    }
}
