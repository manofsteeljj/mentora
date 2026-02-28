<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Student;
use App\Models\Assessment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StudentController extends Controller
{
    /**
     * Return all students for the authenticated teacher's courses,
     * with their submission/grade data grouped as activities.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $courseIds = Course::where('user_id', $user->id)->pluck('id');

        // Eager-load course, submissions, and each submission's assessment
        $studentRows = Student::whereIn('course_id', $courseIds)
            ->with([
                'course:id,course_code,course_name,section',
                'submissions.assessment:id,course_id,title,type,max_points,total_points,due_date,state',
            ])
            ->orderBy('name')
            ->get();

        $students = $studentRows->map(function ($s) {
            $activities = $s->submissions->map(function ($sub) {
                $assessment = $sub->assessment;
                $maxPoints = $assessment->max_points ?? $assessment->total_points ?? 100;

                $score = null;
                if ($sub->assigned_grade !== null) {
                    $score = (float) $sub->assigned_grade;
                } elseif ($sub->draft_grade !== null) {
                    $score = (float) $sub->draft_grade;
                }

                return [
                    'id'            => $sub->id,
                    'assessmentId'  => $assessment?->id,
                    'title'         => $assessment?->title ?? 'Untitled',
                    'type'          => $assessment?->type ?? 'Assignment',
                    'score'         => $score,
                    'maxScore'      => $maxPoints,
                    'submittedDate' => $sub->submitted_at?->toISOString() ?? $sub->created_at?->toISOString(),
                    'state'         => $sub->state,
                    'late'          => (bool) $sub->late,
                    'feedback'      => $sub->feedback,
                ];
            })->values()->toArray();

            // Calculate average
            $scored = collect($activities)->whereNotNull('score');
            $average = $scored->count() > 0
                ? $scored->sum(fn($a) => ($a['score'] / ($a['maxScore'] ?: 100)) * 100) / $scored->count()
                : null;

            return [
                'id'          => $s->id,
                'name'        => $s->name,
                'email'       => $s->email,
                'photoUrl'    => $s->photo_url,
                'studentNumber' => $s->student_number,
                'course'      => [
                    'id'          => $s->course?->id,
                    'course_code' => $s->course?->course_code,
                    'course_name' => $s->course?->course_name,
                    'section'     => $s->course?->section,
                ],
                'activities'  => $activities,
                'average'     => $average !== null ? round($average, 2) : null,
                'totalActivities' => count($activities),
            ];
        });

        return response()->json([
            'students' => $students,
            'total'    => $students->count(),
        ]);
    }
}
