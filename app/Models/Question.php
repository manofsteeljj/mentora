<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Question extends Model
{
    protected $fillable = [
        'assessment_id',
        'question_type',
        'question_text',
        'points',
    ];

    public function assessment()
    {
        return $this->belongsTo(Assessment::class);
    }
}
