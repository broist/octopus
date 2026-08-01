<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory;
    use Notifiable;
    use TwoFactorAuthenticatable;
    use HasRoles;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'phone',
        'job_title',
        'hired_on',
        'avatar_path',
        'locale',
        'is_active',
        'is_external',
        'partner_id',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_recovery_codes',
        'two_factor_secret',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'hired_on' => 'date',
            'is_active' => 'boolean',
            'is_external' => 'boolean',
        ];
    }

    // --- Munkatársak / Erőforrások (6. modul) ---

    public function qualifications(): HasMany
    {
        return $this->hasMany(StaffQualification::class)->orderByRaw('valid_until is null, valid_until');
    }

    public function workLogs(): HasMany
    {
        return $this->hasMany(WorkLog::class)->orderByDesc('work_date');
    }

    public function absences(): HasMany
    {
        return $this->hasMany(StaffAbsence::class)->orderByDesc('starts_on');
    }

    // --- Naptár-szinkron (3. modul, CalDAV) ---

    public function calendarCredentials(): HasMany
    {
        return $this->hasMany(CalendarCredential::class)->orderByDesc('created_at');
    }

    // --- Ügyfélportál ---

    /**
     * Külső (portál-) fióknál az a megrendelő, akinek a tartalmát látja.
     */
    public function partner(): BelongsTo
    {
        return $this->belongsTo(Partner::class);
    }

    /**
     * Beléphet-e az ügyfélportálra: külső fiók, aktív, és van partnere.
     * A partner-kötés maga a hozzáférés-vezérlés — enélkül nincs mit mutatni.
     */
    public function isClientPortalUser(): bool
    {
        return $this->is_external && $this->is_active && $this->partner_id !== null;
    }

    /**
     * Belső munkatársak (nem külső portál-felhasználók) — a Staff modul köre.
     */
    public function scopeInternal(Builder $query): Builder
    {
        return $query->where('is_external', false);
    }

    /**
     * Initials used for the avatar circle in the UI.
     */
    public function initials(): string
    {
        $parts = preg_split('/\s+/', trim($this->name)) ?: [];
        $letters = array_map(fn ($p) => mb_substr($p, 0, 1), array_slice($parts, 0, 2));

        return mb_strtoupper(implode('', $letters)) ?: 'U';
    }

    /**
     * Whether the two-factor authentication is fully enabled & confirmed.
     */
    public function hasTwoFactorEnabled(): bool
    {
        return ! is_null($this->two_factor_secret) && ! is_null($this->two_factor_confirmed_at);
    }
}
