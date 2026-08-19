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
        'docx_path',
        'docx_version',
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
        'docx_version'       => 'integer',
    ];

    /**
     * Stable ONLYOFFICE document key for this version of the lesson plan.
     * Changes whenever docx_version changes so stale sessions don't overwrite newer docs.
     */
    public function docxKey(): string
    {
        return 'dll-' . $this->id . '-v' . ($this->docx_version ?? 1);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }
}
