<?php

namespace App\Http\Controllers;

use App\Http\Requests\DailyReportRequest;
use App\Models\DailyReport;
use App\Models\DailyReportPhoto;
use App\Models\Document;
use App\Models\Partner;
use App\Models\Project;
use App\Models\User;
use App\Services\WeatherService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/**
 * Napi jelentés / Munkanapló (spec §11) — az építési napló digitális
 * megfelelője. Projektenként naponta egy helyszíni bejegyzés: elvégzett munka,
 * akadályok, létszám (saját dolgozók + alvállalkozói brigádok), opcionális
 * anyag-/gépmozgás, valamint a projekt koordinátái alapján automatikusan lekért
 * időjárás. A fotók a Dokumentumtárba is bekerülnek (projekthez rendelve).
 * Kifejezetten mobilról, helyszínen, gyors rögzítésre tervezve.
 */
class DailyReportController extends Controller
{
    public function __construct(private readonly WeatherService $weather)
    {
    }

    public function index(Request $request): Response
    {
        $projectId = $request->integer('project');
        $from = $request->date('from')?->toDateString();
        $to = $request->date('to')?->toDateString();
        $mine = $request->boolean('mine');
        $userId = $request->user()->id;

        $reports = DailyReport::query()
            ->with(['project:id,code,name', 'creator:id,name'])
            ->withCount(['subcontractorCrews', 'workers', 'photos'])
            ->withSum('subcontractorCrews as crew_headcount', 'headcount')
            ->when($projectId > 0, fn ($q) => $q->where('project_id', $projectId))
            ->when($from, fn ($q) => $q->whereDate('report_date', '>=', $from))
            ->when($to, fn ($q) => $q->whereDate('report_date', '<=', $to))
            ->when($mine, fn ($q) => $q->where('created_by', $userId))
            ->orderByDesc('report_date')
            ->orderByDesc('id')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (DailyReport $r) => $this->summary($r));

        $today = today()->toDateString();
        $weekStart = today()->startOfWeek()->toDateString();

