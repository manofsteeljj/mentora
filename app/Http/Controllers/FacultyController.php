<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class FacultyController extends Controller
{
    private function inferDepartment($courses): string
    {
        if ($courses->isEmpty()) {
            return 'General Studies';
        }

        $course = $courses->first();
        $name = Str::lower((string) ($course->course_name ?? ''));
        $code = Str::upper((string) ($course->course_code ?? ''));

        if (str_contains($name, 'network')) {
            return 'Network Engineering';
        }

        if (str_contains($name, 'information technology') || preg_match('/\bIT\b/', $code)) {
            return 'Information Technology';
        }

        if (str_contains($name, 'computer science') || str_starts_with($code, 'CS')) {
            return 'Computer Science';
        }

        return 'General Studies';
    }

    private function inferPosition(User $user, int $courseCount): string
    {
        $years = $user->created_at ? now()->diffInYears($user->created_at) : 0;

        if ($years >= 6 || $courseCount >= 4) {
            return 'Professor';
        }

        if ($years >= 4 || $courseCount >= 3) {
            return 'Associate Professor';
        }

        if ($years >= 2 || $courseCount >= 2) {
            return 'Assistant Professor';
        }

        if ($years >= 1) {
            return 'Lecturer';
        }

        return 'Instructor';
    }

    private function inferStatus(User $user): string
    {
        if (!$user->email_verified_at) {
            return 'On Leave';
        }

        return 'Active';
    }

    public function adminIndex(Request $request)
    {
        $email = Str::lower((string) ($request->user()->email ?? ''));
        if ($email !== 'admin@mentora.local') {
            return response()->json([
                'message' => 'Forbidden',
            ], 403);
        }

        $faculty = User::with(['courses' => function ($q) {
            $q->withCount('students')->orderBy('course_code');
        }])
            ->orderBy('name')
            ->get()
            ->map(function (User $user) {
                $courses = $user->courses ?? collect();
                $courseCount = $courses->count();
                $totalStudents = $courses->sum('students_count');

                $courseLabels = $courses
                    ->map(function ($course) {
                        $code = (string) ($course->course_code ?? 'N/A');
                        $name = (string) ($course->course_name ?? 'Untitled Course');
                        return "{$name} ({$code})";
                    })
                    ->values();

                $phoneSeed = str_pad((string) ($user->id % 10000), 4, '0', STR_PAD_LEFT);
                $phone = "+63 9{$phoneSeed} {$phoneSeed} {$phoneSeed}";

                return [
                    'id' => (string) $user->id,
                    'name' => (string) $user->name,
                    'employeeId' => 'FAC-' . optional($user->created_at)->format('Y') . '-' . str_pad((string) $user->id, 3, '0', STR_PAD_LEFT),
                    'email' => (string) $user->email,
                    'phone' => $phone,
                    'department' => $this->inferDepartment($courses),
                    'position' => $this->inferPosition($user, $courseCount),
                    'courses' => $courseLabels,
                    'totalStudents' => (int) $totalStudents,
                    'joinDate' => optional($user->created_at)->toDateString(),
                    'status' => $this->inferStatus($user),
                ];
            })
            ->values();

        return response()->json([
            'faculty' => $faculty,
            'total' => $faculty->count(),
        ]);
    }
}
