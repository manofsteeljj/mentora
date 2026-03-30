<?php

namespace App\Http\Controllers;

use App\Models\Assessment;
use App\Models\Course;
use App\Models\Submission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GradingController extends Controller
{
    /**
     * Return all submissions for the authenticated teacher's courses,
     * enriched with student, assessment, and course information.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // Get all course IDs belonging to this teacher
        $courseIds = Course::where('user_id', $user->id)->pluck('id');

        // Get assessments with their submissions, students, and course
        $assessments = Assessment::with(['course', 'submissions.student'])
            ->whereIn('course_id', $courseIds)
            ->orderByDesc('due_date')
            ->get();

        // Build flat submission list for the frontend
        $submissions = [];

        foreach ($assessments as $assessment) {
            foreach ($assessment->submissions as $submission) {
                $student = $submission->student;

                $submissions[] = [
                    'id'              => $submission->id,
                    'student'         => [
                        'id'        => $student?->id,
                        'name'      => $student?->name ?? 'Unknown Student',
                        'email'     => $student?->email,
                        'photo_url' => $student?->photo_url,
                    ],
                    'assessment'      => [
                        'id'         => $assessment->id,
                        'title'      => $assessment->title,
                        'max_points' => $assessment->max_points ?? $assessment->total_points ?? 100,
                        'due_date'   => $assessment->due_date?->toISOString(),
                        'type'       => $assessment->type,
                        'state'      => $assessment->state,
                    ],
                    'course'          => [
                        'id'          => $assessment->course?->id,
                        'course_code' => $assessment->course?->course_code,
                        'course_name' => $assessment->course?->course_name,
                    ],
                    'state'           => $submission->state,
                    'assigned_grade'  => $submission->assigned_grade,
                    'draft_grade'     => $submission->draft_grade,
                    'late'            => $submission->late,
                    'submitted_at'    => $submission->submitted_at?->toISOString(),
                    'feedback'        => $submission->feedback,
                    'created_at'      => $submission->created_at?->toISOString(),
                ];
            }
        }

        // Also return summary stats
        $total     = count($submissions);
        $graded    = collect($submissions)->whereNotNull('assigned_grade')->count();
        $pending   = collect($submissions)->where('state', 'TURNED_IN')->whereNull('assigned_grade')->count();
        $late      = collect($submissions)->where('late', true)->count();
        $returned  = collect($submissions)->where('state', 'RETURNED')->count();

        return response()->json([
            'submissions' => $submissions,
            'stats' => [
                'total'    => $total,
                'graded'   => $graded,
                'pending'  => $pending,
                'late'     => $late,
                'returned' => $returned,
            ],
        ]);
    }

    /**
     * Update the grade / feedback for a single submission.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $submission = Submission::with('assessment.course')
            ->findOrFail($id);

        // Ensure this submission belongs to one of the teacher's courses
        if ($submission->assessment->course->user_id !== $user->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'assigned_grade' => 'nullable|numeric|min:0',
            'draft_grade'    => 'nullable|numeric|min:0',
            'feedback'       => 'nullable|string|max:5000',
        ]);

        $submission->update($validated);

        return response()->json([
            'message'    => 'Submission updated successfully',
            'submission' => $submission->fresh(),
        ]);
    }
}
