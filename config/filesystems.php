<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    */

    'default' => env('FILESYSTEM_DISK', 'local'),

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => env('APP_URL').'/storage',
            'visibility' => 'public',
            'throw' => false,
        ],

        // Octopus: general documents (contracts, permits, photos) on the server disk.
        // Not "served" by Laravel: access is authorised per-document and streamed
        // through the Document Library controller (spec §10 permissions).
        'documents' => [
            'driver' => 'local',
            'root' => storage_path('app/documents'),
            'serve' => false,
            'visibility' => 'private',
            'throw' => false,
        ],

        // Octopus: large plan/drawing files on S3-compatible storage (presigned URLs).
        'plans' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION', 'eu-central-1'),
            'bucket' => env('AWS_BUCKET', 'octopus-plans'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            'throw' => false,
            'visibility' => 'private',
        ],

    ],

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];
