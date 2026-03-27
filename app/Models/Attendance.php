<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Attendance extends Model
{
    protected $fillable = [
        'course_id',
        'student_id',
        'date',
        'status',
        'remarks',
    ];



    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function excuseLetter(): HasOne
    {
        return $this->hasOne(ExcuseLetter::class);
    }
}
