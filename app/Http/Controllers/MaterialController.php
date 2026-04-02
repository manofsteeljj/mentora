<?php

namespace App\Http\Controllers;

use App\Models\Material;
use App\Models\Course;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Smalot\PdfParser\Parser;

class MaterialController extends Controller
{
    private function getReadableFileSize(?string $filePath): string
    {
        if (!$filePath) {
            return '0 KB';
        }

        try {
            if (!Storage::disk('public')->exists($filePath)) {
                return '0 KB';
            }

            $bytes = Storage::disk('public')->size($filePath);
            if ($bytes >= 1048576) {
                return round($bytes / 1048576, 1) . ' MB';
            }

            return round($bytes / 1024) . ' KB';
        } catch (\Throwable $e) {
            return '0 KB';
        }
    }

    private function detectFileType(Material $material): string
    {
        $ext = $material->file_path
            ? strtolower(pathinfo($material->file_path, PATHINFO_EXTENSION))
            : '';

        return match ($ext) {
            'pdf' => 'PDF',
            'docx', 'doc' => 'DOCX',
            'pptx', 'ppt' => 'PPTX',
            'xlsx', 'xls' => 'XLSX',
            'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg' => 'Image',
            'mp4', 'mov', 'avi', 'mkv', 'webm' => 'Video',
            default => 'Other',
        };
    }

    private function detectCategory(Material $material): string
    {
        $haystack = Str::lower(trim((string) ($material->title ?? '')) . ' ' . trim((string) ($material->material_type ?? '')));

        if (str_contains($haystack, 'syllabus')) return 'Syllabus';
        if (str_contains($haystack, 'quiz')) return 'Quiz';
        if (str_contains($haystack, 'assign')) return 'Assignment';
        if (str_contains($haystack, 'lab')) return 'Lab';
        if (str_contains($haystack, 'reference')) return 'Reference';

        return 'Lecture';
    }

    public function __construct()
    {
        $this->middleware('auth');
    }

    public function index($courseId)
    {
        $materials = Material::where('course_id', $courseId)->get();
        $course = Course::find($courseId);
        $courseLabel = $course
            ? trim(($course->course_code ? $course->course_code . ' - ' : '') . ($course->course_name ?? ''))
            : 'Unknown Course';

        return view('materials.index', compact('materials', 'courseId', 'courseLabel'));
    }

