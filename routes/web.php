<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\CourseController;
use App\Http\Controllers\MaterialController;
use App\Http\Controllers\AIController;
use App\Http\Controllers\ChatController;
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
});

require __DIR__.'/auth.php';
