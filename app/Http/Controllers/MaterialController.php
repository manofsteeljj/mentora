<?php

namespace App\Http\Controllers;

use App\Models\Material;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Smalot\PdfParser\Parser;

class MaterialController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth');
    }

    public function index($courseId)
    {
        $materials = Material::where('course_id', $courseId)->get();
        return view('materials.index', compact('materials', 'courseId'));
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
}
