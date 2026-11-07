<?php

namespace App\Models;

use App\Models\Concerns\BelongsToSchool;
use Illuminate\Database\Eloquent\Model;

class Student extends Model
{
    use BelongsToSchool;

    protected $fillable = [
        'course_id',
        'school_id',
        'google_classroom_id',
        'student_number',
        'name',
        'email',
        'photo_url',
        'gender',
        'status',
        'dropped_at',
        'drop_reason',
    ];

    protected $casts = [
        'dropped_at' => 'datetime',
    ];

    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    public function submissions()
    {
        return $this->hasMany(Submission::class);
    }

    // Scopes for filtering students by status
    public function scopeEnrolled($query)
    {
        return $query->where('status', 'enrolled');
    }

    public function scopeDropped($query)
    {
        return $query->where('status', 'dropped');
    }

    public function scopeWithdrawn($query)
    {
        return $query->where('status', 'withdrawn');
    }

    // Helper methods
    public function isEnrolled(): bool
    {
        return $this->status === 'enrolled';
    }

    public function isDropped(): bool
    {
        return $this->status === 'dropped';
    }

    public function drop(?string $reason = null): bool
    {
        $this->status = 'dropped';
        $this->dropped_at = now();
        $this->drop_reason = $reason;
        return $this->save();
    }

    public function reinstate(): bool
    {
        $this->status = 'enrolled';
        $this->dropped_at = null;
        $this->drop_reason = null;
        return $this->save();
    }
}
