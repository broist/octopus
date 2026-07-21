<?php

/*
|--------------------------------------------------------------------------
| Webes ajánlatkérések (lead-ek) beolvasása
|--------------------------------------------------------------------------
|
| Az acuwall.hu űrlapja e-mailt küld az acuwall@acuwall.hu címre; az Octopus
| ütemezetten (percenként) lekérdezi a postafiókot IMAP-on, és minden új
| ajánlatkérésből projektet + felületi értesítést készít.
|
| Amíg a LEADS_IMAP_HOST üres, a beolvasás ki van kapcsolva.
|
*/

return [
    'imap' => [
        'host' => env('LEADS_IMAP_HOST'),
        'port' => env('LEADS_IMAP_PORT', 993),
        'encryption' => env('LEADS_IMAP_ENCRYPTION', 'ssl'),
        'validate_cert' => env('LEADS_IMAP_VALIDATE_CERT', true),
        'username' => env('LEADS_IMAP_USERNAME'),
        'password' => env('LEADS_IMAP_PASSWORD'),
        'folder' => env('LEADS_IMAP_FOLDER', 'INBOX'),
        'lookback_days' => env('LEADS_IMAP_LOOKBACK_DAYS', 7),
    ],

    // Alternatív út: a weboldal közvetlen HTTP POST-tal is beküldheti a leadet
    // (POST /webhooks/lead, X-Octopus-Token fejléccel). Üres token = kikapcsolva.
    'webhook_token' => env('LEADS_WEBHOOK_TOKEN'),
];
