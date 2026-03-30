<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExcuseLetter extends Model
{
    protected $fillable = [
        'attendance_id',
        'submitted_date',
        'reason',
        'attachments',
        'status',
        'reviewed_by',
        'review_date',
        'review_notes',
    ];

    protected $casts = [
        'attachments' => 'array',
    ];

    public function attendance(): BelongsTo
    {
        return $this->belongsTo(Attendance::class);
    }
}
