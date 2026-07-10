<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <meta name="theme-color" content="#21382E">

        <title inertia>{{ config('app.name', 'Octopus') }}</title>

        <link rel="icon" type="image/png" href="/octopus-mark.png">
        <link rel="apple-touch-icon" href="/octopus-logo.png">
        <link rel="manifest" href="/manifest.webmanifest">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-title" content="Octopus">

        @routes
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx'])
        @inertiaHead
    </head>
    <body class="font-sans">
        @inertia
    </body>
</html>
