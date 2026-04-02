<?php

namespace App\Http\Controllers;

use App\Models\Course;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CourseController extends Controller
{
    private function inferDepartmentName(Course $course): string
    {
        $name = Str::lower((string) $course->course_name);
        $code = Str::upper((string) $course->course_code);

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

    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $courses = Course::where('user_id', auth()->id())->get();
        return view('courses.index', compact('courses'));
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        return view('courses.create');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $request->validate([
            'course_code' => 'required',
            'course_name' => 'required',
        ]);

        Course::create([
            'user_id' => auth()->id(),
            'course_code' => $request->course_code,
            'course_name' => $request->course_name,
            'description' => $request->description,
            'academic_term' => $request->academic_term,
        ]);

        return redirect()->route('courses.index');
    }

    /**
     * Display the specified resource.
     */
    public function show(Course $course)
    {
        $course->load('materials');
        return view('courses.show', compact('course'));
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Course $course)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Course $course)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Course $course)
    {
        //
    }

    /**
     * Return all courses system-wide for admin pages.
     */
    public function adminIndex(Request $request)
    {
        $email = Str::lower((string) ($request->user()->email ?? ''));
        if ($email !== 'admin@mentora.local') {
            return response()->json([
                'message' => 'Forbidden',
            ], 403);
        }

        $courses = Course::with(['user:id,name'])
            ->withCount(['students', 'materials'])
            ->orderBy('course_code')
            ->get()
            ->map(function (Course $course) {
                $rawStatus = Str::upper((string) ($course->status ?? 'ACTIVE'));
                $status = match ($rawStatus) {
                    'ACTIVE' => 'Active',
                    'COMPLETED' => 'Completed',
                    default => 'Inactive',
                };

                return [
                    'id' => (string) $course->id,
                    'code' => (string) ($course->course_code ?? 'N/A'),
                    'name' => (string) ($course->course_name ?? 'Untitled Course'),
                    'department' => $this->inferDepartmentName($course),
                    'instructor' => (string) ($course->user->name ?? 'Unassigned'),
                    'students' => (int) ($course->students_count ?? 0),
                    'materials' => (int) ($course->materials_count ?? 0),
                    'section' => (string) ($course->section ?? 'N/A'),
                    'semester' => (string) ($course->academic_term ?? 'Not set'),
                    'status' => $status,
                    'startDate' => optional($course->created_at)->toDateString(),
                ];
            })
            ->values();

        return response()->json([
            'courses' => $courses,
            'total' => $courses->count(),
        ]);
    }
}
