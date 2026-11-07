<?php

namespace App\Http\Controllers;

use App\Models\School;
use Illuminate\Http\JsonResponse;

class SchoolController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            School::where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'code', 'name'])
        );
    }
}
