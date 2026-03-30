<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Submission extends Model
{
    protected $fillable = [
        'student_id',
        'assessment_id',
        'google_classroom_id',
        'state',
        'assigned_grade',
        'draft_grade',
        'late',
        'submitted_at',
        'feedback',
    ];

    protected function casts(): array
    {
        return [
            'late' => 'boolean',
            'submitted_at' => 'datetime',
            'assigned_grade' => 'decimal:2',
            'draft_grade' => 'decimal:2',
        ];
    }

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function assessment()
    {
        return $this->belongsTo(Assessment::class);
    }

    public function grades()
    {
        return $this->hasMany(Grade::class);
    }
}
