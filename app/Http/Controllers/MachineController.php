<?php

namespace App\Http\Controllers;

use App\Http\Requests\MachineRequest;
use App\Models\Document;
use App\Models\Machine;
use App\Models\MachineBooking;
use App\Models\MachineDocument;
use App\Models\MachineMaintenance;
use App\Models\Project;
use App\Models\User;
use App\Support\Machines;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/**
 * Gépek és eszközök (spec §7) — géppark-nyilvántartás. Törzsadat + aktuális
 * hely/státusz + felelős személy; karbantartás (esedékes szerviz, műszaki vizsga)
 * lejárati figyelmeztetéssel; karbantartási előzmény; foglalás a naptárhoz kötve
 * ütközés-jelzéssel; csatolt dokumentumok (gépkönyv, biztosítás, vizsgadok.).
 * Csak nagyobb gépeket és értékesebb eszközöket követünk — kéziszerszám nem cél.
 */
class MachineController extends Controller
{
    /** Ennyi napon belüli lejárat számít „hamarosan esedékesnek". */
    private const SOON_DAYS = 30;

    public function index(Request $request): Response
    {
        $search = $request->string('search')->toString();
        $kind = $request->string('kind')->toString();
        $status = $request->string('status')->toString();

        $horizon = today()->addDays(self::SOON_DAYS)->toDateString();

        $machines = Machine::query()
            ->search($search)
            ->kind($kind)
            ->status($status)
            ->with('responsible:id,name')
            ->withCount(['bookings as booked_today_count' => fn ($q) => $q->covering(today()->toDateString())])
            ->orderBy('name')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Machine $m) => $this->summary($m));

        return Inertia::render('Machines/Index', [
            'machines' => $machines,
            'filters' => ['search' => $search, 'kind' => $kind, 'status' => $status],
            'kinds' => Machines::KINDS,
            'statuses' => Machines::STATUSES,
            'ownership' => Machines::OWNERSHIP,
            'responsible_options' => User::where('is_active', true)->where('is_external', false)
                ->orderBy('name')->get(['id', 'name'])
                ->map(fn ($u) => ['id' => $u->id, 'name' => $u->name]),
            'stats' => [
                'total' => Machine::count(),
                'booked_today' => Machine::whereHas('bookings', fn ($q) => $q->covering(today()->toDateString()))->count(),
                'in_service' => Machine::where('status', 'szervizben')->count(),
                'expiring' => Machine::where(fn ($q) => $q
                    ->whereDate('next_service_on', '<=', $horizon)
                    ->orWhereDate('inspection_valid_until', '<=', $horizon))
                    ->count(),
            ],
        ]);
    }

    public function store(MachineRequest $request): RedirectResponse
    {
        $machine = Machine::create($request->validated());

        return redirect()
            ->route('machines.show', $machine)
            ->with('success', "{$machine->name} felvéve a géppark közé.");
    }

    public function show(Machine $machine): Response
    {
        $machine->load([
            'responsible:id,name',
            'maintenances.creator:id,name',
            'documents.uploader:id,name',
            'bookings.project:id,code,name,status',
        ]);

        $assignedIds = $machine->bookings->pluck('project_id')->unique();
        $conflictedBookings = $this->conflictedBookingIds($machine->bookings);

        return Inertia::render('Machines/Show', [
            'machine' => [
                ...$this->summary($machine),
                'identifier' => $machine->identifier,
                'manufacture_year' => $machine->manufacture_year,
                'purchased_on' => $machine->purchased_on?->toDateString(),
                'ownership' => $machine->ownership,
                'ownership_label' => Machines::OWNERSHIP[$machine->ownership] ?? $machine->ownership,
                'rental_source' => $machine->rental_source,
                'responsible_user_id' => $machine->responsible_user_id,
                'next_service_on' => $machine->next_service_on?->toDateString(),
                'inspection_valid_until' => $machine->inspection_valid_until?->toDateString(),
                'note' => $machine->note,
                'created_at' => $machine->created_at?->toIso8601String(),
            ],
            'maintenances' => $machine->maintenances->map(fn (MachineMaintenance $m) => [
                'id' => $m->id,
                'type' => $m->type,
                'type_label' => Machines::MAINTENANCE_TYPES[$m->type] ?? $m->type,
                'performed_on' => $m->performed_on?->toDateString(),
                'description' => $m->description,
                'cost' => $m->cost !== null ? (float) $m->cost : null,
                'has_file' => $m->hasFile(),
                'file_name' => $m->original_filename,
                'download_url' => $m->hasFile() ? route('machines.maintenances.download', $m->id) : null,
                'creator_name' => $m->creator?->name,
            ])->values(),
            'documents' => $machine->documents->map(fn (MachineDocument $d) => [
                'id' => $d->id,
                'category' => $d->category,
                'category_label' => Machines::DOC_CATEGORIES[$d->category] ?? $d->category,
                'name' => $d->original_filename,
                'size_bytes' => $d->size_bytes,
                'uploader_name' => $d->uploader?->name,
                'created_at' => $d->created_at?->toDateString(),
                'download_url' => route('machines.documents.download', $d->id),
            ])->values(),
            'bookings' => $machine->bookings->map(fn (MachineBooking $b) => [
                'id' => $b->id,
                'starts_on' => $b->starts_on->toDateString(),
                'ends_on' => $b->ends_on->toDateString(),
                'note' => $b->note,
                'is_current' => $b->starts_on->lte(today()) && $b->ends_on->gte(today()),
                'is_conflicted' => in_array($b->id, $conflictedBookings, true),
                'project' => $b->project
                    ? ['id' => $b->project->id, 'code' => $b->project->code, 'name' => $b->project->name, 'status' => $b->project->status]
                    : null,
            ])->values(),
            'current_maintenance_cost' => (float) $machine->maintenances->sum('cost'),
            'assignable_projects' => Project::query()
                ->whereNull('parent_id')
                ->orderByDesc('updated_at')
                ->limit(200)
                ->get(['id', 'code', 'name'])
                ->map(fn ($p) => ['id' => $p->id, 'code' => $p->code, 'name' => $p->name]),
            'responsible_options' => User::where('is_active', true)->where('is_external', false)
                ->orderBy('name')->get(['id', 'name'])
                ->map(fn ($u) => ['id' => $u->id, 'name' => $u->name]),
            'kinds' => Machines::KINDS,
            'statuses' => Machines::STATUSES,
            'ownership' => Machines::OWNERSHIP,
            'maintenance_types' => Machines::MAINTENANCE_TYPES,
            'doc_categories' => Machines::DOC_CATEGORIES,
        ]);
    }

    public function update(MachineRequest $request, Machine $machine): RedirectResponse
    {
        $machine->update($request->validated());

        return back()->with('success', "{$machine->name} adatai módosítva.");
    }

    public function destroy(Machine $machine): RedirectResponse
    {
        $name = $machine->name;
        $machine->delete();

        return redirect()
            ->route('machines.index')
            ->with('success', "{$name} archiválva.");
    }

    // --- Karbantartási előzmény -----------------------------------------------

    public function storeMaintenance(Request $request, Machine $machine): RedirectResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(array_keys(Machines::MAINTENANCE_TYPES))],
            'performed_on' => ['required', 'date'],
            'description' => ['required', 'string', 'max:2000'],
            'cost' => ['nullable', 'numeric', 'min:0', 'max:9999999999'],
            'file' => ['nullable', 'file', 'max:20480'],
            'next_service_on' => ['nullable', 'date'],
            'inspection_valid_until' => ['nullable', 'date'],
        ], [
            'type.required' => 'Válasszon típust.',
            'performed_on.required' => 'Adja meg a dátumot.',
            'description.required' => 'Írja le, mi történt.',
        ]);

        $attributes = [
            'type' => $data['type'],
            'performed_on' => $data['performed_on'],
            'description' => $data['description'],
            'cost' => $data['cost'] ?? null,
            'created_by' => $request->user()->id,
        ];

        if ($file = $request->file('file')) {
            $disk = Document::diskFor('egyeb', (int) $file->getSize());
            $attributes += [
                'disk' => $disk,
                'file_path' => $file->store("machine-{$machine->id}/maintenance", $disk),
                'original_filename' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'size_bytes' => $file->getSize(),
            ];
        }

        $machine->maintenances()->create($attributes);

        // Kényelmi lehetőség: a karbantartás rögzítésekor a következő esedékesség
        // / vizsgaérvényesség egy lépésben frissíthető a gép törzsadatán.
        $machineUpdate = array_filter([
            'next_service_on' => $data['next_service_on'] ?? null,
            'inspection_valid_until' => $data['inspection_valid_until'] ?? null,
        ], fn ($v) => $v !== null);
        if ($machineUpdate !== []) {
            $machine->update($machineUpdate);
        }

        return back()->with('success', 'Karbantartási bejegyzés rögzítve.');
    }

    public function downloadMaintenance(MachineMaintenance $maintenance): SymfonyResponse
    {
        abort_unless($maintenance->hasFile(), 404, 'Ehhez a bejegyzéshez nincs csatolt fájl.');

        return $this->serveFile($maintenance->disk, $maintenance->file_path, $maintenance->original_filename);
    }

    public function destroyMaintenance(MachineMaintenance $maintenance): RedirectResponse
    {
        if ($maintenance->hasFile()) {
            Storage::disk($maintenance->disk)->delete($maintenance->file_path);
        }
        $maintenance->delete();

        return back()->with('success', 'Karbantartási bejegyzés törölve.');
    }

    // --- Dokumentumok ---------------------------------------------------------

    public function storeDocument(Request $request, Machine $machine): RedirectResponse
    {
        $request->validate([
            'category' => ['required', Rule::in(array_keys(Machines::DOC_CATEGORIES))],
            'files' => ['required', 'array', 'min:1'],
            'files.*' => ['file', 'max:51200'],
        ], [
            'files.required' => 'Válasszon legalább egy fájlt.',
        ]);

        foreach ($request->file('files') as $file) {
            $disk = Document::diskFor('egyeb', (int) $file->getSize());
            $machine->documents()->create([
                'category' => $request->string('category')->toString(),
                'disk' => $disk,
                'file_path' => $file->store("machine-{$machine->id}/doc", $disk),
                'original_filename' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'size_bytes' => $file->getSize(),
                'uploaded_by' => $request->user()->id,
            ]);
        }

        return back()->with('success', 'Dokumentum(ok) feltöltve.');
    }

    public function downloadDocument(MachineDocument $document): SymfonyResponse
    {
        return $this->serveFile($document->disk, $document->file_path, $document->original_filename);
    }

    public function destroyDocument(MachineDocument $document): RedirectResponse
    {
        Storage::disk($document->disk)->delete($document->file_path);
        $document->delete();

        return back()->with('success', 'Dokumentum törölve.');
    }

    // --- Foglalás -------------------------------------------------------------

    public function storeBooking(Request $request, Machine $machine): RedirectResponse
    {
        $data = $request->validate([
            'project_id' => ['required', 'exists:projects,id'],
            'starts_on' => ['required', 'date'],
            'ends_on' => ['required', 'date', 'after_or_equal:starts_on'],
            'note' => ['nullable', 'string', 'max:2000'],
        ], [
            'project_id.required' => 'Válasszon projektet.',
            'starts_on.required' => 'Adja meg a kezdő dátumot.',
            'ends_on.required' => 'Adja meg a záró dátumot.',
            'ends_on.after_or_equal' => 'A záró dátum nem lehet korábbi a kezdőnél.',
        ]);

        $machine->bookings()->create([
            'project_id' => $data['project_id'],
            'starts_on' => $data['starts_on'],
            'ends_on' => $data['ends_on'],
            'note' => $data['note'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        return back()->with('success', 'Gépfoglalás rögzítve.')
            ->with('info', $this->bookingConflictWarning($machine, $data['starts_on'], $data['ends_on']));
    }

    public function destroyBooking(MachineBooking $booking): RedirectResponse
    {
        $booking->delete();

        return back()->with('success', 'Foglalás törölve.');
    }

    // --- Segédfüggvények ------------------------------------------------------

    /**
     * Fájl kiszolgálása a hibrid tárolásból: S3 (plans) esetén presigned URL,
     * egyébként közvetlen letöltés (a TaskController/Subcontractor mintája).
     */
    private function serveFile(string $disk, string $path, string $filename): SymfonyResponse
    {
        $storage = Storage::disk($disk);
        abort_unless($storage->exists($path), 404, 'A fájl nem található.');

        if ($disk === 'plans') {
            return redirect()->away($storage->temporaryUrl($path, now()->addMinutes(10)));
        }

        return $storage->download($path, $filename);
    }

    /**
     * A gép foglalásai közül azok, amelyek átfednek egy másik foglalással
     * (ugyanaz a gép egyszerre két helyen — spec §7 ütközés-jelzés).
     *
     * @param  \Illuminate\Support\Collection<int, MachineBooking>  $bookings
     * @return array<int, int>
     */
    private function conflictedBookingIds($bookings): array
    {
        $conflicted = [];

        foreach ($bookings as $a) {
            foreach ($bookings as $b) {
                if ($a->id === $b->id) {
                    continue;
                }
                if ($a->starts_on->lte($b->ends_on) && $a->ends_on->gte($b->starts_on)) {
                    $conflicted[$a->id] = $a->id;
                    break;
                }
            }
        }

        return array_values($conflicted);
    }

    /**
     * Mentés utáni figyelmeztetés, ha a gép átfedő időszakra máshová is foglalt.
     */
    private function bookingConflictWarning(Machine $machine, string $start, string $end): ?string
    {
        $overlapping = $machine->bookings()
            ->overlapping($start, $end)
            ->with('project:id,code,name')
            ->get();

        // Az imént mentett foglalás is köztük van; ütközés csak 1-nél több esetén.
        if ($overlapping->count() <= 1) {
            return null;
        }

        $projects = $overlapping
            ->map(fn ($b) => $b->project?->code)
            ->filter()
            ->unique()
            ->implode(', ');

        return "Figyelem, ütközés: {$machine->name} ebben az időszakban már foglalt ({$projects}).";
    }

    /**
     * A listában és az adatlap fejlécében közösen használt gép-kép.
     *
     * @return array<string, mixed>
     */
    private function summary(Machine $machine): array
    {
        return [
            'id' => $machine->id,
            'name' => $machine->name,
            'kind' => $machine->kind,
            'kind_label' => $machine->kind ? (Machines::KINDS[$machine->kind] ?? $machine->kind) : null,
            'identifier' => $machine->identifier,
            'status' => $machine->status,
            'status_label' => Machines::STATUSES[$machine->status] ?? $machine->status,
            'ownership' => $machine->ownership,
            'location' => $machine->location,
            'responsible_name' => $machine->responsible?->name,
            'next_service_on' => $machine->next_service_on?->toDateString(),
            'inspection_valid_until' => $machine->inspection_valid_until?->toDateString(),
            'service_status' => $machine->serviceStatus(self::SOON_DAYS),
            'inspection_status' => $machine->inspectionStatus(self::SOON_DAYS),
            'booked_today' => (bool) ($machine->booked_today_count ?? 0),
        ];
    }
}
