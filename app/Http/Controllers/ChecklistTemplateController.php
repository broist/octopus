<?php

namespace App\Http\Controllers;

use App\Models\ChecklistTemplate;
use App\Support\Qa;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Szerkeszthető ellenőrző-sablonok (spec §12): a felhasználók maguk hozhatnak
 * létre és szerkeszthetnek testre szabható checklist-sablonokat. Egy sablonból
 * az InspectionController példányosít ellenőrzést.
 */
class ChecklistTemplateController extends Controller
{
    public function index(Request $request): Response
    {
        $templates = ChecklistTemplate::query()
            ->with('items:id,checklist_template_id,text,sort_order')
            ->withCount(['items', 'inspections'])
            ->orderBy('name')
            ->get()
            ->map(fn (ChecklistTemplate $t) => [
                'id' => $t->id,
                'name' => $t->name,
                'purpose' => $t->purpose,
                'purpose_label' => Qa::PURPOSES[$t->purpose] ?? $t->purpose,
                'description' => $t->description,
                'is_active' => $t->is_active,
                'items_count' => $t->items_count,
                'inspections_count' => $t->inspections_count,
                'items' => $t->items->map(fn ($i) => ['id' => $i->id, 'text' => $i->text])->values(),
            ]);

        return Inertia::render('Qa/Templates', [
            'templates' => $templates,
            'purposes' => Qa::PURPOSES,
            'canManage' => $request->user()->can('qa.create'),
            'canDelete' => $request->user()->can('qa.delete'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateTemplate($request);

        $template = ChecklistTemplate::create([
            'name' => $data['name'],
            'purpose' => $data['purpose'],
            'description' => $data['description'] ?? null,
            'is_active' => $data['is_active'] ?? true,
            'created_by' => $request->user()->id,
        ]);

        $this->syncItems($template, $data['items'] ?? []);

        return back()->with('success', "„{$template->name}” sablon létrehozva.");
    }

    public function update(Request $request, ChecklistTemplate $checklistTemplate): RedirectResponse
    {
        $data = $this->validateTemplate($request);

        $checklistTemplate->update([
            'name' => $data['name'],
            'purpose' => $data['purpose'],
            'description' => $data['description'] ?? null,
            'is_active' => $data['is_active'] ?? true,
        ]);

        $this->syncItems($checklistTemplate, $data['items'] ?? []);

        return back()->with('success', 'Sablon módosítva.');
    }

    public function destroy(ChecklistTemplate $checklistTemplate): RedirectResponse
    {
        $name = $checklistTemplate->name;
        $checklistTemplate->delete();

        return back()->with('success', "„{$name}” sablon törölve.");
    }

    /**
     * @return array<string, mixed>
     */
    private function validateTemplate(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'purpose' => ['required', Rule::in(array_keys(Qa::PURPOSES))],
            'description' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['boolean'],
            'items' => ['nullable', 'array'],
            'items.*' => ['string', 'max:500'],
        ], [
            'name.required' => 'Adja meg a sablon nevét.',
        ]);
    }

    /**
     * A sablon tételeinek teljes cseréje (a régiek törlése, majd sorrendben felvétel).
     *
     * @param  array<int, string>  $items
     */
    private function syncItems(ChecklistTemplate $template, array $items): void
    {
        $template->items()->delete();

        $order = 0;
        foreach ($items as $text) {
            $text = trim((string) $text);
            if ($text === '') {
                continue;
            }
            $template->items()->create(['sort_order' => $order++, 'text' => $text]);
        }
    }
}
