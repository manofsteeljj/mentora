<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\CourseController;
use App\Http\Controllers\MaterialController;
use App\Http\Controllers\AIController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\GoogleAuthController;
use App\Http\Controllers\GoogleClassroomController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AssessmentController;

Route::middleware(['auth'])->group(function () {
    Route::resource('courses', CourseController::class);
    Route::resource('courses.materials', MaterialController::class);
    Route::post('/materials/{material}/assessments/{assessment}/generate-questions', [AIController::class, 'generateQuestions'])->name('ai.generateQuestions');
    // Temporary: generate questions for a course using latest material
    Route::post('/courses/{course}/generate-questions', [AIController::class, 'generateForCourse'])->name('ai.generateForCourse');
});

Route::get('/', function () {
    return view('welcome');
});

// ── Google OAuth ────────────────────────────────────────────────
Route::get('/auth/google/redirect', [GoogleAuthController::class, 'redirect'])->name('google.redirect');
Route::get('/auth/google/callback', [GoogleAuthController::class, 'callback'])->name('google.callback');

// Show an assessment and its questions
Route::get('/assessments/{id}', [AssessmentController::class, 'show'])->name('assessments.show');

Route::get('/dashboard', function () {
    return view('dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // AI Chat API
    Route::post('/api/chat', [ChatController::class, 'send'])->name('chat.send');
    Route::get('/api/chat/conversations', [ChatController::class, 'conversations'])->name('chat.conversations');
    Route::get('/api/chat/history/{conversationId?}', [ChatController::class, 'history'])->name('chat.history');
    Route::delete('/api/chat/conversations/{conversationId}', [ChatController::class, 'deleteConversation'])->name('chat.deleteConversation');

    // Materials API
    Route::get('/api/materials', [MaterialController::class, 'apiIndex'])->name('api.materials.index');
    Route::post('/api/materials', [MaterialController::class, 'apiStore'])->name('api.materials.store');
    Route::delete('/api/materials/{id}', [MaterialController::class, 'apiDestroy'])->name('api.materials.destroy');
    Route::get('/api/materials/{id}/download', [MaterialController::class, 'apiDownload'])->name('api.materials.download');

    // Courses API (for dropdowns)
    Route::get('/api/courses', function (\Illuminate\Http\Request $request) {
        return response()->json(
            \App\Models\Course::where('user_id', $request->user()->id)
                ->orderBy('course_code')
                ->get(['id', 'course_code', 'course_name', 'description', 'section', 'room', 'status', 'academic_term', 'google_classroom_id'])
        );
    })->name('api.courses.index');

    // Google Classroom API
    Route::get('/api/google/status', [GoogleAuthController::class, 'status'])->name('google.status');
    Route::get('/api/google/classroom/courses', [GoogleClassroomController::class, 'listCourses'])->name('google.classroom.courses');
    Route::post('/api/google/classroom/import', [GoogleClassroomController::class, 'importCourses'])->name('google.classroom.import');
    Route::post('/api/google/classroom/sync', [GoogleClassroomController::class, 'sync'])->name('google.classroom.sync');
    Route::get('/api/google/classroom/courses/{courseId}/students', [GoogleClassroomController::class, 'listStudents'])->name('google.classroom.students');
});

require __DIR__.'/auth.php';
