<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;

trait BelongsToSchool
{
    protected static function bootBelongsToSchool(): void
    {
        static::addGlobalScope('school', function (Builder $builder): void {
            if ($builder->getModel() instanceof \App\Models\User) {
                return;
            }

            $schoolId = Auth::user()?->school_id;
            if ($schoolId) {
                $builder->where($builder->getModel()->getTable() . '.school_id', $schoolId);
            }
        });

        static::creating(function ($model): void {
            if (!$model->school_id && Auth::user()?->school_id) {
                $model->school_id = Auth::user()->school_id;
            }
        });
    }

    public function school()
    {
        return $this->belongsTo(\App\Models\School::class);
    }
}
