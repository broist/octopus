<?php

use Illuminate\Support\Str;

return [

    'driver' => env('SESSION_DRIVER', 'database'),

    // Tétlenségi lejárat: 120 perc (2 óra). A redis session-kulcs TTL-je minden
    // kéréskor megújul, így 2 óra inaktivitás után a munkamenet megszűnik, és a
    // rendszer visszadob a bejelentkezéshez (ott újra kéri a jelszót + MFA-t).
    'lifetime' => (int) env('SESSION_LIFETIME', 120),

    // A böngészőablak/-munkamenet bezárásakor a session-süti is megszűnjön —
    // újranyitáskor újra kell jelentkezni (jelszó + MFA). Biztonsági döntés:
    // a rendszer bizalmas cégadatokat kezel. Alapból BE (nem env-függő).
    'expire_on_close' => (bool) env('SESSION_EXPIRE_ON_CLOSE', true),

    'encrypt' => env('SESSION_ENCRYPT', false),

    'files' => storage_path('framework/sessions'),

    'connection' => env('SESSION_CONNECTION'),

    'table' => env('SESSION_TABLE', 'sessions'),

    'store' => env('SESSION_STORE'),

    'lottery' => [2, 100],

    'cookie' => env(
        'SESSION_COOKIE',
        Str::slug(env('APP_NAME', 'octopus'), '_').'_session'
    ),

    'path' => env('SESSION_PATH', '/'),

    'domain' => env('SESSION_DOMAIN'),

    'secure' => env('SESSION_SECURE_COOKIE'),

    'http_only' => env('SESSION_HTTP_ONLY', true),

    'same_site' => env('SESSION_SAME_SITE', 'lax'),

    'partitioned' => env('SESSION_PARTITIONED_COOKIE', false),

];
