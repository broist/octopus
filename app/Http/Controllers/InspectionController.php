<?php

namespace App\Http\Controllers;

use App\Models\ChecklistTemplate;
use App\Models\Defect;
use App\Models\Inspection;
use App\Models\Project;
use App\Support\Qa;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Ellenőrzések (spec §12): egy sablonból (vagy szabadon) példányosított,
 * projektre kötött checklist kitöltése. A tételek a példányosításkor a sablonból
 * másolódnak (pillanatkép). A „nem megfelelt" tételekből a hibalistába (Defect)
 * hiba nyitható.
 */
class InspectionController extends Controller
{
    public function index(Request $request): Response
    {
        $projectId = $request->integer('project');
        $status = $request->string('status')->toString();

        $inspections = Inspection::query()
            ->with(['project:id,code,name', 'template:id,name', 'creator:id,name'])
            ->withCount([
                'items',
                'items as failed_count' => fn ($q) => $q->where('result', 'nem_megfelelt'),
                'defects',
            ])
            ->when($projectId > 0, fn ($q) => $q->where('project_id', $projectId))
            ->when($status !== '', fn ($q) => $q->where('status', $status))
            ->orderByDesc('inspected_on')
            ->orderByDesc('id')
            ->paginate(20)
            ->withQueryString()
            ->through(fn (Inspection $i) => [
                'id' => $i->id,
                'title' => $i->title,
                'purpose' => $i->purpose,
                'purpose_label' => Qa::PURPOSES[$i->purpose] ?? $i->purpose,
                'inspected_on' => $i->inspected_on->toDateString(),
                'status' => $i->status,
                'project' => $i->project ? ['id' => $i->project->id, 'code' => $i->project->code, 'name' => $i->project->name] : null,
                'template_name' => $i->template?->name,
                'creator_name' => $i->creator?->name,
                'items_count' => $i->items_count,
                'failed_count' => $i->failed_count,
                'defects_count' => $i->defects_count,
            ]);

        return Inertia::render('Qa/Inspections', [
            'inspections' => $inspections,
            'filters' => ['project' => $projectId ?: null, 'status' => $status],
            'projects' => $this->projectOptions(),
            'templates' => $this->templateOptions(),
            'purposes' => Qa::PURPOSES,
            'canCreate' => $request->user()->can('qa.create'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'project_id' => ['required', 'exists:projects,id'],
            'checklist_template_id' => ['nullable', 'exists:checklist_templates,id'],
            'title' => ['required', 'string', 'max:255'],
            'purpose' => ['required', Rule::in(array_keys(Qa::PURPOSES))],
            'inspected_on' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:2000'],
        ], [
            'project_id.required' => 'Válasszon projektet.',
            'title.required' => 'Adja meg az ellenőrzés megnevezését.',
        ]);

        $inspection = Inspection::create([
            'project_id' => $data['project_id'],
            'checklist_template_id' => $data['checklist_template_id'] ?? null,
            'title' => $data['title'],
            'purpose' => $data['purpose'],
            'inspected_on' => $data['inspected_on'],
            'status' => 'folyamatban',
            'note' => $data['note'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        // A sablon tételeinek másolása pillanatképként (ha van sablon).
        if ($inspection->checklist_template_id) {
            $template = ChecklistTemplate::with('items')->find($inspection->checklist_template_id);
            foreach ($template?->items ?? [] as $item) {
                $inspection->items()->create([
                    'sort_order' => $item->sort_order,
                    'text' => $item->text,
                    'result' => 'nyitott',
                ]);
            }
        }

        $inspection->project?->logActivity('ellenorzes', "Ellenőrzés indítva: {$inspection->title}", $request->user());

        return redirect()->route('qa.inspections.show', $inspection)
            ->with('success', 'Ellenőrzés létrehozva — töltse ki a tételeket.');
    }

    public function show(Inspection $inspection): Response
    {
        $inspection->load([
            'project:id,code,name',
            'template:id,name',
            'creator:id,name',
            'items',
            'defects.responsible:id,name',
        ]);

        return Inertia::render('Qa/Inspection', [
            'inspection' => [
                'id' => $inspection->id,
                'title' => $inspection->title,
                'purpose' => $inspection->purpose,
                'purpose_label' => Qa::PURPOSES[$inspection->purpose] ?? $inspection->purpose,
                'inspected_on' => $inspection->inspected_on->toDateString(),
                'status' => $inspection->status,
                'note' => $inspection->note,
                'project' => $inspection->project
                    ? ['id' => $inspection->project->id, 'code' => $inspection->project->code, 'name' => $inspection->project->name]
                    : null,
                'template_name' => $inspection->template?->name,
                'creator_name' => $inspection->creator?->name,
                'items' => $inspection->items->map(fn ($i) => [
                    'id' => $i->id,
                    'text' => $i->text,
                    'result' => $i->result,
                    'note' => $i->note,
                ])->values(),
                'defects' => $inspection->defects->map(fn (Defect $d) => [
                    'id' => $d->id,
                    'title' => $d->title,
                    'status' => $d->status,
                    'status_label' => Qa::DEFECT_STATUSES[$d->status] ?? $d->status,
                    'responsible_name' => $d->responsible?->name,
                    'due_on' => $d->due_on?->toDateString(),
                ])->values(),
            ],
            'results' => Qa::INSPECTION_RESULTS,
            'purposes' => Qa::PURPOSES,
            'severities' => Qa::SEVERITIES,
            'statuses' => Qa::DEFECT_STATUSES,
            'users' => \App\Models\User::where('is_active', true)->where('is_external', false)
                ->orderBy('name')->get(['id', 'name'])->map(fn ($u) => ['id' => $u->id, 'name' => $u->name])->values(),
            'canEdit' => request()->user()->can('qa.edit'),
            'canCreateDefect' => request()->user()->can('qa.create'),
        ]);
    }

    public function update(Request $request, Inspection $inspection): RedirectResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'purpose' => ['required', Rule::in(array_keys(Qa::PURPOSES))],
            'inspected_on' => ['required', 'date'],
            'status' => ['required', Rule::in(['folyamatban', 'lezart'])],
            'note' => ['nullable', 'string', 'max:2000'],
            'items' => ['nullable', 'array'],
            'items.*.id' => ['nullable', 'integer'],
            'items.*.text' => ['required', 'string', 'max:500'],
            'items.*.result' => ['required', Rule::in(array_keys(Qa::INSPECTION_RESULTS))],
            'items.*.note' => ['nullable', 'string', 'max:255'],
        ]);

        $inspection->update([
            'title' => $data['title'],
            'purpose' => $data['purpose'],
            'inspected_on' => $data['inspected_on'],
            'status' => $data['status'],
            'note' => $data['note'] ?? null,
        ]);

        $this->syncItems($inspection, $data['items'] ?? []);

        return back()->with('success', 'Ellenőrzés mentve.');
    }

    public function destroy(Inspection $inspection): RedirectResponse
    {
        $inspection->delete();

        return redirect()->route('qa.inspections.index')->with('success', 'Ellenőrzés törölve.');
    }

    /**
     * A tételek szinkronizálása: a payloadból hiányzók törlése, meglévők
     * frissítése, újak felvétele (a kitöltés közben hozzáadható pont is).
     *
     * @param  array<int, array<string, mixed>>  $items
     */
    private function syncItems(Inspection $inspection, array $items): void
    {
        $keptIds = collect($items)->pluck('id')->filter()->all();
        $inspection->items()->whereNotIn('id', $keptIds)->delete();

        $order = 0;
        foreach ($items as $item) {
            $attributes = [
                'sort_order' => $order++,
                'text' => $item['text'],
                'result' => $item['result'],
                'note' => $item['note'] ?? null,
            ];

            if (! empty($item['id'])) {
                $inspection->items()->whereKey($item['id'])->update($attributes);
            } else {
                $inspection->items()->create($attributes);
            }
        }
    }

    /**
     * @return \Illuminate\Support\Collection<int, array<string, mixed>>
     */
    private function projectOptions()
    {
        return Project::orderBy('code')->get(['id', 'code', 'name'])
            ->map(fn (Project $p) => ['id' => $p->id, 'code' => $p->code, 'name' => $p->name])->values();
    }

    /**
     * @return \Illuminate\Support\Collection<int, array<string, mixed>>
     */
    private function templateOptions()
    {
        return ChecklistTemplate::where('is_active', true)->orderBy('name')
            ->withCount('items')
            ->get(['id', 'name', 'purpose'])
            ->map(fn (ChecklistTemplate $t) => [
                'id' => $t->id,
                'name' => $t->name,
                'purpose' => $t->purpose,
                'items_count' => $t->items_count,
            ])->values();
    }
}
