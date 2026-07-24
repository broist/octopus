<?php

namespace App\Support;

/**
 * Canonical catalogue of the 16 Octopus modules (spec §4).
 *
 * This is the single source of truth on the backend for:
 *  - generating the module permission set (view/create/edit/delete),
 *  - building the left sidebar navigation,
 *  - hiding menu items the current user has no access to.
 *
 * The `icon` values map to lucide-react icon names used by the frontend.
 */
class Modules
{
    /**
     * @return array<int, array{key:string,label:string,route:string,icon:string,group:string}>
     */
    public static function all(): array
    {
        return [
            ['key' => 'dashboard',      'label' => 'Vezérlőpult',                 'route' => 'dashboard',      'icon' => 'LayoutDashboard', 'group' => 'main'],
            ['key' => 'projects',       'label' => 'Projektek / Munkák',          'route' => 'projects.index', 'icon' => 'FolderKanban',    'group' => 'main'],
            ['key' => 'scheduling',     'label' => 'Ütemezés / Naptár',           'route' => 'scheduling.index', 'icon' => 'CalendarDays',  'group' => 'main'],
            // A Fájlkezelő (Dokumentumtár) és a Feladatok a fő csoportba kerültek
            // (megrendelői kérés). A kulcsok — és így a jogosultságnevek — változatlanok.
            ['key' => 'documents',      'label' => 'Fájlkezelő',                  'route' => 'documents.index', 'icon' => 'FolderOpen',     'group' => 'main'],
            ['key' => 'tasks',          'label' => 'Feladatok / To-do',           'route' => 'tasks.index',    'icon' => 'ListChecks',      'group' => 'main'],
            ['key' => 'crm',            'label' => 'Ügyfelek és partnerek',       'route' => 'crm.index',      'icon' => 'Handshake',       'group' => 'partners'],
            ['key' => 'subcontractors', 'label' => 'Alvállalkozók',               'route' => 'subcontractors.index', 'icon' => 'HardHat',   'group' => 'partners'],
            ['key' => 'staff',          'label' => 'Munkatársak / Erőforrások',   'route' => 'staff.index',    'icon' => 'Users',           'group' => 'resources'],
            ['key' => 'machines',       'label' => 'Gépek és eszközök',           'route' => 'machines.index', 'icon' => 'Truck',           'group' => 'resources'],
            ['key' => 'materials',      'label' => 'Anyagok / Készlet',           'route' => 'materials.index', 'icon' => 'Package',        'group' => 'resources'],
            // Ajánlatkérő (árajánlat-készítő) — a Működés csoport első pontja,
            // almenükkel (a portolt AcuWall app nézetei).
            ['key' => 'ajanlatok',      'label' => 'Ajánlatkérő',                 'route' => 'ajanlatok.index', 'icon' => 'FileSpreadsheet', 'group' => 'operations', 'children' => [
                ['key' => 'ajanlatok.list',       'label' => 'Ajánlatok',      'route' => 'ajanlatok.index',      'tab' => null],
                ['key' => 'ajanlatok.kalkulacio', 'label' => 'Kalkuláció',     'route' => 'ajanlatok.tab',        'tab' => 'kalkulacio'],
                ['key' => 'ajanlatok.feltetelek', 'label' => 'Feltételek',     'route' => 'ajanlatok.tab',        'tab' => 'feltetelek'],
                ['key' => 'ajanlatok.fizetes',    'label' => 'Fizetési ütem',  'route' => 'ajanlatok.tab',        'tab' => 'fizetes'],
                ['key' => 'ajanlatok.ugyfel',     'label' => 'Ügyfél nézet',   'route' => 'ajanlatok.tab',        'tab' => 'ugyfel'],
            ]],
            ['key' => 'finance',        'label' => 'Pénzügy / Költségvetés',      'route' => 'finance.index',  'icon' => 'Wallet',          'group' => 'operations'],
            ['key' => 'daily-reports',  'label' => 'Napi jelentés / Munkanapló',  'route' => 'daily-reports.index', 'icon' => 'ClipboardList', 'group' => 'operations'],
            ['key' => 'qa',             'label' => 'Minőség / Munkavédelem',      'route' => 'qa.index',       'icon' => 'ShieldCheck',     'group' => 'operations'],
            ['key' => 'communication',  'label' => 'Kommunikáció',                'route' => 'communication.index', 'icon' => 'MessageSquare', 'group' => 'operations'],
            ['key' => 'reports',        'label' => 'Riportok / Statisztikák',     'route' => 'reports.index',  'icon' => 'BarChart3',       'group' => 'insights'],
            ['key' => 'users',          'label' => 'Felhasználók / Jogosultságok', 'route' => 'users.index',   'icon' => 'UserCog',         'group' => 'admin'],
        ];
    }

    /**
     * The four base abilities every module supports.
     *
     * @return array<int, string>
     */
    public static function abilities(): array
    {
        return ['view', 'create', 'edit', 'delete'];
    }

    /**
     * The full flat list of permission names, e.g. "projects.view".
     *
     * @return array<int, string>
     */
    public static function permissionNames(): array
    {
        $permissions = [];

        foreach (self::all() as $module) {
            foreach (self::abilities() as $ability) {
                $permissions[] = "{$module['key']}.{$ability}";
            }
        }

        return $permissions;
    }

    /**
     * @return array<int, string>
     */
    public static function keys(): array
    {
        return array_column(self::all(), 'key');
    }

    /**
     * Modules that already have their own real routes/pages. Every other module
     * gets an automatic placeholder route so the sidebar is fully navigable
     * while the app is built out module by module.
     *
     * @return array<int, string>
     */
    public static function implemented(): array
    {
        return [
            'dashboard',
            'projects',
            'crm',
            'subcontractors',
            'staff',
            'machines',
            'materials',
            'finance',
            'daily-reports',
            'qa',
            'scheduling',
            'documents',
            'tasks',
            'users',
            'ajanlatok',
            'communication',
        ];
    }
}
