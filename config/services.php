<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    // Weather provider for the Daily Report module (auto weather by site location).
    'weather' => [
        'provider' => env('WEATHER_PROVIDER', 'open-meteo'),
        'api_key' => env('WEATHER_API_KEY'),
    ],

    // Apple / iCloud CalDAV (Apple ID + app-specific password, per-user credentials
    // are stored encrypted against the user, not here).
    'caldav' => [
        'icloud_base_url' => env('CALDAV_ICLOUD_BASE_URL', 'https://caldav.icloud.com'),
    ],

    // Számlázz.hu Számla Agent API (integrated as the final step).
    'szamlazzhu' => [
        'agent_key' => env('SZAMLAZZHU_AGENT_KEY'),
        'api_url' => env('SZAMLAZZHU_API_URL', 'https://www.szamlazz.hu/szamla/'),
    ],

];
