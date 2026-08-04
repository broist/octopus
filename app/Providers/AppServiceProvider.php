<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);

        // IT Admin bypasses every ability check (spec §16).
        Gate::before(function (User $user, string $ability) {
            return $user->hasRole('IT Admin') ? true : null;
        });

        // Élesben a rendszer fordított proxy MÖGÖTT fut (a konténer nginx-e a
        // 127.0.0.1:8080-on hallgat, a TLS-t a gazdagép nginx-e zárja le), ezért
        // a kérés séma és hoszt szerint http://localhost:8080-nak látszik. E
        // nélkül a generált linkek — jelszó-visszaállító e-mail, Inertia-
        // átirányítás, PDF-hivatkozás — a belső címre mutatnának.
        if ($this->app->environment('production')) {
            URL::forceScheme('https');
            URL::forceRootUrl(config('app.url'));
        }
    }
}
