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
}
