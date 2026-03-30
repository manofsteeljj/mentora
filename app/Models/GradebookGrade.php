<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GradebookGrade extends Model
{
    protected $fillable = [
        'assessment_id',
        'student_id',
        'score',
    ];

    protected function casts(): array
    {
        return [
            'score' => 'float',
        ];
    }

    public function assessment()
    {
        return $this->belongsTo(GradebookAssessment::class, 'assessment_id');
    }

    public function student()
    {
        return $this->belongsTo(Student::class);
    }
}
