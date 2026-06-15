<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class FacultyController extends Controller
{
    // ── Admin check helper ────────────────────────────────────────────────────
    private function assertAdmin(Request $request): void
    {
        $email = Str::lower((string) ($request->user()->email ?? ''));
        abort_if($email !== 'admin@mentora.local', 403, 'Forbidden');
    }

    // ── Shared helpers ────────────────────────────────────────────────────────
    private function inferDepartment($courses): string
    {
        if ($courses->isEmpty()) return 'General Studies';

        $course = $courses->first();
        $name   = Str::lower((string) ($course->course_name ?? ''));
        $code   = Str::upper((string) ($course->course_code ?? ''));

        if (str_contains($name, 'network'))                                      return 'Network Engineering';
        if (str_contains($name, 'information technology') || preg_match('/\bIT\b/', $code)) return 'Information Technology';
        if (str_contains($name, 'computer science')       || str_starts_with($code, 'CS'))  return 'Computer Science';

        return 'General Studies';
    }

    private function inferPosition(User $user, int $courseCount): string
    {
        $years = $user->created_at ? now()->diffInYears($user->created_at) : 0;

        if ($years >= 6 || $courseCount >= 4) return 'Professor';
        if ($years >= 4 || $courseCount >= 3) return 'Associate Professor';
        if ($years >= 2 || $courseCount >= 2) return 'Assistant Professor';
        if ($years >= 1)                       return 'Lecturer';

        return 'Instructor';
    }

    private function inferStatus(User $user): string
    {
        if ($user->status === 'pending')  return 'Pending';
        if ($user->status === 'rejected') return 'Rejected';
        if (!$user->email_verified_at)    return 'On Leave';
        return 'Active';
    }

    // ── Faculty directory ─────────────────────────────────────────────────────
    public function adminIndex(Request $request)
    {
        $this->assertAdmin($request);

        $faculty = User::with(['courses' => function ($q) {
            $q->withCount('students')->orderBy('course_code');
        }])
            ->where('status', 'active')          // only show approved faculty in the main list
            ->where('email', '!=', 'admin@mentora.local')
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => $this->formatFaculty($user))
            ->values();

        return response()->json([
            'faculty' => $faculty,
            'total'   => $faculty->count(),
        ]);
    }

    // ── Pending approvals list ────────────────────────────────────────────────
    public function pendingIndex(Request $request)
    {
        $this->assertAdmin($request);

        $pending = User::where('status', 'pending')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(fn (User $user) => [
                'id'         => (string) $user->id,
                'name'       => $user->name,
                'email'      => $user->email,
                'avatar'     => $user->avatar,
                'registered' => optional($user->created_at)->toISOString(),
                'status'     => $user->status,
            ])
            ->values();

        return response()->json([
            'pending' => $pending,
            'total'   => $pending->count(),
        ]);
    }

    // ── Approve a user ────────────────────────────────────────────────────────
    public function approve(Request $request, $userId)
    {
        $this->assertAdmin($request);

        $user = User::findOrFail($userId);
        $user->update(['status' => 'active']);

        return response()->json(['success' => true, 'status' => 'active', 'name' => $user->name]);
    }

    // ── Reject a user ─────────────────────────────────────────────────────────
    public function reject(Request $request, $userId)
    {
        $this->assertAdmin($request);

        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $user = User::findOrFail($userId);
        $user->update(['status' => 'rejected']);

        return response()->json(['success' => true, 'status' => 'rejected', 'name' => $user->name]);
    }

    // ── Private formatter ─────────────────────────────────────────────────────
    private function formatFaculty(User $user): array
    {
        $courses      = $user->courses ?? collect();
        $courseCount  = $courses->count();
        $totalStudents = $courses->sum('students_count');

        $courseLabels = $courses
            ->map(fn ($c) => trim((string) ($c->course_name ?? 'Untitled Course')) . ' (' . (string) ($c->course_code ?? 'N/A') . ')')
            ->values();

        $phoneSeed = str_pad((string) ($user->id % 10000), 4, '0', STR_PAD_LEFT);
        $phone     = "+63 9{$phoneSeed} {$phoneSeed} {$phoneSeed}";

        return [
            'id'            => (string) $user->id,
            'name'          => (string) $user->name,
            'employeeId'    => 'FAC-' . optional($user->created_at)->format('Y') . '-' . str_pad((string) $user->id, 3, '0', STR_PAD_LEFT),
            'email'         => (string) $user->email,
            'phone'         => $phone,
            'department'    => $this->inferDepartment($courses),
            'position'      => $this->inferPosition($user, $courseCount),
            'courses'       => $courseLabels,
            'totalStudents' => (int) $totalStudents,
            'joinDate'      => optional($user->created_at)->toDateString(),
            'status'        => $this->inferStatus($user),
        ];
    }
}
