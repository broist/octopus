<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\Project;
use App\Models\StaffAbsence;
use App\Models\StaffQualification;
use App\Models\User;
use App\Models\WorkLog;
use App\Support\Staff;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/**
 * Munkatársak / Erőforrások (spec §5/6). A saját dolgozók HR-nézete a közös
 * users táblán (belső felhasználók, is_external=false) — az alvállalkozók a
 * 4/5. modulban vannak. Végzettségek lejárati figyelmeztetéssel, manuális
 * munkaidő-nyilvántartás (mindenki saját magának), szabadság/távollét.
 * Órabér / bérköltség itt SZÁNDÉKOSAN nem szerepel (spec megjegyzés).
 */
class StaffController extends Controller
{
    /** Ennyi napon belüli lejárat számít „hamarosan lejárónak". */
    private const QUAL_SOON_DAYS = 30;

    public function index(Request $request): Response
    {
        $search = $request->string('search')->toString();
        $today = today()->toDateString();

        $staff = User::query()
            ->internal()
            ->when($search !== '', fn ($q) => $q->where(fn ($w) => $w
                ->where('name', 'ilike', "%{$search}%")
                ->orWhere('email', 'ilike', "%{$search}%")
                ->orWhere('job_title', 'ilike', "%{$search}%")))
            ->with('roles:id,name')
            ->withCount(['qualifications as expiring_count' => fn ($q) => $q
                ->whereNotNull('valid_until')
                ->whereDate('valid_until', '<=', today()->addDays(self::QUAL_SOON_DAYS))])
            ->withExists(['absences as on_leave' => fn ($q) => $q->covering($today)])
            ->orderByDesc('is_active')
            ->orderBy('name')
            ->get()
            ->map(fn (User $u) => $this->summary($u));

        return Inertia::render('Staff/Index', [
            'staff' => $staff,
            'filters' => ['search' => $search],
            'stats' => [
                'total' => User::internal()->where('is_active', true)->count(),
                'on_leave' => User::internal()->whereHas('absences', fn ($q) => $q->covering($today))->count(),
                'expiring' => User::internal()
                    ->whereHas('qualifications', fn ($q) => $q
                        ->whereNotNull('valid_until')
                        ->whereDate('valid_until', '<=', today()->addDays(self::QUAL_SOON_DAYS)))
                    ->count(),
            ],
        ]);
    }

    public function show(Request $request, User $user): Response
    {
        abort_if($user->is_external, 404);

        $user->load([
            'roles:id,name',
            'qualifications.uploader:id,name',
            'absences',
        ]);

        $monthStart = today()->startOfMonth();

        // Munkaidő-napló: legutóbbi tételek + havi összeg + projektbontás.
        $recentLogs = $user->workLogs()->with('project:id,code,name')->limit(40)->get();
        $monthHours = (float) $user->workLogs()
            ->whereDate('work_date', '>=', $monthStart->toDateString())->sum('hours');
        $byProject = $user->workLogs()
            ->reorder() // a reláció alap work_date rendezése tiltott GROUP BY mellett
            ->selectRaw('project_id, sum(hours) as total')
            ->groupBy('project_id')
            ->get()
            ->map(function ($row) {
                $project = $row->project_id ? Project::find($row->project_id, ['id', 'code', 'name']) : null;

                return [
                    'project' => $project ? ['id' => $project->id, 'code' => $project->code, 'name' => $project->name] : null,
                    'hours' => (float) $row->total,
                ];
            })
            ->sortByDesc('hours')
            ->values();

        // Mindenki KIZÁRÓLAG a saját adatlapját szerkesztheti (megrendelői
        // döntés) — az admint is beleértve. Máshoz csak megtekintés.
        $isSelf = $request->user()->id === $user->id;

        return Inertia::render('Staff/Show', [
            'staff' => [
                ...$this->summary($user),
                'hired_on' => $user->hired_on?->toDateString(),
                'created_at' => $user->created_at?->toIso8601String(),
            ],
            'qualifications' => $user->qualifications->map(fn (StaffQualification $q) => [
                'id' => $q->id,
                'type' => $q->type,
                'type_label' => Staff::QUALIFICATION_TYPES[$q->type] ?? $q->type,
                'name' => $q->name,
                'issuer' => $q->issuer,
                'valid_from' => $q->valid_from?->toDateString(),
                'valid_until' => $q->valid_until?->toDateString(),
                'note' => $q->note,
                'status' => $q->expiryStatus(self::QUAL_SOON_DAYS),
                'has_file' => $q->hasFile(),
                'file_name' => $q->original_filename,
                'download_url' => $q->hasFile() ? route('staff.qualifications.download', $q->id) : null,
            ])->values(),
            'work_logs' => $recentLogs->map(fn (WorkLog $l) => [
                'id' => $l->id,
                'work_date' => $l->work_date->toDateString(),
                'hours' => (float) $l->hours,
                'note' => $l->note,
                'project' => $l->project ? ['id' => $l->project->id, 'code' => $l->project->code, 'name' => $l->project->name] : null,
            ])->values(),
            'month_hours' => $monthHours,
            'hours_by_project' => $byProject,
            'can_edit' => $isSelf,
            'absences' => $user->absences->map(fn (StaffAbsence $a) => [
                'id' => $a->id,
                'type' => $a->type,
                'type_label' => Staff::ABSENCE_TYPES[$a->type] ?? $a->type,
                'starts_on' => $a->starts_on->toDateString(),
                'ends_on' => $a->ends_on->toDateString(),
                'note' => $a->note,
                'is_current' => $a->starts_on->lte(today()) && $a->ends_on->gte(today()),
                'is_future' => $a->starts_on->gt(today()),
            ])->values(),
            'can_log_hours' => $isSelf,
            'projects' => Project::query()->whereNull('parent_id')
                ->orderByDesc('updated_at')->limit(200)->get(['id', 'code', 'name'])
                ->map(fn ($p) => ['id' => $p->id, 'code' => $p->code, 'name' => $p->name]),
            'qualification_types' => Staff::QUALIFICATION_TYPES,
            'absence_types' => Staff::ABSENCE_TYPES,
        ]);
    }

