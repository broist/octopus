<?php

namespace App\Http\Controllers;

use App\Http\Requests\MaterialProcurementRequest;
use App\Http\Requests\MaterialRequest;
use App\Models\Material;
use App\Models\MaterialProcurement;
use App\Models\Partner;
use App\Models\Project;
use App\Support\Materials;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Anyagok / Készlet (spec §8) — projektre kötött beszerzés-követés (NEM valós
 * idejű raktárkészlet). Anyagtörzs + projekthez kötött beszerzések (mennyiség,
 * ár, beszállító a CRM-ből), státusz tervezett → megrendelve → beérkezett.
 * A „tervezett", de még nem megrendelt tételek adják a Dashboard hiány-riasztását;
 * a beérkezés a naptárban is megjelenik (szállítás). A projektenkénti anyagköltség
 * a Pénzügy modul (9.) tényleges költségébe épül be.
 */
class MaterialController extends Controller
{
    // --- Beszerzések (fő nézet) ----------------------------------------------

    public function index(Request $request): Response
    {
        $search = $request->string('search')->toString();
        $category = $request->string('category')->toString();
        $status = $request->string('status')->toString();
        $projectId = $request->integer('project');

        $procurements = MaterialProcurement::query()
            ->with(['material:id,name,unit,category', 'project:id,code,name', 'supplier:id,name'])
            ->when($search !== '', fn ($q) => $q->whereHas('material', fn ($m) => $m->search($search)))
            ->when($category !== '', fn ($q) => $q->whereHas('material', fn ($m) => $m->category($category)))
            ->when($projectId > 0, fn ($q) => $q->where('project_id', $projectId))
            ->status($status)
            ->latest()
            ->paginate(20)
            ->withQueryString()
            ->through(fn (MaterialProcurement $p) => $this->procurementSummary($p));

        // A csempék a projekt-szűrőt követik (projektenkénti anyagköltség-összesítő).
        $scoped = fn () => MaterialProcurement::query()
            ->when($projectId > 0, fn ($q) => $q->where('project_id', $projectId));

        return Inertia::render('Materials/Index', [
            'procurements' => $procurements,
            'filters' => [
                'search' => $search,
                'category' => $category,
                'status' => $status,
                'project' => $projectId ?: null,
            ],
            'stats' => [
                'total' => $scoped()->count(),
                'planned' => $scoped()->where('status', 'tervezett')->count(),
                'ordered' => $scoped()->where('status', 'megrendelve')->count(),
                'received' => $scoped()->where('status', 'beerkezett')->count(),
                'value' => (float) $scoped()->committed()->sum(DB::raw('quantity * unit_price')),
            ],
            ...$this->options(),
        ]);
    }

    public function store(MaterialProcurementRequest $request): RedirectResponse
    {
        MaterialProcurement::create([
            ...$this->withStatusDates($request->validated()),
            'created_by' => $request->user()->id,
        ]);

        return back()->with('success', 'Beszerzés rögzítve.');
    }

    public function update(MaterialProcurementRequest $request, MaterialProcurement $procurement): RedirectResponse
    {
        $procurement->update($this->withStatusDates($request->validated()));

        return back()->with('success', 'Beszerzés módosítva.');
    }

    public function destroy(MaterialProcurement $procurement): RedirectResponse
    {
        $procurement->delete();

        return back()->with('success', 'Beszerzés törölve.');
    }

    /**
     * Gyors művelet: a tétel beérkezettre állítása (dátum + mennyiség pótlása).
     */
    public function receive(MaterialProcurement $procurement): RedirectResponse
    {
        $procurement->update([
            'status' => 'beerkezett',
            'received_on' => $procurement->received_on ?? today()->toDateString(),
            'received_quantity' => $procurement->received_quantity ?? $procurement->quantity,
        ]);

        return back()->with('success', 'A tétel beérkezettként rögzítve.');
    }

    // --- Anyagtörzs (katalógus) ----------------------------------------------

    public function catalog(Request $request): Response
    {
        $search = $request->string('search')->toString();
        $category = $request->string('category')->toString();

        $materials = Material::query()
            ->search($search)
            ->category($category)
            ->withCount('procurements')
            ->orderBy('name')
            ->paginate(30)
            ->withQueryString()
            ->through(fn (Material $m) => [
                'id' => $m->id,
                'name' => $m->name,
                'category' => $m->category,
                'category_label' => $m->category ? (Materials::CATEGORIES[$m->category] ?? $m->category) : null,
                'unit' => $m->unit,
                'unit_label' => Materials::UNITS[$m->unit] ?? $m->unit,
                'sku' => $m->sku,
                'note' => $m->note,
                'procurements_count' => $m->procurements_count,
            ]);

        return Inertia::render('Materials/Catalog', [
            'materials' => $materials,
            'filters' => ['search' => $search, 'category' => $category],
            'categories' => Materials::CATEGORIES,
            'units' => Materials::UNITS,
        ]);
    }

