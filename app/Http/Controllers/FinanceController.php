<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\MaterialProcurement;
use App\Models\Partner;
use App\Models\Project;
use App\Models\ProjectBudgetItem;
use App\Models\ProjectCost;
use App\Models\Quote;
use App\Support\Finance;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/**
 * Pénzügy / Költségvetés (spec §9) — itt fut össze a projektek pénzügyi oldala.
 * Bevétel: a projekt szerződéses (nettó) értéke, ill. az elfogadott/kiadott
 * árajánlat (Ajánlatkérő). Tényleges költség: anyag (Anyagok modul, automatikus)
 * + alvállalkozó/gép/egyéb költség-tételek. Terv-vs-tény és nyereségesség
 * projektenként (az alprojektek beleszámítva). A kimenő számlázás / Számlázz.hu
 * integráció a build-sorrend szerint a legvégére marad.
 */
class FinanceController extends Controller
{
    public function index(Request $request): Response
    {
        $search = $request->string('search')->toString();

        $projects = Project::query()
            ->whereNull('parent_id')
            ->when($search !== '', fn ($q) => $q->where(function ($w) use ($search) {
                $w->where('code', 'ilike', "%{$search}%")->orWhere('name', 'ilike', "%{$search}%");
            }))
            ->with(['subprojects:id,parent_id', 'client:id,name'])
            ->orderBy('code')
            ->get();

        // A releváns projekt-id-k (fő + alprojektek) egy halomban a csoportos összegekhez.
        $idsFor = [];
        $allIds = [];
        foreach ($projects as $p) {
            $ids = array_merge([$p->id], $p->subprojects->pluck('id')->all());
            $idsFor[$p->id] = $ids;
            $allIds = array_merge($allIds, $ids);
        }

        [$materialBy, $costBy, $budgetBy, $quoteBy] = $this->groupedSums($allIds);

        $rows = $projects->map(function (Project $p) use ($idsFor, $materialBy, $costBy, $budgetBy, $quoteBy) {
            $ids = $idsFor[$p->id];
            $material = $this->sumOver($materialBy, $ids);
            $otherCost = $this->sumOver($costBy, $ids);
            $actual = $material + $otherCost;
            $budget = $this->sumOver($budgetBy, $ids);
            $revenue = $p->contract_value !== null
                ? (float) $p->contract_value
                : $this->maxOver($quoteBy, $ids);
            $profit = $revenue - $actual;

            return [
                'id' => $p->id,
                'code' => $p->code,
                'name' => $p->name,
                'status' => $p->status,
                'client_name' => $p->client?->name,
                'revenue' => $revenue,
                'revenue_from_quote' => $p->contract_value === null && $revenue > 0,
                'budget' => $budget,
                'material_cost' => $material,
                'actual_cost' => $actual,
                'profit' => $profit,
                'margin' => $revenue > 0 ? round($profit / $revenue * 100, 1) : null,
                'over_budget' => $budget > 0 && $actual > $budget,
            ];
        })->values();

        return Inertia::render('Finance/Index', [
            'projects' => $rows,
            'filters' => ['search' => $search],
            'totals' => [
                'revenue' => $rows->sum('revenue'),
                'actual_cost' => $rows->sum('actual_cost'),
                'profit' => $rows->sum('profit'),
                'over_budget' => $rows->where('over_budget', true)->count(),
            ],
            'statuses' => Project::STATUSES,
        ]);
    }

