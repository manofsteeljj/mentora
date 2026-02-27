<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Assessment;

class AssessmentController extends Controller
{
    public function show($id)
    {
        $assessment = Assessment::with('questions', 'course')->findOrFail($id);
        $material = null;
        if ($assessment->course) {
            $material = $assessment->course->materials()->latest()->first();
        }
        return view('assessments.show', compact('assessment', 'material'));
    }
}
