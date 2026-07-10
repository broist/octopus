<?php

namespace App\Http\Middleware;

use App\Support\Modules;
use Illuminate\Http\Request;
use Inertia\Middleware;
use Tighten\Ziggy\Ziggy;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),
            'app' => [
                'name' => config('app.name'),
                'locale' => app()->getLocale(),
            ],
            'auth' => [
                'user' => $user ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'initials' => $user->initials(),
                    'phone' => $user->phone,
                    'job_title' => $user->job_title,
                    'avatar_path' => $user->avatar_path,
                    'is_external' => (bool) $user->is_external,
                    'two_factor_enabled' => $user->hasTwoFactorEnabled(),
                ] : null,
                'roles' => $user ? $user->getRoleNames()->values() : [],
                'permissions' => $user ? $user->getAllPermissions()->pluck('name')->values() : [],
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                'info' => fn () => $request->session()->get('info'),
            ],
            'nav' => fn () => $this->navigation($user),
            'ziggy' => fn (): array => [
                ...(new Ziggy)->toArray(),
                'location' => $request->url(),
            ],
        ];
    }

    /**
     * Build the sidebar navigation for the current user.
     *
     * External (client portal) users get no menu; internal users only see the
     * modules they may view (spec §16 – menu hiding by permission).
     *
     * @return array<int, array<string, string>>
     */
    protected function navigation(?\App\Models\User $user): array
    {
        if (! $user || $user->is_external) {
            return [];
        }

        return collect(Modules::all())
            ->filter(fn (array $module) => $user->can("{$module['key']}.view"))
            ->map(fn (array $module) => [
                'key' => $module['key'],
                'label' => $module['label'],
                'route' => $module['route'],
                'icon' => $module['icon'],
                'group' => $module['group'],
            ])
            ->values()
            ->all();
    }
}
