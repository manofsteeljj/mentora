<?php

namespace App\Http\Controllers;

use App\Services\GoogleClassroomService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class GoogleClassroomController extends Controller
{
    /**
     * List courses from Google Classroom (preview, doesn't save).
     */
    public function listCourses(Request $request)
    {
        $user = $request->user();

        if (!$user->google_token) {
            return response()->json([
                'error'   => 'not_connected',
                'message' => 'Google account not connected. Please sign in with Google first.',
            ], 401);
        }

        try {
            $service = new GoogleClassroomService($user);
            $courses = $service->listCourses();

            return response()->json([
                'courses' => $courses,
                'count'   => count($courses),
            ]);
        } catch (\Exception $e) {
            Log::error('Google Classroom list failed', ['error' => $e->getMessage()]);

            if (str_contains($e->getMessage(), 're-authenticate')) {
                return response()->json([
                    'error'   => 'token_expired',
                    'message' => 'Google token expired. Please sign in with Google again.',
                ], 401);
            }

            return response()->json([
                'error'   => 'api_error',
                'message' => 'Failed to fetch courses from Google Classroom: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Import courses from Google Classroom into the local database.
     */
    public function importCourses(Request $request)
    {
        $user = $request->user();

        if (!$user->google_token) {
            return response()->json([
                'error'   => 'not_connected',
                'message' => 'Google account not connected.',
            ], 401);
        }

        try {
            $service = new GoogleClassroomService($user);
            $result  = $service->importCourses();

            return response()->json([
                'message'  => 'Courses imported successfully!',
                'imported' => count($result['imported']),
                'updated'  => count($result['updated']),
                'total'    => $result['total'],
            ]);
        } catch (\Exception $e) {
            Log::error('Google Classroom import failed', ['error' => $e->getMessage()]);

            return response()->json([
                'error'   => 'import_failed',
                'message' => 'Failed to import courses: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get students for a specific Google Classroom course.
     */
    public function listStudents(Request $request, string $courseId)
    {
        $user = $request->user();

        if (!$user->google_token) {
            return response()->json(['error' => 'not_connected'], 401);
        }

        try {
            $service  = new GoogleClassroomService($user);
            $students = $service->listStudents($courseId);

            return response()->json([
                'students' => $students,
                'count'    => count($students),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error'   => 'api_error',
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Sync: re-import all courses (convenient alias).
     */
    public function sync(Request $request)
    {
        return $this->importCourses($request);
    }
}