    public function storeMaterial(MaterialRequest $request): RedirectResponse
    {
        $material = Material::create($request->validated());

        return back()->with('success', "„{$material->name}” felvéve az anyagtörzsbe.");
    }

    public function updateMaterial(MaterialRequest $request, Material $material): RedirectResponse
    {
        $material->update($request->validated());

        return back()->with('success', 'Anyag módosítva.');
    }

    public function destroyMaterial(Material $material): RedirectResponse
    {
        $count = $material->procurements()->count();
        if ($count > 0) {
            return back()->with('error', "„{$material->name}” nem törölhető: {$count} beszerzéshez kapcsolódik.");
        }

        $name = $material->name;
        $material->delete();

        return back()->with('success', "„{$name}” törölve az anyagtörzsből.");
    }

    // --- Segédfüggvények ------------------------------------------------------

    /**
     * A státuszhoz igazított dátum-kitöltés: megrendeléskor/beérkezéskor a
     * hiányzó dátumot (és beérkezéskor a mennyiséget) kényelemből kitöltjük.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function withStatusDates(array $data): array
    {
        if (($data['status'] ?? null) === 'megrendelve' && empty($data['ordered_on'])) {
            $data['ordered_on'] = today()->toDateString();
        }

        if (($data['status'] ?? null) === 'beerkezett') {
            $data['received_on'] = $data['received_on'] ?? today()->toDateString();
            $data['received_quantity'] = $data['received_quantity'] ?? ($data['quantity'] ?? null);
        }

        return $data;
    }

    /**
     * A modálokhoz közös törzslisták és opciók.
     *
     * @return array<string, mixed>
     */
    private function options(): array
    {
        return [
            'materials' => Material::orderBy('name')->get(['id', 'name', 'unit', 'category'])
                ->map(fn (Material $m) => [
                    'id' => $m->id,
                    'name' => $m->name,
                    'unit' => $m->unit,
                    'unit_label' => Materials::UNITS[$m->unit] ?? $m->unit,
                    'category_label' => $m->category ? (Materials::CATEGORIES[$m->category] ?? $m->category) : null,
                ]),
            'suppliers' => Partner::suppliers()->orderBy('name')->get(['id', 'name'])
                ->map(fn ($p) => ['id' => $p->id, 'name' => $p->name]),
            'projects' => Project::orderBy('code')->get(['id', 'code', 'name'])
                ->map(fn ($p) => ['id' => $p->id, 'code' => $p->code, 'name' => $p->name]),
            'statuses' => Materials::STATUSES,
            'categories' => Materials::CATEGORIES,
            'units' => Materials::UNITS,
        ];
    }

    /**
     * A beszerzés-lista egy sorának adata.
     *
     * @return array<string, mixed>
     */
    private function procurementSummary(MaterialProcurement $p): array
    {
        return [
            'id' => $p->id,
            'material' => $p->material ? [
                'id' => $p->material->id,
                'name' => $p->material->name,
                'unit' => $p->material->unit,
                'unit_label' => Materials::UNITS[$p->material->unit] ?? $p->material->unit,
                'category_label' => $p->material->category
                    ? (Materials::CATEGORIES[$p->material->category] ?? $p->material->category)
                    : null,
            ] : null,
            'project' => $p->project
                ? ['id' => $p->project->id, 'code' => $p->project->code, 'name' => $p->project->name]
                : null,
            'supplier_id' => $p->supplier_id,
            'supplier_name' => $p->supplier?->name,
            'status' => $p->status,
            'status_label' => Materials::STATUSES[$p->status] ?? $p->status,
            'quantity' => (float) $p->quantity,
            'unit_price' => $p->unit_price !== null ? (float) $p->unit_price : null,
            'line_value' => $p->lineValue(),
            'ordered_on' => $p->ordered_on?->toDateString(),
            'expected_on' => $p->expected_on?->toDateString(),
            'received_on' => $p->received_on?->toDateString(),
            'received_quantity' => $p->received_quantity !== null ? (float) $p->received_quantity : null,
            'note' => $p->note,
        ];
    }
}