    public function store(Request $request, $courseId)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'file' => 'required|mimes:pdf|max:10240',
        ]);

        $path = $request->file('file')->store('materials', 'public');

        // Extract text from uploaded PDF
        $fullPath = storage_path('app/public/' . $path);
        $text = null;
        try {
            $parser = new Parser();
            $pdf = $parser->parseFile($fullPath);
            $text = $pdf->getText();
        } catch (\Throwable $e) {
            // If extraction fails, keep extracted_text null but continue
            $text = null;
        }

        $material = Material::create([
            'course_id' => $courseId,
            'title' => $request->input('title'),
            'file_path' => $path,
            'extracted_text' => $text,
        ]);

        return back()->with('status', 'Material uploaded.');
    }

    public function show($courseId, $id)
    {
        $material = Material::where('course_id', $courseId)->findOrFail($id);
        $fullPath = Storage::disk('public')->path($material->file_path);
        return response()->file($fullPath);
    }

    public function destroy($courseId, $id)
    {
        $material = Material::where('course_id', $courseId)->findOrFail($id);
        Storage::disk('public')->delete($material->file_path);
        $material->delete();
        return back()->with('status', 'Material deleted.');
    }

    /**
     * API: List all materials for the authenticated user's courses.
     */
    public function apiIndex(Request $request)
    {
        $userId = $request->user()->id;

        $materials = Material::with('course')
            ->whereHas('course', function ($q) use ($userId) {
                $q->where('user_id', $userId);
            })
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($m) {
                $size = null;
                try {
                    if ($m->file_path && Storage::disk('public')->exists($m->file_path)) {
                        $bytes = Storage::disk('public')->size($m->file_path);
                        if ($bytes >= 1048576) {
                            $size = round($bytes / 1048576, 1) . ' MB';
                        } else {
                            $size = round($bytes / 1024) . ' KB';
                        }
                    }
                } catch (\Exception $e) {
                    $size = null;
                }

                if ($m->file_path) {
                    $ext = strtolower(pathinfo($m->file_path, PATHINFO_EXTENSION));
                } else {
                    $ext = '';
                }

                $typeMap = [
                    'pdf' => 'PDF',
                    'pptx' => 'PowerPoint',
                    'ppt' => 'PowerPoint',
                    'docx' => 'Word',
                    'doc' => 'Word',
                    'xlsx' => 'Excel',
                    'xls' => 'Excel',
                    'txt' => 'Text',
                ];

                // For Google Classroom materials, use material_type for display
                $displayType = $typeMap[$ext] ?? strtoupper($ext);
                if (!$displayType && $m->material_type) {
                    $displayType = match ($m->material_type) {
                        'drive_file' => 'Drive File',
                        'youtube'    => 'YouTube',
                        'link'       => 'Link',
                        'form'       => 'Form',
                        default      => ucfirst($m->material_type),
                    };
                }

                return [
                    'id'            => $m->id,
                    'title'         => $m->title ?: basename($m->file_path ?? 'Untitled'),
                    'file_path'     => $m->file_path,
                    'type'          => $displayType ?: 'File',
                    'size'          => $size,
                    'course_id'     => $m->course_id,
                    'course_name'   => $m->course ? ($m->course->course_code . ' - ' . $m->course->course_name) : 'Unknown',
                    'uploaded_at'   => $m->created_at->toDateString(),
                    'source_type'   => $m->source_type ?? 'local',
                    'material_type' => $m->material_type ?? 'file',
                    'link'          => $m->link,
                    'description'   => $m->description,
                    'thumbnail_url' => $m->thumbnail_url,
                    'has_text'      => !empty($m->extracted_text),
                ];
            });

        return response()->json($materials);
    }

    /**
     * API: Upload a material file.
     */
    public function apiStore(Request $request)
    {
        $request->validate([
            'title'     => 'required|string|max:255',
            'course_id' => 'required|exists:courses,id',
            'file'      => 'required|mimes:pdf,pptx,ppt,docx,doc,xlsx,xls,txt|max:10240',
        ]);

        // Ensure user owns the course
        $course = \App\Models\Course::where('id', $request->input('course_id'))
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $path = $request->file('file')->store('materials', 'public');

        // Extract text from PDF
        $text = null;
        $ext = strtolower($request->file('file')->getClientOriginalExtension());
        if ($ext === 'pdf') {
            try {
                $parser = new Parser();
                $pdf = $parser->parseFile(storage_path('app/public/' . $path));
                $text = $pdf->getText();
            } catch (\Throwable $e) {
                $text = null;
            }
        }

        $material = Material::create([
            'course_id'      => $course->id,
            'title'          => $request->input('title'),
            'file_path'      => $path,
            'extracted_text'  => $text,
        ]);

        return response()->json(['success' => true, 'id' => $material->id]);
    }

    /**
     * API: Delete a material.
     */
    public function apiDestroy(Request $request, $id)
    {
        $material = Material::whereHas('course', function ($q) use ($request) {
            $q->where('user_id', $request->user()->id);
        })->findOrFail($id);

        Storage::disk('public')->delete($material->file_path);
        $material->delete();

        return response()->json(['success' => true]);
    }

    /**
     * API: Download / view a material file.
     */
    public function apiDownload(Request $request, $id)
    {
        $material = Material::whereHas('course', function ($q) use ($request) {
            $q->where('user_id', $request->user()->id);
        })->findOrFail($id);

        $fullPath = Storage::disk('public')->path($material->file_path);
        return response()->file($fullPath);
    }

    /**
     * API: Get materials for a specific course (with extracted text for RAG)
     */
    public function apiCourseMaterials(Request $request, $courseId)
    {
        // Verify user owns this course
        $course = \App\Models\Course::where('id', $courseId)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $materials = Material::where('course_id', $courseId)
            ->where(function ($q) {
                $q->whereNotNull('extracted_text')
                  ->where('extracted_text', '!=', '');
            })
            ->orderBy('created_at', 'desc')
            ->get(['id', 'title', 'extracted_text', 'material_type', 'source_type'])
            ->map(function ($m) {
                return [
                    'id' => $m->id,
                    'title' => $m->title,
                    'text' => $m->extracted_text,
                    'type' => $m->material_type ?? 'document',
                ];
            });

        return response()->json($materials);
    }

    /**
     * API: List all materials system-wide for admin pages.
     */
    public function adminIndex(Request $request)
    {
        $email = Str::lower((string) ($request->user()->email ?? ''));
        if ($email !== 'admin@mentora.local') {
            return response()->json([
                'message' => 'Forbidden',
            ], 403);
        }

        $materials = Material::with(['course:id,course_code,course_name,user_id', 'course.user:id,name'])
            ->latest('created_at')
            ->get()
            ->map(function (Material $material) {
                $courseCode = (string) ($material->course?->course_code ?? 'N/A');
                $courseName = (string) ($material->course?->course_name ?? 'Unassigned Course');

                return [
                    'id' => (string) $material->id,
                    'fileName' => (string) ($material->title ?: basename((string) ($material->file_path ?? 'Untitled'))),
                    'fileType' => $this->detectFileType($material),
                    'fileSize' => $this->getReadableFileSize($material->file_path),
                    'course' => $courseName,
                    'courseCode' => $courseCode,
                    'uploadedBy' => (string) ($material->course?->user?->name ?? 'System'),
                    'uploadDate' => optional($material->created_at)->toDateString(),
                    'category' => $this->detectCategory($material),
                ];
            })
            ->values();

        return response()->json([
            'materials' => $materials,
            'total' => $materials->count(),
        ]);
    }
}

