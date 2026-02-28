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
     * Full sync: import courses + students from Google Classroom.
     * This is the main endpoint for continuous data refresh.
     */
    public function sync(Request $request)
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
            $result  = $service->syncAll();

            return response()->json([
                'message' => 'Sync completed successfully!',
                'courses' => $result['courses'],
                'students' => $result['students'],
                'synced_at' => $result['synced_at'],
            ]);
        } catch (\Exception $e) {
            Log::error('Google Classroom full sync failed', ['error' => $e->getMessage()]);

            if (str_contains($e->getMessage(), 're-authenticate')) {
                return response()->json([
                    'error'   => 'token_expired',
                    'message' => 'Google token expired. Please sign in with Google again.',
                ], 401);
            }

            return response()->json([
                'error'   => 'sync_failed',
                'message' => 'Failed to sync: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Return the last sync status for the user.
     */
    public function syncStatus(Request $request)
    {
        $user = $request->user();

        $googleConnected = !empty($user->google_token);
        $lastSyncedAt = $user->last_synced_at;

        // Also gather per-course sync info
        $courseSyncInfo = [];
        if ($googleConnected) {
            $courses = \App\Models\Course::where('user_id', $user->id)
                ->whereNotNull('google_classroom_id')
                ->select('id', 'course_code', 'course_name', 'last_synced_at')
                ->withCount('students')
                ->get();

            $courseSyncInfo = $courses->map(fn($c) => [
                'id'           => $c->id,
                'code'         => $c->course_code,
                'name'         => $c->course_name,
                'lastSynced'   => $c->last_synced_at?->toISOString(),
                'studentCount' => $c->students_count,
            ]);
        }

        return response()->json([
            'connected'    => $googleConnected,
            'lastSyncedAt' => $lastSyncedAt?->toISOString(),
            'courses'      => $courseSyncInfo,
        ]);
    }
}
