<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A generated School Form 2 (SF2) Daily Attendance Report workbook that can
 * be opened and edited through ONLYOFFICE — the spreadsheet counterpart of
 * the lesson-plan DOCX flow.
 */
class AttendanceDocument extends Model
{
    protected $fillable = [
        'user_id',
        'course_id',
        'month',
        'year',
        'title',
        'xls_path',
        'xls_version',
    ];

    protected $casts = [
        'month' => 'integer',
        'year' => 'integer',
        'xls_version' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    /**
     * ONLYOFFICE document key — changes whenever the stored file is replaced
     * so the editor never serves a stale cached copy.
     */
    public function docxKey(): string
    {
        return 'sf2-' . $this->id . '-v' . ($this->xls_version ?? 1);
    }
}