        return Inertia::render('DailyReports/Index', [
            'reports' => $reports,
            'filters' => [
                'project' => $projectId ?: null,
                'from' => $from,
                'to' => $to,
                'mine' => $mine,
            ],
            'stats' => [
                'today' => DailyReport::whereDate('report_date', $today)->count(),
                'week' => DailyReport::whereDate('report_date', '>=', $weekStart)->count(),
                'projects_today' => DailyReport::whereDate('report_date', $today)->distinct('project_id')->count('project_id'),
                'total' => DailyReport::count(),
            ],
            'projects' => $this->projectOptions(),
            'canCreate' => $request->user()->can('daily-reports.create'),
        ]);
    }

    public function create(Request $request): Response
    {
        return Inertia::render('DailyReports/Form', [
            'report' => null,
            'presetProjectId' => $request->integer('project') ?: null,
            ...$this->formOptions(),
        ]);
    }

    public function store(DailyReportRequest $request): RedirectResponse
    {
        $data = $request->validated();

        // Egy projekten naponta egy (hivatalos) napló — ha már van, oda irányítunk.
        $existing = DailyReport::where('project_id', $data['project_id'])
            ->whereDate('report_date', $data['report_date'])
            ->first();
        if ($existing) {
            return redirect()->route('daily-reports.show', $existing)
                ->with('info', 'Erre a napra ezen a projekten már van napló — itt szerkesztheti.');
        }

        $report = DailyReport::create([
            'project_id' => $data['project_id'],
            'report_date' => $data['report_date'],
            'created_by' => $request->user()->id,
            'work_done' => $data['work_done'],
            'obstacles' => $data['obstacles'] ?? null,
            'own_headcount' => $data['own_headcount'] ?? 0,
            'material_movement' => $data['material_movement'] ?? null,
            'machine_movement' => $data['machine_movement'] ?? null,
        ]);

        $report->workers()->sync($data['workers'] ?? []);
        $this->syncCrews($report, $data['crews'] ?? []);
        $this->storePhotos($request, $report);
        $this->refreshWeather($report);

        $report->project?->logActivity('naplo', "Napi jelentés rögzítve: {$report->report_date->format('Y.m.d.')}", $request->user());

        return redirect()->route('daily-reports.show', $report)
            ->with('success', 'Napi jelentés rögzítve.');
    }

    public function show(DailyReport $dailyReport): Response
    {
        $dailyReport->load([
            'project:id,code,name,latitude,longitude',
            'creator:id,name',
            'workers:id,name',
            'subcontractorCrews.subcontractor:id,name',
            'photos.uploader:id,name',
        ]);

        $user = request()->user();

        return Inertia::render('DailyReports/Show', [
            'report' => $this->detail($dailyReport),
            'canEdit' => $user->can('daily-reports.edit'),
            'canDelete' => $user->can('daily-reports.delete'),
        ]);
    }

    public function edit(DailyReport $dailyReport): Response
    {
        $dailyReport->load([
            'workers:id,name',
            'subcontractorCrews.subcontractor:id,name',
            'photos',
        ]);

        return Inertia::render('DailyReports/Form', [
            'report' => $this->detail($dailyReport),
            'presetProjectId' => null,
            ...$this->formOptions(),
        ]);
    }

    public function update(DailyReportRequest $request, DailyReport $dailyReport): RedirectResponse
    {
        $data = $request->validated();

        $projectChanged = (int) $data['project_id'] !== (int) $dailyReport->project_id;
        $dateChanged = $data['report_date'] !== $dailyReport->report_date->toDateString();

        $dailyReport->update([
            'project_id' => $data['project_id'],
            'report_date' => $data['report_date'],
            'work_done' => $data['work_done'],
            'obstacles' => $data['obstacles'] ?? null,
            'own_headcount' => $data['own_headcount'] ?? 0,
            'material_movement' => $data['material_movement'] ?? null,
            'machine_movement' => $data['machine_movement'] ?? null,
        ]);

        $dailyReport->workers()->sync($data['workers'] ?? []);
        $this->syncCrews($dailyReport, $data['crews'] ?? []);

        foreach ($data['remove_photos'] ?? [] as $photoId) {
            $photo = $dailyReport->photos()->whereKey($photoId)->first();
            if ($photo) {
                $this->deletePhoto($photo);
            }
        }

        $this->storePhotos($request, $dailyReport);

        // Helyszín/dátum változáskor, vagy ha eddig nem sikerült, frissül az időjárás.
        if ($projectChanged || $dateChanged || $dailyReport->weather === null) {
            $this->refreshWeather($dailyReport->refresh());
        }

        return redirect()->route('daily-reports.show', $dailyReport)
            ->with('success', 'Napi jelentés módosítva.');
    }

    public function destroy(DailyReport $dailyReport): RedirectResponse
    {
        foreach ($dailyReport->photos as $photo) {
            $this->deletePhoto($photo);
        }

        $dailyReport->delete();

        return redirect()->route('daily-reports.index')
            ->with('success', 'Napi jelentés törölve.');
    }

    /**
     * Kézi időjárás-frissítés (ha a mentéskori automatikus lekérés nem sikerült).
     */
    public function refresh(DailyReport $dailyReport): RedirectResponse
    {
        $this->refreshWeather($dailyReport);

        return back()->with(
            $dailyReport->weather ? 'success' : 'error',
            $dailyReport->weather ? 'Időjárás frissítve.' : 'Az időjárás nem elérhető (nincs koordináta a projekten, vagy a szolgáltatás nem válaszolt).'
        );
    }

    /**
     * Fotó kiszolgálása böngészőben megjelenítve (galéria), S3-nál presigned URL.
     */
    public function photo(Request $request, DailyReportPhoto $photo): SymfonyResponse
    {
        abort_unless($request->user()->can('daily-reports.view'), 403);

        $storage = Storage::disk($photo->disk);
        abort_unless($storage->exists($photo->file_path), 404, 'A fájl nem található.');

        if ($photo->disk === 'plans') {
            return redirect()->away($storage->temporaryUrl($photo->file_path, now()->addMinutes(10)));
        }

        return $storage->response($photo->file_path, $photo->original_filename);
    }

    // --- Segédfüggvények ------------------------------------------------------

    /**
     * Alvállalkozói brigádok (újra)rögzítése — a régiek törlése, majd felvétel.
     *
     * @param  array<int, array<string, mixed>>  $crews
     */
    private function syncCrews(DailyReport $report, array $crews): void
    {
        $report->subcontractorCrews()->delete();

        foreach ($crews as $crew) {
            if (empty($crew['subcontractor_id'])) {
                continue;
            }
            $report->subcontractorCrews()->create([
                'subcontractor_id' => $crew['subcontractor_id'],
                'headcount' => $crew['headcount'] ?? 0,
                'note' => $crew['note'] ?? null,
            ]);
        }
    }

    /**
     * A feltöltött fotók tárolása + tükrözés a Dokumentumtárba (spec §10).
     */
    private function storePhotos(Request $request, DailyReport $report): void
    {
        foreach ($request->file('photos') ?? [] as $file) {
            $disk = Document::diskFor('foto', (int) $file->getSize());
            $path = $file->store("daily-report-{$report->id}", $disk);

            $document = $this->mirrorToDocument($report, $disk, $path, $file);

            $report->photos()->create([
                'disk' => $disk,
                'file_path' => $path,
                'original_filename' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'size_bytes' => $file->getSize(),
                'document_id' => $document?->id,
                'uploaded_by' => $request->user()->id,
            ]);
        }
    }

    /**
     * A helyszíni fotó megjelenítése a Fájlkezelőben is (spec §10): Document +
     * aktuális DocumentVersion ugyanarra a fájlra, projekthez rendelve. A fizikai
     * fájl egyszer tárolódik; a napló fotó és a dokumentum ugyanazt hivatkozza.
     */
    private function mirrorToDocument(DailyReport $report, string $disk, string $path, $file): ?Document
    {
        $report->loadMissing('project:id,code');
        $code = $report->project?->code ?? 'projekt';

        $document = Document::create([
            'title' => "Munkanapló fotó – {$code} – {$report->report_date->format('Y.m.d.')}",
            'category' => 'foto',
            'folder_id' => null,
            'project_id' => $report->project_id,
            'description' => 'Napi jelentésből automatikusan mentett helyszíni fotó.',
            'uploaded_by' => $report->created_by,
        ]);

        $document->versions()->create([
            'version_number' => 1,
            'is_current' => true,
            'disk' => $disk,
            'file_path' => $path,
            'original_filename' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType(),
            'size_bytes' => $file->getSize(),
            'uploaded_by' => $report->created_by,
        ]);

        return $document;
    }

    /**
     * Fotó törlése: a Fájlkezelő tükör-dokumentuma, a fizikai fájl és a sor is.
     */
    private function deletePhoto(DailyReportPhoto $photo): void
    {
        Storage::disk($photo->disk)->delete($photo->file_path);

        if ($photo->document_id) {
            // A tükör-dokumentum ugyanazt a fájlt hivatkozza (már töröltük fent),
            // ezért a verziókat és a dokumentumot csak rekordként takarítjuk.
            $document = Document::withTrashed()->find($photo->document_id);
            $document?->versions()->delete();
            $document?->forceDelete();
        }

        $photo->delete();
    }

    /**
     * Időjárás lekérése és mentése a jelentésre (a projekt koordinátái alapján).
     */
    private function refreshWeather(DailyReport $report): void
    {
        $report->loadMissing('project:id,latitude,longitude');
        $project = $report->project;

        $weather = $this->weather->forDate(
            $project?->latitude,
            $project?->longitude,
            $report->report_date->toDateString(),
        );

        $report->update([
            'weather' => $weather,
            'weather_fetched_at' => $weather ? now() : $report->weather_fetched_at,
        ]);
    }

    /**
     * Egy lista-sor adatai (index nézet).
     *
     * @return array<string, mixed>
     */
    private function summary(DailyReport $r): array
    {
        return [
            'id' => $r->id,
            'report_date' => $r->report_date->toDateString(),
            'project' => $r->project
                ? ['id' => $r->project->id, 'code' => $r->project->code, 'name' => $r->project->name]
                : null,
            'creator_name' => $r->creator?->name,
            'work_done' => $r->work_done,
            'own_headcount' => (int) $r->own_headcount,
            'total_headcount' => (int) $r->own_headcount + (int) ($r->crew_headcount ?? 0),
            'crews_count' => (int) $r->subcontractor_crews_count,
            'workers_count' => (int) $r->workers_count,
            'photos_count' => (int) $r->photos_count,
            'has_obstacles' => filled($r->obstacles),
            'weather' => $r->weather,
        ];
    }

    /**
     * A teljes jelentés adatai (show + edit).
     *
     * @return array<string, mixed>
     */
    private function detail(DailyReport $r): array
    {
        return [
            'id' => $r->id,
            'report_date' => $r->report_date->toDateString(),
            'project' => $r->project
                ? ['id' => $r->project->id, 'code' => $r->project->code, 'name' => $r->project->name]
                : null,
            'creator_name' => $r->creator?->name,
            'created_at' => $r->created_at?->toIso8601String(),
            'work_done' => $r->work_done,
            'obstacles' => $r->obstacles,
            'own_headcount' => (int) $r->own_headcount,
            'total_headcount' => $r->totalHeadcount(),
            'material_movement' => $r->material_movement,
            'machine_movement' => $r->machine_movement,
            'weather' => $r->weather,
            'weather_fetched_at' => $r->weather_fetched_at?->toIso8601String(),
            'workers' => $r->workers->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name])->values(),
            'crews' => $r->subcontractorCrews->map(fn ($c) => [
                'id' => $c->id,
                'subcontractor_id' => $c->subcontractor_id,
                'subcontractor_name' => $c->subcontractor?->name,
                'headcount' => (int) $c->headcount,
                'note' => $c->note,
            ])->values(),
            'photos' => $r->photos->map(fn (DailyReportPhoto $p) => [
                'id' => $p->id,
                'name' => $p->original_filename,
                'is_image' => $p->isImage(),
                'size_bytes' => $p->size_bytes,
                'url' => route('daily-reports.photos.show', $p->id),
                'uploader_name' => $p->uploader?->name,
            ])->values(),
        ];
    }

    /**
     * A szűrőhöz / űrlaphoz közös projektlista (koordináta-jelzéssel).
     *
     * @return \Illuminate\Support\Collection<int, array<string, mixed>>
     */
    private function projectOptions()
    {
        return Project::orderBy('code')->get(['id', 'code', 'name', 'latitude', 'longitude'])
            ->map(fn (Project $p) => [
                'id' => $p->id,
                'code' => $p->code,
                'name' => $p->name,
                'has_coords' => $p->latitude !== null && $p->longitude !== null,
            ])->values();
    }

    /**
     * Az űrlaphoz szükséges opciók (projektek, saját dolgozók, alvállalkozók).
     *
     * @return array<string, mixed>
     */
    private function formOptions(): array
    {
        return [
            'projects' => $this->projectOptions(),
            'workers' => User::where('is_active', true)->where('is_external', false)
                ->orderBy('name')->get(['id', 'name'])
                ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name])->values(),
            'subcontractors' => Partner::subcontractors()->orderBy('name')->get(['id', 'name'])
                ->map(fn (Partner $p) => ['id' => $p->id, 'name' => $p->name])->values(),
            'today' => today()->toDateString(),
        ];
    }
}