    /**
     * HR-adatok szerkesztése (belépés dátuma, elérhetőség, beosztás). A fiók
     * (név, e-mail, szerepkör, aktiválás) a Felhasználók modulban (16.) kezelt.
     */
    public function updateHr(Request $request, User $user): RedirectResponse
    {
        abort_if($user->is_external, 404);
        $this->assertSelf($request, $user->id);

        $data = $request->validate([
            'phone' => ['nullable', 'string', 'max:50'],
            'job_title' => ['nullable', 'string', 'max:120'],
            'hired_on' => ['nullable', 'date'],
        ]);

        $user->update($data);

        return back()->with('success', "{$user->name} adatai módosítva.");
    }

    // --- Végzettségek / jogosultságok ----------------------------------------

    public function storeQualification(Request $request, User $user): RedirectResponse
    {
        abort_if($user->is_external, 404);
        $this->assertSelf($request, $user->id);

        $data = $request->validate([
            'type' => ['required', Rule::in(array_keys(Staff::QUALIFICATION_TYPES))],
            'name' => ['required', 'string', 'max:200'],
            'issuer' => ['nullable', 'string', 'max:200'],
            'valid_from' => ['nullable', 'date'],
            'valid_until' => ['nullable', 'date', 'after_or_equal:valid_from'],
            'note' => ['nullable', 'string', 'max:2000'],
            'file' => ['nullable', 'file', 'max:20480'],
        ], [
            'type.required' => 'Válasszon típust.',
            'name.required' => 'A megnevezés kötelező.',
            'valid_until.after_or_equal' => 'A lejárat nem lehet korábbi, mint az érvényesség kezdete.',
        ]);

        $attributes = [
            'type' => $data['type'],
            'name' => $data['name'],
            'issuer' => $data['issuer'] ?? null,
            'valid_from' => $data['valid_from'] ?? null,
            'valid_until' => $data['valid_until'] ?? null,
            'note' => $data['note'] ?? null,
        ];

        if ($file = $request->file('file')) {
            $disk = Document::diskFor('egyeb', (int) $file->getSize());
            $attributes += [
                'disk' => $disk,
                'file_path' => $file->store("staff-{$user->id}/qual", $disk),
                'original_filename' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'size_bytes' => $file->getSize(),
                'uploaded_by' => $request->user()->id,
            ];
        }

        $user->qualifications()->create($attributes);

        return back()->with('success', 'Végzettség / jogosultság rögzítve.');
    }

