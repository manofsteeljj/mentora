<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserDocument extends Model
{
    protected $fillable = [
        'user_id',
        'title',
        'kind',
        'extension',
        'storage_path',
        'mime_type',
        'version',
    ];

    protected $casts = ['version' => 'integer'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function documentKey(): string
    {
        return 'personal-' . $this->id . '-v' . ($this->version ?? 1);
    }
}
