<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Course;
use App\Models\Student;
use App\Models\Assessment;
use App\Models\Submission;
use App\Models\Grade;
use App\Models\Material;
use App\Models\Conversation;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    /**
     * Return all dashboard data for the authenticated user.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        // ── Courses ─────────────────────────────────────────
        $courses = Course::where('user_id', $user->id)
            ->withCount(['students', 'assessments', 'materials'])
            ->orderBy('course_code')
            ->get();

        $courseIds = $courses->pluck('id');

        // ── Students with grade data ────────────────────────
        // For each student, compute:
        //   - total assessments in their course
        //   - completed submissions
        //   - average score (percentage across all graded questions)
        $students = [];

        if ($courseIds->isNotEmpty()) {
            $studentRows = Student::whereIn('course_id', $courseIds)
                ->with(['course:id,course_code,course_name,section'])
                ->get();

            foreach ($studentRows as $s) {
                $courseAssessmentCount = Assessment::where('course_id', $s->course_id)->count();

                // Get this student's submissions
                $submissions = Submission::where('student_id', $s->id)->get();
                $completedAssessments = $submissions->count();

                // Calculate average grade across all graded questions
                $totalScore = 0;
                $totalPoints = 0;
                foreach ($submissions as $sub) {
                    $grades = Grade::where('submission_id', $sub->id)
                        ->join('questions', 'grades.question_id', '=', 'questions.id')
                        ->select('grades.score', 'questions.points')
                        ->get();
                    foreach ($grades as $g) {
                        $totalScore += (int) $g->score;
                        $totalPoints += (int) $g->points;
                    }
                }

                $averageGrade = $totalPoints > 0
                    ? round(($totalScore / $totalPoints) * 100)
                    : 0;

                // Determine status
                $status = 'no-data';
                if ($totalPoints > 0) {
                    if ($averageGrade >= 90) $status = 'excellent';
                    elseif ($averageGrade >= 75) $status = 'good';
                    else $status = 'at-risk';
                }

                $students[] = [
                    'id' => $s->id,
                    'name' => $s->name,
                    'email' => $s->email ?? '',
                    'studentNumber' => $s->student_number,
                    'courseId' => $s->course_id,
                    'courseCode' => $s->course->course_code ?? '',
                    'courseName' => $s->course->course_name ?? '',
                    'section' => $s->course->section ?? '',
                    'averageGrade' => $averageGrade,
                    'totalAssessments' => $courseAssessmentCount,
                    'completedAssessments' => $completedAssessments,
                    'status' => $status,
                ];
            }
        }

        // ── Course summaries ────────────────────────────────
        $courseSummaries = $courses->map(function ($c) use ($students) {
            $courseStudents = collect($students)->where('courseId', $c->id);
            $graded = $courseStudents->where('status', '!=', 'no-data');
            $avgGrade = $graded->count() > 0
                ? round($graded->avg('averageGrade'))
                : 0;
            $atRisk = $graded->where('status', 'at-risk')->count();

            return [
                'id' => $c->id,
                'code' => $c->course_code,
                'name' => $c->course_name,
                'section' => $c->section ?? '',
                'room' => $c->room ?? '',
                'status' => $c->status ?? 'ACTIVE',
                'academicTerm' => $c->academic_term ?? '',
                'googleClassroomId' => $c->google_classroom_id,
                'studentCount' => $c->students_count,
                'assessmentCount' => $c->assessments_count,
                'materialCount' => $c->materials_count,
                'avgGrade' => $avgGrade,
                'atRisk' => $atRisk,
            ];
        });

        // ── Aggregate stats ─────────────────────────────────
        $totalStudents = collect($students)->count();
        $gradedStudents = collect($students)->where('status', '!=', 'no-data');
        $averageClassGrade = $gradedStudents->count() > 0
            ? round($gradedStudents->avg('averageGrade'))
            : 0;
        $topPerformers = $gradedStudents->where('averageGrade', '>=', 90)->count();
        $atRiskCount = $gradedStudents->where('averageGrade', '<', 75)->count();

        $totalMaterials = $courseIds->isNotEmpty()
            ? Material::whereIn('course_id', $courseIds)->count()
            : 0;
        $totalAssessments = $courseIds->isNotEmpty()
            ? Assessment::whereIn('course_id', $courseIds)->count()
            : 0;
        $totalConversations = Conversation::where('user_id', $user->id)->count();

        return response()->json([
            'courses' => $courseSummaries,
            'students' => $students,
            'stats' => [
                'totalCourses' => $courses->count(),
                'totalStudents' => $totalStudents,
                'averageClassGrade' => $averageClassGrade,
                'topPerformers' => $topPerformers,
                'atRiskStudents' => $atRiskCount,
                'totalMaterials' => $totalMaterials,
                'totalAssessments' => $totalAssessments,
                'totalConversations' => $totalConversations,
            ],
        ]);
    }
}