    public function destroyQualification(Request $request, StaffQualification $qualification): RedirectResponse
    {
        $this->assertSelf($request, $qualification->user_id);

        if ($qualification->hasFile()) {
            Storage::disk($qualification->disk)->delete($qualification->file_path);
        }
        $qualification->delete();

        return back()->with('success', 'Tétel törölve.');
    }

    public function downloadQualification(StaffQualification $qualification): SymfonyResponse
    {
        abort_unless($qualification->hasFile(), 404, 'Ehhez a tételhez nincs csatolt fájl.');

        return $this->serveFile($qualification->disk, $qualification->file_path, $qualification->original_filename);
    }

    // --- Munkaidő-nyilvántartás (mindenki saját magának) ---------------------

    public function storeWorkLog(Request $request, User $user): RedirectResponse
    {
        abort_if($user->is_external, 404);
        $this->assertSelf($request, $user->id);

        $data = $request->validate([
            'work_date' => ['required', 'date', 'before_or_equal:today'],
            'hours' => ['required', 'numeric', 'min:0.25', 'max:24'],
            'project_id' => ['nullable', 'exists:projects,id'],
            'note' => ['nullable', 'string', 'max:500'],
        ], [
            'work_date.required' => 'Adja meg a napot.',
            'work_date.before_or_equal' => 'Jövőbeli dátumra nem rögzíthető munkaidő.',
            'hours.required' => 'Adja meg az órák számát.',
            'hours.max' => 'Egy napra legfeljebb 24 óra rögzíthető.',
        ]);

        $user->workLogs()->create([
            'work_date' => $data['work_date'],
            'hours' => $data['hours'],
            'project_id' => $data['project_id'] ?? null,
            'note' => $data['note'] ?? null,
        ]);

        return back()->with('success', 'Munkaidő rögzítve.');
    }

    public function destroyWorkLog(Request $request, WorkLog $workLog): RedirectResponse
    {
        $this->assertSelf($request, $workLog->user_id);

        $workLog->delete();

        return back()->with('success', 'Munkaidő-bejegyzés törölve.');
    }

    // --- Szabadság / távollét -------------------------------------------------

    public function storeAbsence(Request $request, User $user): RedirectResponse
    {
        abort_if($user->is_external, 404);
        $this->assertSelf($request, $user->id);

        $data = $request->validate([
            'type' => ['required', Rule::in(array_keys(Staff::ABSENCE_TYPES))],
            'starts_on' => ['required', 'date'],
            'ends_on' => ['required', 'date', 'after_or_equal:starts_on'],
            'note' => ['nullable', 'string', 'max:500'],
        ], [
            'type.required' => 'Válasszon típust.',
            'starts_on.required' => 'Adja meg a kezdő dátumot.',
            'ends_on.after_or_equal' => 'A vége nem lehet korábbi, mint a kezdet.',
        ]);

        $user->absences()->create([
            'type' => $data['type'],
            'starts_on' => $data['starts_on'],
            'ends_on' => $data['ends_on'],
            'note' => $data['note'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        return back()->with('success', 'Távollét rögzítve — a naptárban is megjelenik.');
    }

    public function destroyAbsence(Request $request, StaffAbsence $absence): RedirectResponse
    {
        $this->assertSelf($request, $absence->user_id);

        $absence->delete();

        return back()->with('success', 'Távollét törölve.');
    }

    // --- Segédfüggvények ------------------------------------------------------

    /**
     * Csak a saját adatlap szerkeszthető (megrendelői döntés) — az admint is
     * beleértve. Máshoz tartozó adat módosítása 403.
     */
    private function assertSelf(Request $request, int $ownerId): void
    {
        abort_unless(
            $request->user()->id === $ownerId,
            403,
            'Csak a saját munkatárs-adatlapját szerkesztheti.',
        );
    }

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
     * A listában és az adatlap fejlécében közösen használt munkatárs-kép.
     *
     * @return array<string, mixed>
     */
    private function summary(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'job_title' => $user->job_title,
            'initials' => $user->initials(),
            'is_active' => (bool) $user->is_active,
            'role' => $user->roles->first()?->name,
            'expiring_count' => (int) ($user->expiring_count ?? 0),
            'on_leave' => (bool) ($user->on_leave ?? false),
        ];
    }
}
