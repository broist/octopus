<?php

namespace Database\Seeders;

use App\Models\Document;
use App\Models\Folder;
use App\Models\Partner;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;

/**
 * Demó adatok kiértékeléshez — CSAK kézzel futtatandó:
 *
 *   php artisan db:seed --class=DemoSeeder
 *
 * Nem fut le az alap seedeléskor. Minden szakasz külön őrfeltétellel fut,
 * így többször is futtatható: csak a hiányzó demó-adatokat pótolja.
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedProjects();
        $this->seedTasks();
        $this->seedDocuments();
        $this->seedFolders();
    }

    private function seedFolders(): void
    {
        if (Folder::withTrashed()->exists()) {
            $this->command?->warn('Már vannak mappák – a mappa-demó kimarad.');

            return;
        }

        $admin = User::where('email', 'admin@octopus.local')->first();

        $tervek = Folder::create(['name' => 'Tervek', 'created_by' => $admin?->id]);
        $fotok = Folder::create(['name' => 'Fotók', 'created_by' => $admin?->id]);
        Folder::create(['name' => 'Szerződések', 'created_by' => $admin?->id]);
        Folder::create(['name' => 'P-2026-001 Családi ház', 'parent_id' => $tervek->id, 'created_by' => $admin?->id]);

        // A demó-fájlokat a megfelelő mappákba rendezzük.
        Document::where('category', 'terv')->update(['folder_id' => $tervek->id]);
        Document::where('category', 'foto')->update(['folder_id' => $fotok->id]);

        $this->command?->info('Mappa-demó betöltve: Tervek (+almappa), Fotók, Szerződések.');
    }

    private function seedProjects(): void
    {
        if (Project::withTrashed()->exists()) {
            $this->command?->warn('Már vannak projektek – a projekt-demó kimarad.');

            return;
        }

        $admin = User::where('email', 'admin@octopus.local')->first();

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

        $this->command?->info('Projekt-demó betöltve: 3 projekt, 2 alprojekt, fázisok és napló.');
    }

    private function seedTasks(): void
    {
        if (Task::exists()) {
            $this->command?->warn('Már vannak feladatok – a feladat-demó kimarad.');

            return;
        }

        $admin = User::where('email', 'admin@octopus.local')->first();
        $haz = Project::where('code', 'P-2026-001')->first();
        $iroda = Project::where('code', 'P-2026-002')->first();
        $csarnok = Project::where('code', 'P-2026-003')->first();

        $make = function (array $attrs) use ($admin) {
            $task = Task::create([...$attrs, 'created_by' => $admin?->id]);
            if ($admin) {
                $task->assignees()->sync([$admin->id]);
            }

            return $task;
        };

        $make([
            'title' => 'Építési engedély másolatának feltöltése',
            'description' => 'A jogerős engedélyt be kell szkennelni és a Fájlkezelőbe feltölteni, a projekthez kötve.',
            'project_id' => $csarnok?->id,
            'status' => 'teendo',
            'priority' => 'magas',
            'due_on' => today()->addDay(),
        ]);

        $make([
            'title' => 'Villanyszerelő alvállalkozói ajánlatok bekérése',
            'description' => 'Legalább három ajánlat a B szárny villamos munkáira.',
            'project_id' => $iroda?->id,
            'status' => 'folyamatban',
            'priority' => 'kozepes',
            'due_on' => today()->addDays(3),
        ]);

        $make([
            'title' => 'Heti fotódokumentáció a helyszínről',
            'project_id' => $haz?->id,
            'status' => 'teendo',
            'priority' => 'alacsony',
            'due_on' => today()->subDay(), // szándékosan lejárt
        ]);

        $make([
            'title' => 'Kivitelezési szerződés aláíratása',
            'project_id' => $haz?->id,
            'status' => 'kesz',
            'priority' => 'magas',
            'due_on' => today()->subDays(10),
            'completed_at' => now()->subDays(9),
        ]);

        $this->command?->info('Feladat-demó betöltve: 4 feladat (köztük egy lejárt és egy kész).');
    }

    private function seedDocuments(): void
    {
        if (Document::withTrashed()->exists()) {
            $this->command?->warn('Már vannak dokumentumok – a dokumentum-demó kimarad.');

            return;
        }

        $admin = User::where('email', 'admin@octopus.local')->first();
        $haz = Project::where('code', 'P-2026-001')->first();

        // Kis PNG-ket generálunk GD-vel, hogy a letöltés/előnézet valóban működjön.
        $png = function (string $text, int $w = 640, int $h = 420): string {
            $im = imagecreatetruecolor($w, $h);
            $bg = imagecolorallocate($im, 246, 243, 236);   // krém
            $fg = imagecolorallocate($im, 33, 56, 46);      // mély zöld
            $line = imagecolorallocate($im, 216, 182, 132); // fa tónus
            imagefill($im, 0, 0, $bg);
            imagerectangle($im, 10, 10, $w - 11, $h - 11, $line);
            imagestring($im, 5, 24, 24, 'OCTOPUS DEMO', $fg);
            imagestring($im, 4, 24, 52, $text, $fg);
            ob_start();
            imagepng($im);

            return (string) ob_get_clean();
        };

        $create = function (array $meta, string $filename, string $content) use ($admin) {
            $document = Document::create([...$meta, 'uploaded_by' => $admin?->id]);
            $disk = Document::diskForCategory($document->category);
            $path = "doc-{$document->id}/".uniqid().'.png';
            Storage::disk($disk)->put($path, $content);

            $document->versions()->create([
                'version_number' => 1,
                'is_current' => true,
                'disk' => $disk,
                'file_path' => $path,
                'original_filename' => $filename,
                'mime_type' => 'image/png',
                'size_bytes' => strlen($content),
                'uploaded_by' => $admin?->id,
            ]);
        };

        $create(
            [
                'title' => 'Földszinti alaprajz',
                'category' => 'terv',
                'project_id' => $haz?->id,
                'description' => 'Demó tervrajz — élesben ide kerülnek a valódi tervek (S3 konfigurálása után a felhőbe).',
            ],
            'alaprajz-fsz-v1.png',
            $png('Foldszinti alaprajz - demo tervrajz'),
        );

        $create(
            [
                'title' => 'Helyszíni állapotfotó',
                'category' => 'foto',
                'project_id' => $haz?->id,
            ],
            'helyszini-foto-2026-07.png',
            $png('Helyszini allapotfoto - demo'),
        );

        $this->command?->info('Dokumentum-demó betöltve: 2 fájl a P-2026-001 projekthez.');
    }
}
