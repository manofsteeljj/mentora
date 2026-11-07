<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;

class Material extends Model
{
    use BelongsToSchool;

    protected $fillable = [
        'course_id',
        'school_id',
        'google_classroom_id',
        'google_drive_file_id',
        'source_type',
        'material_type',
        'title',
        'description',
        'file_path',
        'link',
        'thumbnail_url',
        'extracted_text',
    ];

    public function course()
    {
        return $this->belongsTo(Course::class);
    }
}