    public function show(Project $project): Response
    {
        $ids = array_merge([$project->id], $project->subprojects()->pluck('id')->all());

        $budgetItems = ProjectBudgetItem::whereIn('project_id', $ids)
            ->with('project:id,code')
            ->latest()->get();
        $costs = ProjectCost::whereIn('project_id', $ids)
            ->with(['partner:id,name', 'project:id,code'])
            ->orderByDesc('incurred_on')->orderByDesc('id')->get();

        $material = (float) MaterialProcurement::committed()->whereIn('project_id', $ids)
            ->sum(DB::raw('quantity * unit_price'));
        $otherCost = (float) $costs->sum('amount');
        $actual = $material + $otherCost;
        $budgetTotal = (float) $budgetItems->sum('amount');

        $revenue = $project->contract_value !== null
            ? (float) $project->contract_value
            : (float) Quote::whereIn('project_id', $ids)->where('status', 'jóváhagyva')->max('net_offer');

        // Terv vs. tény kategóriánként (anyag terv a budget-ből, tény az Anyagokból).
        $budgetByCat = $budgetItems->groupBy('category')->map(fn ($g) => (float) $g->sum('amount'));
        $actualByCat = $costs->groupBy('category')->map(fn ($g) => (float) $g->sum('amount'));
        $actualByCat['anyag'] = $material;

        $categories = collect(array_keys(Finance::BUDGET_CATEGORIES))->map(fn ($cat) => [
            'key' => $cat,
            'label' => Finance::BUDGET_CATEGORIES[$cat],
            'planned' => (float) ($budgetByCat[$cat] ?? 0),
            'actual' => (float) ($actualByCat[$cat] ?? 0),
        ])->values();

        return Inertia::render('Finance/Show', [
            'project' => [
                'id' => $project->id,
                'code' => $project->code,
                'name' => $project->name,
                'status' => $project->status,
                'client_name' => $project->client?->name,
                'contract_value' => $project->contract_value !== null ? (float) $project->contract_value : null,
            ],
            'summary' => [
                'revenue' => $revenue,
                'revenue_from_quote' => $project->contract_value === null && $revenue > 0,
                'budget' => $budgetTotal,
                'material_cost' => $material,
                'other_cost' => $otherCost,
                'actual_cost' => $actual,
                'profit' => $revenue - $actual,
                'margin' => $revenue > 0 ? round(($revenue - $actual) / $revenue * 100, 1) : null,
                'over_budget' => $budgetTotal > 0 && $actual > $budgetTotal,
            ],
            'categories' => $categories,
            'budget_items' => $budgetItems->map(fn (ProjectBudgetItem $b) => [
                'id' => $b->id,
                'category' => $b->category,
                'category_label' => Finance::BUDGET_CATEGORIES[$b->category] ?? $b->category,
                'description' => $b->description,
                'amount' => (float) $b->amount,
                'project_code' => $b->project?->code,
            ])->values(),
            'costs' => $costs->map(fn (ProjectCost $c) => [
                'id' => $c->id,
                'category' => $c->category,
                'category_label' => Finance::COST_CATEGORIES[$c->category] ?? $c->category,
                'partner_id' => $c->partner_id,
                'partner_name' => $c->partner?->name,
                'description' => $c->description,
                'amount' => (float) $c->amount,
                'incurred_on' => $c->incurred_on?->toDateString(),
                'is_invoice' => $c->is_invoice,
                'due_on' => $c->due_on?->toDateString(),
                'is_paid' => $c->is_paid,
                'overdue' => $c->is_invoice && ! $c->is_paid && $c->due_on && $c->due_on->isPast(),
                'has_file' => $c->hasFile(),
                'file_name' => $c->original_filename,
                'download_url' => $c->hasFile() ? route('finance.costs.download', $c->id) : null,
                'project_code' => $c->project?->code,
            ])->values(),
            'quotes' => Quote::whereIn('project_id', $ids)
                ->orderByDesc('updated_at')
                ->get(['id', 'quote_number', 'project_name', 'status', 'net_offer', 'gross_offer'])
                ->map(fn (Quote $q) => [
                    'id' => $q->id,
                    'quote_number' => $q->quote_number,
                    'name' => $q->project_name,
                    'status' => $q->status,
                    'net_offer' => (int) $q->net_offer,
                    'gross_offer' => (int) $q->gross_offer,
                ]),
            'partners' => Partner::query()
                ->where(fn ($q) => $q->where('is_subcontractor', true)->orWhere('is_supplier', true))
                ->orderBy('name')->get(['id', 'name'])
                ->map(fn ($p) => ['id' => $p->id, 'name' => $p->name]),
            'budget_categories' => Finance::BUDGET_CATEGORIES,
            'cost_categories' => Finance::COST_CATEGORIES,
        ]);
    }

    public function updateContract(Request $request, Project $project): RedirectResponse
    {
        $data = $request->validate([
            'contract_value' => ['nullable', 'numeric', 'min:0', 'max:999999999999'],
        ]);

        $project->update(['contract_value' => $data['contract_value'] ?? null]);

        return back()->with('success', 'Szerződéses érték frissítve.');
    }

    // --- Költségvetési tételek (terv) ----------------------------------------

    public function storeBudgetItem(Request $request, Project $project): RedirectResponse
    {
        $data = $request->validate([
            'category' => ['required', Rule::in(array_keys(Finance::BUDGET_CATEGORIES))],
            'description' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0', 'max:999999999999'],
        ], [
            'description.required' => 'Adjon meg megnevezést.',
            'amount.required' => 'Adja meg a tervezett összeget.',
        ]);

        $project->budgetItems()->create([...$data, 'created_by' => $request->user()->id]);

        return back()->with('success', 'Költségvetési tétel hozzáadva.');
    }

    public function destroyBudgetItem(ProjectBudgetItem $item): RedirectResponse
    {
        $item->delete();

        return back()->with('success', 'Költségvetési tétel törölve.');
    }

    // --- Tényleges költségek / bejövő számlák --------------------------------

    public function storeCost(Request $request, Project $project): RedirectResponse
    {
        $data = $this->validateCost($request);
        $attributes = $this->costAttributes($data, $request);
        $attributes['created_by'] = $request->user()->id;

        $project->costs()->create($attributes);

        return back()->with('success', 'Költség rögzítve.');
    }

    public function updateCost(Request $request, ProjectCost $cost): RedirectResponse
    {
        $data = $this->validateCost($request);
        $attributes = $this->costAttributes($data, $request, $cost);

        $cost->update($attributes);

        return back()->with('success', 'Költség módosítva.');
    }

