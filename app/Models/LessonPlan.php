<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LessonPlan extends Model
{
    protected $fillable = [
        'user_id',
        'course_id',
        'title',
        'grade_level',
        'subject',
        'topic',
        'duration',
        'learning_competency',
        'teaching_strategy',
        'available_resources',
        'objectives',
        'content',
        'learning_resources',
        'procedures',
        'remarks',
        'reflection',
        'raw_ai_output',
        'ai_model',
        'status',
    ];

    protected $casts = [
        'objectives'         => 'array',
        'content'            => 'array',
        'learning_resources' => 'array',
        'procedures'         => 'array',
        'remarks'            => 'array',
        'reflection'         => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }
}
