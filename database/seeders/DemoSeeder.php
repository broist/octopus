<?php

namespace Database\Seeders;

use App\Models\Partner;
use App\Models\Project;
use Illuminate\Database\Seeder;

/**
 * Demó adatok kiértékeléshez — CSAK kézzel futtatandó:
 *
 *   php artisan db:seed --class=DemoSeeder
 *
 * Nem fut le az alap seedeléskor; és ha már van projekt, nem csinál semmit.
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        if (Project::withTrashed()->exists()) {
            $this->command?->warn('Már vannak projektek – a demó seedelés kimarad.');

            return;
        }

        $admin = \App\Models\User::where('email', 'admin@octopus.local')->first();

        // --- Megrendelők ---
        $kovacs = Partner::create([
            'name' => 'Kovács és Társa Kft.',
            'is_client' => true,
            'contact_name' => 'Kovács Péter',
            'email' => 'kovacs.peter@example.com',
            'phone' => '+36 30 123 4567',
        ]);
        $horizont = Partner::create([
            'name' => 'Horizont Ingatlan Zrt.',
            'is_client' => true,
            'contact_name' => 'Nagy Ildikó',
            'email' => 'nagy.ildiko@example.com',
        ]);
        $maganszemely = Partner::create([
            'name' => 'Szabó János',
            'is_company' => false,
            'is_client' => true,
            'phone' => '+36 20 987 6543',
        ]);

        // --- 1) Folyamatban lévő családi ház, élő Gantt-tal ---
        $haz = Project::create([
            'code' => 'P-2026-001',
            'name' => 'Kertvárosi családi ház építése',
            'client_id' => $maganszemely->id,
            'project_manager_id' => $admin?->id,
            'status' => 'folyamatban',
            'construction_type' => 'ujepites',
            'location_city' => 'Szentendre',
            'location_address' => 'Rózsa utca 12.',
            'starts_on' => today()->subDays(60),
            'ends_on' => today()->addDays(90),
            'description' => 'Kétszintes, 140 m²-es családi ház kulcsrakész kivitelezése.',
        ]);

        $alapozas = $haz->phases()->create([
            'name' => 'Alapozás', 'sort_order' => 1,
            'starts_on' => today()->subDays(60), 'due_on' => today()->subDays(35),
            'progress' => 100,
        ]);
        $szerkezet = $haz->phases()->create([
            'name' => 'Szerkezetépítés', 'sort_order' => 2,
            'starts_on' => today()->subDays(34), 'due_on' => today()->addDays(10),
            'progress' => 65,
        ]);
        $gepeszet = $haz->phases()->create([
            'name' => 'Gépészet, villanyszerelés', 'sort_order' => 3,
            'starts_on' => today()->addDays(5), 'due_on' => today()->addDays(45),
            'progress' => 0,
        ]);
        $befejezo = $haz->phases()->create([
            'name' => 'Befejező munkák', 'sort_order' => 4,
            'starts_on' => today()->addDays(40), 'due_on' => today()->addDays(85),
            'progress' => 0,
        ]);
        $szerkezet->dependencies()->sync([$alapozas->id]);
        $gepeszet->dependencies()->sync([$szerkezet->id]);
        $befejezo->dependencies()->sync([$gepeszet->id]);

        $haz->logActivity('letrehozva', 'Projekt létrehozva: Kertvárosi családi ház építése', $admin);
        $haz->logActivity('fazis', 'Fázis elkészült: Alapozás', $admin);
        $haz->logActivity('statusz', 'Státusz módosítva: Szerződött → Folyamatban', $admin);

        // --- 2) Irodaház-felújítás alprojektekkel, egy csúszó fázissal ---
        $iroda = Project::create([
            'code' => 'P-2026-002',
            'name' => 'Belvárosi irodaház felújítása',
            'client_id' => $horizont->id,
            'project_manager_id' => $admin?->id,
            'status' => 'folyamatban',
            'construction_type' => 'felujitas',
            'location_city' => 'Budapest',
            'location_address' => 'Károly krt. 8.',
            'starts_on' => today()->subDays(30),
            'ends_on' => today()->addDays(120),
            'description' => 'Két épületszárny teljes belső felújítása, ütemezett átadással.',
        ]);

        $aSzarny = Project::create([
            'parent_id' => $iroda->id,
            'code' => 'P-2026-002-A',
            'name' => 'A szárny – 1–3. emelet',
            'client_id' => $horizont->id,
            'project_manager_id' => $admin?->id,
            'status' => 'folyamatban',
            'construction_type' => 'felujitas',
            'location_city' => 'Budapest',
            'starts_on' => today()->subDays(30),
            'ends_on' => today()->addDays(40),
        ]);
        $bontas = $aSzarny->phases()->create([
            'name' => 'Bontás', 'sort_order' => 1,
            'starts_on' => today()->subDays(30), 'due_on' => today()->subDays(18),
            'progress' => 100,
        ]);
        // Szándékosan csúszó fázis (lejárt határidő, 40%):
        $villany = $aSzarny->phases()->create([
            'name' => 'Villamos hálózat cseréje', 'sort_order' => 2,
            'starts_on' => today()->subDays(17), 'due_on' => today()->subDays(2),
            'progress' => 40,
        ]);
        $burkolas = $aSzarny->phases()->create([
            'name' => 'Burkolás, festés', 'sort_order' => 3,
            'starts_on' => today()->addDays(3), 'due_on' => today()->addDays(35),
            'progress' => 0,
        ]);
        $villany->dependencies()->sync([$bontas->id]);
        $burkolas->dependencies()->sync([$villany->id]);

        Project::create([
            'parent_id' => $iroda->id,
            'code' => 'P-2026-002-B',
            'name' => 'B szárny – földszint + fogadótér',
            'client_id' => $horizont->id,
            'project_manager_id' => $admin?->id,
            'status' => 'szerzodott',
            'construction_type' => 'felujitas',
            'location_city' => 'Budapest',
            'starts_on' => today()->addDays(30),
            'ends_on' => today()->addDays(110),
        ]);

        $iroda->logActivity('letrehozva', 'Projekt létrehozva: Belvárosi irodaház felújítása', $admin);
        $iroda->logActivity('alprojekt', 'Új alprojekt: A szárny – 1–3. emelet', $admin);
        $iroda->logActivity('alprojekt', 'Új alprojekt: B szárny – földszint + fogadótér', $admin);

        // --- 3) Ajánlati fázisú projekt (üres ütemterv) ---
        $csarnok = Project::create([
            'code' => 'P-2026-003',
            'name' => 'Raktárcsarnok bővítése',
            'client_id' => $kovacs->id,
            'project_manager_id' => $admin?->id,
            'status' => 'ajanlat',
            'construction_type' => 'bovites',
            'location_city' => 'Vác',
            'location_address' => 'Ipari park 4.',
            'starts_on' => today()->addDays(45),
            'ends_on' => today()->addDays(160),
            'description' => '600 m² alapterületű csarnokbővítés, ajánlatkészítés folyamatban.',
        ]);
        $csarnok->logActivity('letrehozva', 'Projekt létrehozva: Raktárcsarnok bővítése', $admin);

        $this->command?->info('Demó adatok betöltve: 3 projekt, 2 alprojekt, fázisok és napló.');
    }
}
