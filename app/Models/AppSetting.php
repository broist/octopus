<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Felületről állítható, apró kulcs–érték beállítás (lásd App\Support\Settings).
 */
class AppSetting extends Model
{
    protected $primaryKey = 'key';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['key', 'value'];

    protected function casts(): array
    {
        return [
            'value' => 'array',
        ];
    }
}
