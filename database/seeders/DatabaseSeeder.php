<?php

namespace Database\Seeders;

use App\Models\User;
use App\Support\Modules;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        // 1) Permissions: view/create/edit/delete for every module.
        foreach (Modules::permissionNames() as $name) {
            Permission::findOrCreate($name, 'web');
        }

        // 2) Roles as convenient starting templates (spec §16 – per-user
        //    fine-tuning still overrides these).
        $itAdmin = Role::findOrCreate('IT Admin', 'web');
        $projektvezeto = Role::findOrCreate('Projektvezető', 'web');
        $csoportvezeto = Role::findOrCreate('Csoportvezető', 'web');
        $alvallalkozo = Role::findOrCreate('Alvállalkozó', 'web');
        $megrendelo = Role::findOrCreate('Megrendelő', 'web');

        // IT Admin implicitly gets everything via Gate::before, but we also grant
        // all permissions so role-based checks resolve too.
        $itAdmin->syncPermissions(Permission::all());

        // Projektvezető: sees & manages everything except user administration.
        $projektvezeto->syncPermissions(
            collect(Modules::permissionNames())
                ->reject(fn ($p) => str_starts_with($p, 'users.') && $p !== 'users.view')
                ->all()
        );

        // Csoportvezető: view most modules, actively works in field modules.
        $csoportvezeto->syncPermissions(array_merge(
            $this->viewOnly(['dashboard', 'projects', 'scheduling', 'crm', 'subcontractors', 'staff', 'machines', 'materials', 'finance', 'documents', 'reports']),
            $this->crud(['daily-reports', 'tasks', 'qa']),
            ['communication.view', 'communication.create', 'documents.create'],
        ));

        // Alvállalkozó: minimal internal footprint.
        $alvallalkozo->syncPermissions([
            'dashboard.view',
            'daily-reports.view', 'daily-reports.create',
            'tasks.view',
            'documents.view',
            'communication.view', 'communication.create',
        ]);

        // Megrendelő (external portal): no module permissions – access is granted
        // per shared item only (handled by the portal in Module 16).
        $megrendelo->syncPermissions([]);

        // 3) Seed the initial IT Admin user.
        $admin = User::firstOrCreate(
            ['email' => env('OCTOPUS_ADMIN_EMAIL', 'admin@octopus.local')],
            [
                'name' => 'Octopus Admin',
                'password' => Hash::make(env('OCTOPUS_ADMIN_PASSWORD', 'octopus')),
                'job_title' => 'IT Admin',
                'is_active' => true,
                'is_external' => false,
                'email_verified_at' => now(),
            ]
        );
        $admin->syncRoles([$itAdmin]);
    }

    /**
     * @param  array<int, string>  $modules
     * @return array<int, string>
     */
    private function viewOnly(array $modules): array
    {
        return array_map(fn ($m) => "{$m}.view", $modules);
    }

    /**
     * @param  array<int, string>  $modules
     * @return array<int, string>
     */
    private function crud(array $modules): array
    {
        $out = [];
        foreach ($modules as $m) {
            foreach (Modules::abilities() as $a) {
                $out[] = "{$m}.{$a}";
            }
        }

        return $out;
    }
}
