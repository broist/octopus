<?php

namespace App\Http\Controllers;

use App\Http\Requests\PartnerRequest;
use App\Models\Partner;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Ügyfelek és partnerek (CRM, 4. modul).
 *
 * Közös partner-adatbázis: egy soron szerep-flag jelzi, hogy a partner
 * megrendelő, beszállító és/vagy alvállalkozó. A webes ajánlatkérésekből
 * automatikusan létrejött ügyfelek 'lead' forrásjelöléssel érkeznek ide.
 */
class PartnerController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->string('search')->toString();
        $role = $request->string('role')->toString();
        $type = $request->string('type')->toString(); // '', 'company', 'person'

        $partners = Partner::query()
            ->search($search)
            ->when(array_key_exists($role, Partner::ROLES), fn ($q) => $q->withRole($role))
            ->when($type === 'company', fn ($q) => $q->where('is_company', true))
            ->when($type === 'person', fn ($q) => $q->where('is_company', false))
            ->withCount('projects')
            ->orderBy('name')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Partner $p) => $this->summary($p));

        return Inertia::render('CRM/Index', [
            'partners' => $partners,
            'filters' => ['search' => $search, 'role' => $role, 'type' => $type],
            'roles' => Partner::ROLES,
            'stats' => [
                'total' => Partner::count(),
                'clients' => Partner::where('is_client', true)->count(),
                'suppliers' => Partner::where('is_supplier', true)->count(),
                'subcontractors' => Partner::where('is_subcontractor', true)->count(),
                'leads' => Partner::where('source', 'lead')->count(),
            ],
        ]);
    }

    public function store(PartnerRequest $request): RedirectResponse
    {
        $partner = Partner::create($request->validated());

        return redirect()
            ->route('crm.show', $partner)
            ->with('success', "{$partner->name} felvéve a partnerek közé.");
    }

    public function show(Partner $partner): Response
    {
        $partner->loadCount('projects');
        $partner->load([
            'projects' => fn ($q) => $q->with('projectManager:id,name')
                ->orderByDesc('updated_at'),
        ]);

        return Inertia::render('CRM/Show', [
            'partner' => [
                ...$this->summary($partner),
                'tax_id' => $partner->tax_id,
                'address' => $partner->address,
                'note' => $partner->note,
                'created_at' => $partner->created_at?->toIso8601String(),
            ],
            'projects' => $partner->projects->map(fn ($p) => [
                'id' => $p->id,
                'code' => $p->code,
                'name' => $p->name,
                'status' => $p->status,
                'pm_name' => $p->projectManager?->name,
                'starts_on' => $p->starts_on?->toDateString(),
                'ends_on' => $p->ends_on?->toDateString(),
            ])->values(),
            'statuses' => \App\Models\Project::STATUSES,
        ]);
    }

    public function update(PartnerRequest $request, Partner $partner): RedirectResponse
    {
        $partner->update($request->validated());

        return back()->with('success', "{$partner->name} adatai módosítva.");
    }

    public function destroy(Partner $partner): RedirectResponse
    {
        // Aktív projekthez kötött megrendelőt nem törlünk némán — a projektek
        // client_id-ja lógva maradna.
        $projectCount = $partner->projects()->count();
        if ($projectCount > 0) {
            return back()->with(
                'error',
                "{$partner->name} nem archiválható: {$projectCount} projekthez van rendelve.",
            );
        }

        $name = $partner->name;
        $partner->delete();

        return redirect()
            ->route('crm.index')
            ->with('success', "{$name} archiválva.");
    }

    /**
     * A listában és az adatlap fejlécében közösen használt partner-kép.
     *
     * @return array<string, mixed>
     */
    private function summary(Partner $partner): array
    {
        return [
            'id' => $partner->id,
            'name' => $partner->name,
            'is_company' => (bool) $partner->is_company,
            'is_client' => (bool) $partner->is_client,
            'is_supplier' => (bool) $partner->is_supplier,
            'is_subcontractor' => (bool) $partner->is_subcontractor,
            'roles' => $partner->roleLabels(),
            'source' => $partner->source,
            'contact_name' => $partner->contact_name,
            'email' => $partner->email,
            'phone' => $partner->phone,
            'projects_count' => $partner->projects_count ?? 0,
        ];
    }
}
