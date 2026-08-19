<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClassRecordDocument extends Model
{
    protected $fillable = ['user_id', 'title', 'xlsx_path', 'xlsx_version'];

    protected $casts = ['xlsx_version' => 'integer'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function docxKey(): string
    {
        return 'cr-' . $this->id . '-v' . ($this->xlsx_version ?? 1);
    }
}
