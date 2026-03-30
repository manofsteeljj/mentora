<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GradebookAssessment extends Model
{
    protected $fillable = [
        'course_id',
        'grading_period',
        'name',
        'description',
        'type',
        'max_score',
        'weight',
    ];

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function grades()
    {
        return $this->hasMany(GradebookGrade::class, 'assessment_id');
    }
}