    public function togglePaid(ProjectCost $cost): RedirectResponse
    {
        $cost->update(['is_paid' => ! $cost->is_paid]);

        return back()->with('success', $cost->is_paid ? 'Kifizetettként jelölve.' : 'Kifizetetlenre állítva.');
    }

    public function downloadCost(ProjectCost $cost): SymfonyResponse
    {
        abort_unless($cost->hasFile(), 404, 'Ehhez a tételhez nincs csatolt fájl.');

        $storage = Storage::disk($cost->disk);
        abort_unless($storage->exists($cost->file_path), 404, 'A fájl nem található.');

        if ($cost->disk === 'plans') {
            return redirect()->away($storage->temporaryUrl($cost->file_path, now()->addMinutes(10)));
        }

        return $storage->download($cost->file_path, $cost->original_filename);
    }

    public function destroyCost(ProjectCost $cost): RedirectResponse
    {
        if ($cost->hasFile()) {
            Storage::disk($cost->disk)->delete($cost->file_path);
        }
        $cost->delete();

        return back()->with('success', 'Költség törölve.');
    }

    // --- Segédfüggvények ------------------------------------------------------

    /**
     * @return array<string, mixed>
     */
    private function validateCost(Request $request): array
    {
        return $request->validate([
            'category' => ['required', Rule::in(array_keys(Finance::COST_CATEGORIES))],
            'partner_id' => ['nullable', 'exists:partners,id'],
            'description' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0', 'max:999999999999'],
            'incurred_on' => ['required', 'date'],
            'is_invoice' => ['boolean'],
            'due_on' => ['nullable', 'date'],
            'is_paid' => ['boolean'],
            'file' => ['nullable', 'file', 'max:20480'],
        ], [
            'description.required' => 'Adjon meg megnevezést.',
            'amount.required' => 'Adja meg az összeget.',
            'incurred_on.required' => 'Adja meg a dátumot.',
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function costAttributes(array $data, Request $request, ?ProjectCost $existing = null): array
    {
        $attributes = [
            'category' => $data['category'],
            'partner_id' => $data['partner_id'] ?? null,
            'description' => $data['description'],
            'amount' => $data['amount'],
            'incurred_on' => $data['incurred_on'],
            'is_invoice' => (bool) ($data['is_invoice'] ?? false),
            'due_on' => $data['due_on'] ?? null,
            'is_paid' => (bool) ($data['is_paid'] ?? false),
        ];

        if ($file = $request->file('file')) {
            // Régi fájl cseréje szerkesztéskor.
            if ($existing && $existing->hasFile()) {
                Storage::disk($existing->disk)->delete($existing->file_path);
            }
            $disk = Document::diskFor('egyeb', (int) $file->getSize());
            $projectId = $existing?->project_id ?? $request->route('project')?->id ?? 0;
            $attributes += [
                'disk' => $disk,
                'file_path' => $file->store("project-{$projectId}/cost", $disk),
                'original_filename' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType(),
                'size_bytes' => $file->getSize(),
            ];
        }

        return $attributes;
    }

    /**
     * Csoportos összegek a releváns projekt-id-kre (index, N+1 elkerülésére).
     *
     * @param  array<int, int>  $ids
     * @return array{0: array<int,float>, 1: array<int,float>, 2: array<int,float>, 3: array<int,float>}
     */
    private function groupedSums(array $ids): array
    {
        if ($ids === []) {
            return [[], [], [], []];
        }

        $material = MaterialProcurement::committed()->whereIn('project_id', $ids)
            ->selectRaw('project_id, sum(quantity * unit_price) as s')->groupBy('project_id')
            ->pluck('s', 'project_id')->map(fn ($v) => (float) $v)->all();

        $cost = ProjectCost::whereIn('project_id', $ids)
            ->selectRaw('project_id, sum(amount) as s')->groupBy('project_id')
            ->pluck('s', 'project_id')->map(fn ($v) => (float) $v)->all();

        $budget = ProjectBudgetItem::whereIn('project_id', $ids)
            ->selectRaw('project_id, sum(amount) as s')->groupBy('project_id')
            ->pluck('s', 'project_id')->map(fn ($v) => (float) $v)->all();

        $quote = Quote::whereIn('project_id', $ids)->where('status', 'jóváhagyva')
            ->selectRaw('project_id, max(net_offer) as n')->groupBy('project_id')
            ->pluck('n', 'project_id')->map(fn ($v) => (float) $v)->all();

        return [$material, $cost, $budget, $quote];
    }

    /**
     * @param  array<int, float>  $map
     * @param  array<int, int>  $ids
     */
    private function sumOver(array $map, array $ids): float
    {
        $sum = 0.0;
        foreach ($ids as $id) {
            $sum += $map[$id] ?? 0;
        }

        return $sum;
    }

    /**
     * @param  array<int, float>  $map
     * @param  array<int, int>  $ids
     */
    private function maxOver(array $map, array $ids): float
    {
        $max = 0.0;
        foreach ($ids as $id) {
            $max = max($max, $map[$id] ?? 0);
        }

        return $max;
    }
}
