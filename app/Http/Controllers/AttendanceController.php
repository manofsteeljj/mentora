<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\Course;
use App\Models\ExcuseLetter;
use App\Models\Student;
use App\Services\SF2ExportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
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

        // Lifetime stats per student for this course — aggregated in SQL (not PHP)
        $statsByStudent = Attendance::where('course_id', $courseId)
            ->selectRaw("student_id,
                SUM(status = 'present') as present,
                SUM(status = 'absent')  as absent,
                SUM(status = 'late')    as late,
                SUM(status = 'excused') as excused,
                COUNT(*) as total")
            ->groupBy('student_id')
            ->get()
            ->keyBy('student_id')
            ->map(function ($row) {
                $total   = (int) $row->total;
                $present = (int) $row->present;
                $excused = (int) $row->excused;
                $attendanceRate = $total > 0
                    ? (int) round((($present + $excused) / $total) * 100)
                    : 100;
                return [
                    'present'        => $present,
                    'absent'         => (int) $row->absent,
                    'late'           => (int) $row->late,
                    'excused'        => $excused,
                    'total'          => $total,
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

    /**
     * Export School Form 2 (SF2) Daily Attendance Report
     *
     * @param Request $request
     * @return \Symfony\Component\HttpFoundation\BinaryFileResponse
     */
    public function exportSF2(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'course_id' => ['required', 'integer'],
            'month' => ['required', 'integer', 'min:1', 'max:12'],
            'year' => ['required', 'integer', 'min:2020', 'max:2100'],
            'school_name' => ['nullable', 'string'],
            'school_id' => ['nullable', 'string'],
            'grade_level' => ['nullable', 'string'],
            'adviser_name' => ['nullable', 'string'],
            'school_head' => ['nullable', 'string'],
        ]);

        $course = Course::where('user_id', $user->id)
            ->where('id', $data['course_id'])
            ->with('user')
            ->first();

        if (!$course) {
            abort(404, 'Course not found');
        }

        // Values not provided by the request keep whatever the official SF2
        // template already carries (school name, school ID, school head …).
        $config = [
            'school_name' => $data['school_name'] ?? '',
            'school_id' => $data['school_id'] ?? '',
            'grade_level' => $data['grade_level'] ?? '',
            'adviser_name' => $data['adviser_name'] ?? strtoupper($user->name),
            'school_head' => $data['school_head'] ?? '',
        ];

        // Generate SF2 Excel file from the official template
        $sf2Service = new SF2ExportService();
        $tempFile = $sf2Service->generate($course, $data['month'], $data['year'], $config);

        // Filename follows the reference file: SF2_{SY start}_{Grade}-{Section}_{Month}.xls
        [$gradeLevel, $section] = $this->splitGradeAndSection($course->section ?? '', $config['grade_level']);
        $syStart = $data['month'] >= 6 ? $data['year'] : $data['year'] - 1;
        $monthName = date('F', mktime(0, 0, 0, $data['month'], 1, $data['year']));
        $fileName = sprintf(
            'SF2_%d_%s-%s_%s.xls',
            $syStart,
            preg_replace('/[^A-Za-z0-9 ]/', '', $gradeLevel ?: 'Grade'),
            preg_replace('/[^A-Za-z0-9 ]/', '', $section ?: 'Section'),
            preg_replace('/[^A-Za-z]/', '', $monthName)
        );

        return response()->download($tempFile, $fileName, [
            'Content-Type' => 'application/vnd.ms-excel',
        ])->deleteFileAfterSend(true);
    }

    /**
     * Split a course section like "6 - RIZAL" into ["Grade 6", "RIZAL"].
     * Falls back to the provided grade level and raw section otherwise.
     */
    private function splitGradeAndSection(string $section, string $gradeLevel): array
    {
        if ($gradeLevel !== '') {
            return [$gradeLevel, $section];
        }
        if (preg_match('/^\s*(\d+)\s*[-–]\s*(.+?)\s*$/', $section, $m)) {
            return ['Grade ' . $m[1], $m[2]];
        }
        return ['', $section];
    }
}
