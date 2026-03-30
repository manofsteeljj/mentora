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
                ->select(['id', 'course_id', 'name', 'email', 'student_number'])
                ->with(['course:id,course_code,course_name,section'])
                ->get();

            $studentIds = $studentRows->pluck('id');

            $assessmentCountsByCourse = Assessment::whereIn('course_id', $courseIds)
                ->select('course_id', DB::raw('COUNT(*) as cnt'))
                ->groupBy('course_id')
                ->pluck('cnt', 'course_id');

            $submissionCountsByStudent = $studentIds->isNotEmpty()
                ? Submission::whereIn('student_id', $studentIds)
                    ->select('student_id', DB::raw('COUNT(*) as cnt'))
                    ->groupBy('student_id')
                    ->pluck('cnt', 'student_id')
                : collect();

            $gradeAggByStudent = $studentIds->isNotEmpty()
                ? DB::table('grades')
                    ->join('submissions', 'grades.submission_id', '=', 'submissions.id')
                    ->join('questions', 'grades.question_id', '=', 'questions.id')
                    ->whereIn('submissions.student_id', $studentIds)
                    ->select(
                        'submissions.student_id',
                        DB::raw('SUM(COALESCE(grades.score, 0)) as total_score'),
                        DB::raw('SUM(COALESCE(questions.points, 0)) as total_points')
                    )
                    ->groupBy('submissions.student_id')
                    ->get()
                    ->keyBy('student_id')
                : collect();

            foreach ($studentRows as $s) {
                $courseAssessmentCount = (int) ($assessmentCountsByCourse[$s->course_id] ?? 0);
                $completedAssessments = (int) ($submissionCountsByStudent[$s->id] ?? 0);

                $agg = $gradeAggByStudent[$s->id] ?? null;
                $totalScore = (int) ($agg->total_score ?? 0);
                $totalPoints = (int) ($agg->total_points ?? 0);

                $averageGrade = $totalPoints > 0
                    ? round(($totalScore / $totalPoints) * 100)
                    : 0;

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
