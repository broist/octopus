<?php

namespace Database\Seeders;

use App\Models\User;
use App\Support\Modules;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Idempotens alap-seeder — minden konténer-indításkor lefut (migrate --seed).
 *
 * ÉLES-BIZTONSÁG: meglévő adatot soha nem ír felül.
 *  - A jogosultság-neveket csak LÉTREHOZZA, ha hiányoznak (új modulok jogai).
 *  - A szerep-sablonokat csak akkor hozza létre, ha a szerep még nem létezik —
 *    a később (16. modul) testre szabott szerep-jogokat nem állítja vissza.
 *  - Kivétel az IT Admin: ő mindig minden jogot megkap (az új modulokét is).
 *  - Az admin felhasználót csak akkor hozza létre, ha még nincs; jelszavát,
 *    adatait meglévő fióknál nem módosítja.
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        // 1) Jogosultságok: view/create/edit/delete minden modulhoz (csak pótlás).
        foreach (Modules::permissionNames() as $name) {
            Permission::findOrCreate($name, 'web');
        }

        // 2) IT Admin: mindig létezik és mindig mindenre jogosult.
        $itAdmin = Role::findOrCreate('IT Admin', 'web');
        $itAdmin->syncPermissions(Permission::all());

        // 3) Szerep-sablonok — CSAK első létrehozáskor kapják meg a sablon-jogokat.
        $this->createRoleIfMissing('Projektvezető', collect(Modules::permissionNames())
            ->reject(fn ($p) => str_starts_with($p, 'users.') && $p !== 'users.view')
            ->all());

        $this->createRoleIfMissing('Csoportvezető', array_merge(
            $this->viewOnly(['dashboard', 'projects', 'scheduling', 'crm', 'subcontractors', 'staff', 'machines', 'materials', 'finance', 'documents', 'reports']),
            $this->crud(['daily-reports', 'tasks', 'qa']),
            ['communication.view', 'communication.create', 'documents.create'],
        ));

        $this->createRoleIfMissing('Alvállalkozó', [
            'dashboard.view',
            'daily-reports.view', 'daily-reports.create',
            'tasks.view',
            'documents.view',
            'communication.view', 'communication.create',
        ]);

        // Megrendelő (külső portál): jog nélkül — csak a kifejezetten megosztott
        // tartalmat éri majd el (16. modul).
        $this->createRoleIfMissing('Megrendelő', []);

        // Sebészi pótlás meglévő telepítésekhez (nem írja felül a testreszabást):
        // a Projektvezető megkapja az Ajánlatkérő modul jogait (megrendelői kérés).
        if ($pv = Role::where('name', 'Projektvezető')->where('guard_name', 'web')->first()) {
            $pv->givePermissionTo(['ajanlatok.view', 'ajanlatok.create', 'ajanlatok.edit', 'ajanlatok.delete']);
        }

        // 4) Kezdő admin felhasználó — csak ha még nem létezik.
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

        if (! $admin->hasRole('IT Admin')) {
            $admin->assignRole($itAdmin);
        }
    }

    /**
     * @param  array<int, string>  $permissions
     */
    private function createRoleIfMissing(string $name, array $permissions): void
    {
        if (Role::where('name', $name)->where('guard_name', 'web')->exists()) {
            return;
        }

        Role::create(['name' => $name, 'guard_name' => 'web'])
            ->syncPermissions($permissions);
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
