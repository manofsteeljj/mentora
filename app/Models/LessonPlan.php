<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LessonPlan extends Model
{
    /** Admin review statuses. */
    public const STATUS_PENDING        = 'pending';
    public const STATUS_APPROVED       = 'approved';
    public const STATUS_DENIED         = 'denied';
    public const STATUS_NEEDS_REVISION = 'needs_revision';

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
        'submitted_at',
        'admin_feedback',
        'reviewed_by',
        'reviewed_at',
    ];

    protected $casts = [
        'objectives'         => 'array',
        'content'            => 'array',
        'learning_resources' => 'array',
        'procedures'         => 'array',
        'remarks'            => 'array',
        'reflection'         => 'array',
        'docx_version'       => 'integer',
        'submitted_at'       => 'datetime',
        'reviewed_at'        => 'datetime',
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

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(LessonPlanComment::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    /** Statuses a teacher can resubmit from. */
    public static function resubmittableStatuses(): array
    {
        return [self::STATUS_DENIED, self::STATUS_NEEDS_REVISION];
    }
}
