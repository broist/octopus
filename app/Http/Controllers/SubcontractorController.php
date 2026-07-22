<?php

namespace App\Http\Controllers;

use App\Http\Requests\SubcontractorRequest;
use App\Models\Document;
use App\Models\Partner;
use App\Models\Project;
use App\Models\SubcontractorCertification;
use App\Models\SubcontractorDocument;
use App\Models\SubcontractorRating;
use App\Support\Subcontractors;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/**
 * Alvállalkozók (spec §5) — önálló, kiemelt modul. A háttérben ugyanaz a
 * partners tábla, mint a CRM-nél (is_subcontractor flag), de külön nézettel,
 * mezőkkel (szakma, kapacitás), tanúsítványokkal (lejárati figyelmeztetés),
 * teljesítmény-értékeléssel, dokumentumokkal és projekt-hozzárendeléssel.
 * A pénzügyi elszámolás a Pénzügy modulhoz (9.) tartozik.
 */
class SubcontractorController extends Controller
{
    /** Ennyi napon belüli lejárat számít „hamarosan lejárónak". */
    private const CERT_SOON_DAYS = 30;

    public function index(Request $request): Response
    {
        $search = $request->string('search')->toString();
        $trade = $request->string('trade')->toString();

        $subs = Partner::query()
            ->subcontractors()
            ->search($search)
            ->trade($trade)
            ->withAvg('ratings as avg_rating', 'score')
            ->withCount(['certifications as expiring_count' => fn ($q) => $q
                ->whereNotNull('valid_until')
                ->whereDate('valid_until', '<=', today()->addDays(self::CERT_SOON_DAYS))])
            ->orderBy('name')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Partner $p) => $this->summary($p));

        return Inertia::render('Subcontractors/Index', [
            'subcontractors' => $subs,
            'filters' => ['search' => $search, 'trade' => $trade],
            'trades' => Subcontractors::TRADES,
            'stats' => [
                'total' => Partner::subcontractors()->count(),
                'expiring' => Partner::subcontractors()
                    ->whereHas('certifications', fn ($q) => $q
                        ->whereNotNull('valid_until')
                        ->whereDate('valid_until', '<=', today()->addDays(self::CERT_SOON_DAYS)))
                    ->count(),
                'trades' => Partner::subcontractors()->whereNotNull('trade')->distinct('trade')->count('trade'),
            ],
        ]);
    }

    public function store(SubcontractorRequest $request): RedirectResponse
    {
        $partner = Partner::create([
            ...$request->validated(),
            'is_subcontractor' => true,
        ]);

        return redirect()
            ->route('subcontractors.show', $partner)
            ->with('success', "{$partner->name} felvéve az alvállalkozók közé.");
    }

    public function show(Partner $partner): Response
    {
        abort_unless($partner->is_subcontractor, 404);

        $partner->load([
            'certifications.uploader:id,name',
            'ratings.rater:id,name',
            'ratings.project:id,code,name',
            'subcontractorDocuments.uploader:id,name',
            'assignedProjects' => fn ($q) => $q->select('projects.id', 'projects.code', 'projects.name', 'projects.status')->orderByDesc('projects.updated_at'),
        ]);

        $assignedIds = $partner->assignedProjects->pluck('id');

        return Inertia::render('Subcontractors/Show', [
            'subcontractor' => [
                ...$this->summary($partner),
                'tax_id' => $partner->tax_id,
                'address' => $partner->address,
                'availability_note' => $partner->availability_note,
                'note' => $partner->note,
                'created_at' => $partner->created_at?->toIso8601String(),
            ],
            'certifications' => $partner->certifications->map(fn (SubcontractorCertification $c) => [
                'id' => $c->id,
                'type' => $c->type,
                'type_label' => Subcontractors::CERT_TYPES[$c->type] ?? $c->type,
                'name' => $c->name,
                'issuer' => $c->issuer,
                'valid_from' => $c->valid_from?->toDateString(),
                'valid_until' => $c->valid_until?->toDateString(),
                'note' => $c->note,
                'status' => $c->expiryStatus(self::CERT_SOON_DAYS),
                'has_file' => $c->hasFile(),
                'file_name' => $c->original_filename,
                'download_url' => $c->hasFile() ? route('subcontractors.certifications.download', $c->id) : null,
            ])->values(),
            'ratings' => $partner->ratings->map(fn (SubcontractorRating $r) => [
                'id' => $r->id,
                'score' => $r->score,
                'comment' => $r->comment,
                'project' => $r->project ? ['id' => $r->project->id, 'code' => $r->project->code, 'name' => $r->project->name] : null,
                'rater_name' => $r->rater?->name,
                'created_at' => $r->created_at?->toDateString(),
            ])->values(),
            'avg_rating' => $partner->averageRating(),
            'documents' => $partner->subcontractorDocuments->map(fn (SubcontractorDocument $d) => [
                'id' => $d->id,
                'category' => $d->category,
                'category_label' => Subcontractors::DOC_CATEGORIES[$d->category] ?? $d->category,
                'name' => $d->original_filename,
                'size_bytes' => $d->size_bytes,
                'uploader_name' => $d->uploader?->name,
                'created_at' => $d->created_at?->toDateString(),
                'download_url' => route('subcontractors.documents.download', $d->id),
            ])->values(),
            'assigned_projects' => $partner->assignedProjects->map(fn (Project $p) => [
                'id' => $p->id,
                'code' => $p->code,
                'name' => $p->name,
                'status' => $p->status,
                'pivot_id' => $p->pivot->id,
                'scope' => $p->pivot->scope,
                'note' => $p->pivot->note,
            ])->values(),
            'assignable_projects' => Project::query()
                ->whereNull('parent_id')
                ->whereNotIn('id', $assignedIds)
                ->orderByDesc('updated_at')
                ->limit(200)
                ->get(['id', 'code', 'name'])
                ->map(fn ($p) => ['id' => $p->id, 'code' => $p->code, 'name' => $p->name]),
            'trades' => Subcontractors::TRADES,
            'cert_types' => Subcontractors::CERT_TYPES,
            'doc_categories' => Subcontractors::DOC_CATEGORIES,
            'statuses' => Project::STATUSES,
        ]);
    }

    public function update(SubcontractorRequest $request, Partner $partner): RedirectResponse
    {
        abort_unless($partner->is_subcontractor, 404);

        $partner->update($request->validated());

        return back()->with('success', "{$partner->name} adatai módosítva.");
    }

    public function destroy(Partner $partner): RedirectResponse
    {
        abort_unless($partner->is_subcontractor, 404);

        // A CRM-mel egyezően: megrendelőként projekthez kötött partnert nem
        // archiválunk némán (a projektek client_id-ja lógva maradna).
        $projectCount = $partner->projects()->count();
        if ($projectCount > 0) {
            return back()->with(
                'error',
                "{$partner->name} nem archiválható: {$projectCount} projekthez van megrendelőként rendelve (CRM).",
            );
        }

        $name = $partner->name;
        $partner->delete();

        return redirect()
            ->route('subcontractors.index')
            ->with('success', "{$name} archiválva.");
    }

    // --- Tanúsítványok / engedélyek ------------------------------------------

    public function storeCertification(Request $request, Partner $partner): RedirectResponse
    {
        abort_unless($partner->is_subcontractor, 404);

        $data = $request->validate([
            'type' => ['required', Rule::in(array_keys(Subcontractors::CERT_TYPES))],
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
                'file_path' => $file->store("subcontractor-{$partner->id}/cert", $disk),
                'original_filename' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'size_bytes' => $file->getSize(),
                'uploaded_by' => $request->user()->id,
            ];
        }

        $partner->certifications()->create($attributes);

        return back()->with('success', 'Dokumentum rögzítve.');
    }

    public function destroyCertification(SubcontractorCertification $certification): RedirectResponse
    {
        if ($certification->hasFile()) {
            Storage::disk($certification->disk)->delete($certification->file_path);
        }
        $certification->delete();

        return back()->with('success', 'Dokumentum törölve.');
    }

    public function downloadCertification(Request $request, SubcontractorCertification $certification): SymfonyResponse
    {
        abort_unless($certification->hasFile(), 404, 'Ehhez a tételhez nincs csatolt fájl.');

        return $this->serveFile($certification->disk, $certification->file_path, $certification->original_filename);
    }

    // --- Értékelések ----------------------------------------------------------

    public function storeRating(Request $request, Partner $partner): RedirectResponse
    {
        abort_unless($partner->is_subcontractor, 404);

        $data = $request->validate([
            'score' => ['required', 'integer', 'between:1,5'],
            'project_id' => ['nullable', 'exists:projects,id'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ], [
            'score.required' => 'Adjon meg 1–5 csillagot.',
            'score.between' => 'Az értékelés 1 és 5 csillag közötti.',
        ]);

        $partner->ratings()->create([
            'score' => $data['score'],
            'project_id' => $data['project_id'] ?? null,
            'comment' => $data['comment'] ?? null,
            'rated_by' => $request->user()->id,
        ]);

        return back()->with('success', 'Értékelés hozzáadva.');
    }

    public function destroyRating(SubcontractorRating $rating): RedirectResponse
    {
        $rating->delete();

        return back()->with('success', 'Értékelés törölve.');
    }

    // --- Dokumentumok ---------------------------------------------------------

    public function storeDocument(Request $request, Partner $partner): RedirectResponse
    {
        abort_unless($partner->is_subcontractor, 404);

        $request->validate([
            'category' => ['required', Rule::in(array_keys(Subcontractors::DOC_CATEGORIES))],
            'files' => ['required', 'array', 'min:1'],
            'files.*' => ['file', 'max:51200'],
        ], [
            'files.required' => 'Válasszon legalább egy fájlt.',
        ]);

        foreach ($request->file('files') as $file) {
            $disk = Document::diskFor('egyeb', (int) $file->getSize());
            $partner->subcontractorDocuments()->create([
                'category' => $request->string('category')->toString(),
                'disk' => $disk,
                'file_path' => $file->store("subcontractor-{$partner->id}/doc", $disk),
                'original_filename' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'size_bytes' => $file->getSize(),
                'uploaded_by' => $request->user()->id,
            ]);
        }

        return back()->with('success', 'Dokumentum(ok) feltöltve.');
    }

    public function downloadDocument(Request $request, SubcontractorDocument $document): SymfonyResponse
    {
        return $this->serveFile($document->disk, $document->file_path, $document->original_filename);
    }

    public function destroyDocument(SubcontractorDocument $document): RedirectResponse
    {
        Storage::disk($document->disk)->delete($document->file_path);
        $document->delete();

        return back()->with('success', 'Dokumentum törölve.');
    }

    // --- Projekt-hozzárendelés ------------------------------------------------

    public function attachProject(Request $request, Partner $partner): RedirectResponse
    {
        abort_unless($partner->is_subcontractor, 404);

        $data = $request->validate([
            'project_id' => ['required', 'exists:projects,id'],
            'scope' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:2000'],
        ], [
            'project_id.required' => 'Válasszon projektet.',
        ]);

        $partner->assignedProjects()->syncWithoutDetaching([
            $data['project_id'] => [
                'scope' => $data['scope'] ?? null,
                'note' => $data['note'] ?? null,
            ],
        ]);

        return back()->with('success', 'Alvállalkozó a projekthez rendelve.');
    }

    public function detachProject(Partner $partner, Project $project): RedirectResponse
    {
        abort_unless($partner->is_subcontractor, 404);

        $partner->assignedProjects()->detach($project->id);

        return back()->with('success', 'Hozzárendelés eltávolítva.');
    }

    // --- Segédfüggvények ------------------------------------------------------

    /**
     * Fájl kiszolgálása a hibrid tárolásból: S3 (plans) esetén presigned URL,
     * egyébként közvetlen letöltés (a TaskController mintája).
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
     * A listában és az adatlap fejlécében közösen használt alvállalkozó-kép.
     *
     * @return array<string, mixed>
     */
    private function summary(Partner $partner): array
    {
        return [
            'id' => $partner->id,
            'name' => $partner->name,
            'is_company' => (bool) $partner->is_company,
            'trade' => $partner->trade,
            'trade_label' => $partner->trade ? (Subcontractors::TRADES[$partner->trade] ?? $partner->trade) : null,
            'crew_size' => $partner->crew_size,
            'contact_name' => $partner->contact_name,
            'email' => $partner->email,
            'phone' => $partner->phone,
            // withAvg/withCount aliasok a listában; az adatlap külön adja az avg-t.
            'avg_rating' => isset($partner->avg_rating) ? round((float) $partner->avg_rating, 1) : null,
            'expiring_count' => (int) ($partner->expiring_count ?? 0),
        ];
    }
}
