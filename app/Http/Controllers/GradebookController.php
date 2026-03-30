<?php

namespace App\Http\Controllers;

use App\Models\GradebookAssessment;
use App\Models\GradebookGrade;
use App\Models\Course;
use App\Models\Student;
use Illuminate\Http\Request;

class GradebookController extends Controller
{
    private function assertCourseOwnedByUser(Request $request, int $courseId): void
    {
        $owned = Course::query()
            ->where('id', $courseId)
            ->where('user_id', $request->user()->id)
            ->exists();

        abort_unless($owned, 403);
    }

    public function assessmentsIndex(Request $request)
    {
        $data = $request->validate([
            'course_id' => ['required', 'integer', 'exists:courses,id'],
            'grading_period' => ['required', 'string', 'in:1st,2nd,3rd,4th'],
        ]);

        $this->assertCourseOwnedByUser($request, (int) $data['course_id']);

        $assessments = GradebookAssessment::query()
            ->where('course_id', $data['course_id'])
            ->where('grading_period', $data['grading_period'])
            ->orderBy('created_at')
            ->get();

        return response()->json([
            'assessments' => $assessments,
        ]);
    }

    public function assessmentsStore(Request $request)
    {
        $data = $request->validate([
            'course_id' => ['required', 'integer', 'exists:courses,id'],
            'grading_period' => ['required', 'string', 'in:1st,2nd,3rd,4th'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'type' => ['required', 'string', 'in:quiz,activity,exam,project,assignment'],
            'max_score' => ['required', 'integer', 'min:1'],
            'weight' => ['required', 'integer', 'min:0', 'max:100'],
        ]);

        $this->assertCourseOwnedByUser($request, (int) $data['course_id']);

        $assessment = GradebookAssessment::create($data);

        return response()->json([
            'assessment' => $assessment,
        ], 201);
    }

    public function assessmentsDestroy(Request $request, GradebookAssessment $assessment)
    {
        $this->assertCourseOwnedByUser($request, (int) $assessment->course_id);
        $assessment->delete();

        return response()->json(['ok' => true]);
    }

    public function gradesIndex(Request $request)
    {
        $data = $request->validate([
            'course_id' => ['required', 'integer', 'exists:courses,id'],
            'grading_period' => ['required', 'string', 'in:1st,2nd,3rd,4th'],
        ]);

        $this->assertCourseOwnedByUser($request, (int) $data['course_id']);

        $assessmentIds = GradebookAssessment::query()
            ->where('course_id', $data['course_id'])
            ->where('grading_period', $data['grading_period'])
            ->pluck('id');

        $grades = GradebookGrade::query()
            ->whereIn('assessment_id', $assessmentIds)
            ->get(['assessment_id', 'student_id', 'score']);

        return response()->json([
            'grades' => $grades,
        ]);
    }

    public function gradesUpsert(Request $request)
    {
        $data = $request->validate([
            'course_id' => ['required', 'integer', 'exists:courses,id'],
            'grading_period' => ['required', 'string', 'in:1st,2nd,3rd,4th'],
            'grades' => ['required', 'array'],
            'grades.*.student_id' => ['required', 'integer', 'exists:students,id'],
            'grades.*.assessment_id' => ['required', 'integer', 'exists:gradebook_assessments,id'],
            'grades.*.score' => ['nullable', 'numeric', 'min:0'],
        ]);

        $this->assertCourseOwnedByUser($request, (int) $data['course_id']);

        foreach ($data['grades'] as $row) {
            $assessment = GradebookAssessment::query()
                ->where('id', $row['assessment_id'])
                ->where('course_id', $data['course_id'])
                ->where('grading_period', $data['grading_period'])
                ->first();

            if (!$assessment) {
                return response()->json([
                    'message' => 'Assessment does not belong to this course or grading period.',
                ], 422);
            }

            $studentInCourse = Student::query()
                ->where('id', $row['student_id'])
                ->where('course_id', $data['course_id'])
                ->exists();

            if (!$studentInCourse) {
                return response()->json([
                    'message' => 'Student does not belong to this course.',
                ], 422);
            }

            GradebookGrade::updateOrCreate(
                ['student_id' => $row['student_id'], 'assessment_id' => $row['assessment_id']],
                ['score' => $row['score']]
            );
        }

        return response()->json(['ok' => true]);
    }
}
