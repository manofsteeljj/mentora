<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\Course;
use App\Models\ExcuseLetter;
use App\Models\Student;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AttendanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $courseId = (int) $request->query('course_id');
        $date = (string) $request->query('date');

        if (!$courseId || !$date) {
            return response()->json(['message' => 'course_id and date are required'], 422);
        }

        $course = Course::where('user_id', $user->id)->where('id', $courseId)->first();
        if (!$course) {
            return response()->json(['message' => 'Course not found'], 404);
        }

        $students = Student::where('course_id', $courseId)
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'student_number']);

        $attendanceForDate = Attendance::where('course_id', $courseId)
            ->where('date', $date)
            ->with('excuseLetter')
            ->get()
            ->keyBy('student_id');

        // Build today stats
        $todayStats = [
            'present' => 0,
            'absent' => 0,
            'late' => 0,
            'excused' => 0,
        ];

        foreach ($attendanceForDate as $row) {
            if (isset($todayStats[$row->status])) {
                $todayStats[$row->status]++;
            }
        }

        // Lifetime stats per student for this course
        $allCourseAttendance = Attendance::where('course_id', $courseId)->get(['student_id', 'status']);
        $statsByStudent = $allCourseAttendance->groupBy('student_id')->map(function ($rows) {
            $present = $rows->where('status', 'present')->count();
            $absent = $rows->where('status', 'absent')->count();
            $late = $rows->where('status', 'late')->count();
            $excused = $rows->where('status', 'excused')->count();
            $total = $rows->count();
            $attendanceRate = $total > 0 ? (int) round((($present + $excused) / $total) * 100) : 100;
            return [
                'present' => $present,
                'absent' => $absent,
                'late' => $late,
                'excused' => $excused,
                'total' => $total,
                'attendanceRate' => $attendanceRate,
            ];
        });

        $pendingExcuseLetters = ExcuseLetter::whereHas('attendance', function ($q) use ($courseId) {
            $q->where('course_id', $courseId);
        })->where('status', 'pending')->count();

        $records = $students->map(function ($s) use ($attendanceForDate, $date) {
            /** @var \App\Models\Attendance|null $att */
            $att = $attendanceForDate->get($s->id);

            $letter = null;
            if ($att && $att->excuseLetter) {
                $letter = [
                    'id' => (string) $att->excuseLetter->id,
                    'submittedDate' => $att->excuseLetter->submitted_date,
                    'reason' => $att->excuseLetter->reason,
                    'attachments' => $att->excuseLetter->attachments ?? [],
                    'status' => $att->excuseLetter->status,
                    'reviewedBy' => $att->excuseLetter->reviewed_by,
                    'reviewDate' => $att->excuseLetter->review_date,
                    'reviewNotes' => $att->excuseLetter->review_notes,
                ];
            }

            return [
                'id' => $att?->id,
                'studentId' => (string) $s->id,
                'date' => $date,
                'status' => $att?->status,
                'remarks' => $att?->remarks,
                'excuseLetter' => $letter,
            ];
        })->values();

        return response()->json([
            'course' => [
                'id' => $course->id,
                'code' => $course->course_code,
                'name' => $course->course_name,
                'section' => $course->section,
                'schedule' => null,
            ],
            'students' => $students->map(fn($s) => [
                'id' => (string) $s->id,
                'name' => $s->name,
                'email' => $s->email,
                'studentNumber' => $s->student_number,
            ])->values(),
            'records' => $records,
            'todayStats' => $todayStats,
            'pendingExcuseLetters' => $pendingExcuseLetters,
            'studentStats' => $statsByStudent,
        ]);
    }

    public function upsert(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'course_id' => ['required', 'integer'],
            'student_id' => ['required', 'integer'],
            'date' => ['required', 'date_format:Y-m-d'],
            'status' => ['required', Rule::in(['present', 'absent', 'late', 'excused'])],
            'remarks' => ['nullable', 'string'],
        ]);

        $course = Course::where('user_id', $user->id)->where('id', $data['course_id'])->first();
        if (!$course) {
            return response()->json(['message' => 'Course not found'], 404);
        }

        $student = Student::where('id', $data['student_id'])->where('course_id', $course->id)->first();
        if (!$student) {
            return response()->json(['message' => 'Student not found in course'], 404);
        }

        $attendance = Attendance::updateOrCreate(
            [
                'course_id' => $course->id,
                'student_id' => $student->id,
                'date' => $data['date'],
            ],
            [
                'status' => $data['status'],
                'remarks' => $data['remarks'] ?? null,
            ]
        );

        // If marking not-excused, keep excuse letter but don't change it automatically.
        return response()->json([
            'id' => $attendance->id,
            'studentId' => (string) $attendance->student_id,
            'date' => $attendance->date,
            'status' => $attendance->status,
            'remarks' => $attendance->remarks,
        ]);
    }

    public function reviewExcuseLetter(Request $request, ExcuseLetter $excuseLetter): JsonResponse
    {
        $user = $request->user();

        /** @var \App\Models\Attendance|null $attendance */
        $attendance = $excuseLetter->attendance()->with('course')->first();
        if (!$attendance || !$attendance->course || $attendance->course->user_id !== $user->id) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $data = $request->validate([
            'action' => ['required', Rule::in(['approved', 'rejected'])],
            'notes' => ['nullable', 'string'],
        ]);

        $excuseLetter->status = $data['action'];
        $excuseLetter->reviewed_by = $user->name;
        $excuseLetter->review_date = now()->toDateString();
        $excuseLetter->review_notes = $data['notes'] ?? null;
        $excuseLetter->save();

        // Update attendance status accordingly.
        $attendance->status = $data['action'] === 'approved' ? 'excused' : 'absent';
        $attendance->save();

        return response()->json([
            'id' => (string) $excuseLetter->id,
            'status' => $excuseLetter->status,
            'reviewedBy' => $excuseLetter->reviewed_by,
            'reviewDate' => $excuseLetter->review_date,
            'reviewNotes' => $excuseLetter->review_notes,
        ]);
    }
}
