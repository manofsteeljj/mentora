<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Course extends Model
{
    protected $fillable = [
        'user_id',
        'google_classroom_id',
        'course_code',
        'course_name',
        'description',
        'section',
        'room',
        'status',
        'academic_term',
        'last_synced_at',
    ];

    protected function casts(): array
    {
        return [
            'last_synced_at' => 'datetime',
        ];
    }
    public function user()
    {
        return $this->belongsTo(User::class);
    }
    public function materials()
    {
        return $this->hasMany(Material::class);
    }

    public function students()
    {
        return $this->hasMany(Student::class);
    }

    public function assessments()
    {
        return $this->hasMany(Assessment::class);
    }
}
