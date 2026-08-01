<?php

namespace App\Http\Controllers;

use App\Models\DailyReport;
use App\Models\Document;
use App\Models\Project;
use App\Models\Quote;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Az ügyfélportálra kikerülő tartalom kijelölése (belső oldal).
 *
 * Egy helyen dől el, mit lát a megrendelő: a projekt adatlapjának
 * „Ügyfélportál" fülén. Minden kapcsoló alapból ki van kapcsolva — a
 * megosztás mindig tudatos döntés.
 */
class ClientSharingController extends Controller
{
    /**
     * A projekt és a hozzá tartozó dokumentumok / napi jelentések megosztása.
     */
    public function project(Request $request, Project $project): RedirectResponse
    {
        $data = $request->validate([
            'client_visible' => ['required', 'boolean'],
            'client_summary' => ['nullable', 'string', 'max:4000'],
            'documents' => ['array'],
            'documents.*' => ['integer'],
            'reports' => ['array'],
            'reports.*' => ['integer'],
        ]);

        $wasVisible = $project->client_visible;
        $documentIds = $data['documents'] ?? [];
        $reportIds = $data['reports'] ?? [];

        DB::transaction(function () use ($project, $data, $documentIds, $reportIds, $request) {
            $project->update([
                'client_visible' => $data['client_visible'],
                'client_summary' => $data['client_summary'] ?? null,
            ]);

            // Csak a felhasználó által látható dokumentumokat írjuk át: amit a
            // mappa-ACL elrejt előle, azt a megosztásból sem veheti ki.
            $this->syncFlags(
                Document::query(),
                $project->documents()->visibleTo($request->user())->pluck('id')->all(),
                $documentIds,
            );

            $this->syncFlags(
                DailyReport::query(),
                $project->dailyReports()->pluck('id')->all(),
                $reportIds,
            );
        });

        if ($project->client_visible !== $wasVisible) {
            $project->logActivity(
                'ugyfelportal',
                $project->client_visible
                    ? 'A projekt megosztva a megrendelővel az ügyfélportálon.'
                    : 'A projekt megosztása visszavonva az ügyfélportálon.',
            );
        }

        return back()->with('success', $project->client_visible
            ? 'Az ügyfélportál beállításai mentve — a megrendelő látja a projektet.'
            : 'Az ügyfélportál beállításai mentve — a projekt nem látszik a megrendelőnek.');
    }

    /**
     * A `client_visible` jelző átírása egy elemkörön belül: ami a kérésben
     * szerepel, az megosztott lesz, a kör többi eleme pedig nem.
     *
     * @param  \Illuminate\Database\Eloquent\Builder<*>  $query
     * @param  array<int, int>  $scopeIds  a képernyőn szereplő (átírható) elemek
     * @param  array<int, int>  $selected  amit a felhasználó bejelölt
     */
    private function syncFlags($query, array $scopeIds, array $selected): void
    {
        $share = array_values(array_intersect($scopeIds, $selected));
        $unshare = array_values(array_diff($scopeIds, $share));

        if ($share !== []) {
            (clone $query)->whereIn('id', $share)->update(['client_visible' => true]);
        }

        if ($unshare !== []) {
            (clone $query)->whereIn('id', $unshare)->update(['client_visible' => false]);
        }
    }

    /**
     * Árajánlat megosztása: melyik projekthez tartozik, és kimehet-e.
     *
     * A projekt-hozzárendelés adja a jogosultsági láncot: az ajánlatot az a
     * megrendelő látja, akié a projekt.
     */
    public function quote(Request $request, Quote $quote): RedirectResponse
    {
        $data = $request->validate([
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'client_visible' => ['required', 'boolean'],
        ]);

        $project = $data['project_id'] ? Project::find($data['project_id']) : null;

        // Projekt nélkül nincs kihez kötni az ajánlatot — a portál a projekten
        // keresztül talál rá.
        if ($data['client_visible'] && ! $project) {
            return back()->with('error', 'Az ajánlat megosztásához előbb válasszon projektet.');
        }

        $quote->update([
            'project_id' => $project?->id,
            // A megrendelőt a projekttől örökli, hogy a CRM-ben is összeálljon a kép.
            'partner_id' => $project?->client_id ?? $quote->partner_id,
            'client_visible' => $data['client_visible'],
        ]);

        return back()->with('success', $quote->client_visible
            ? 'Az árajánlat megjelenik az ügyfélportálon.'
            : 'Az árajánlat megosztása visszavonva.');
    }
}
