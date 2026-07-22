<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\Folder;
use App\Models\Quote;
use App\Services\QuoteBootstrap;
use App\Services\QuoteCalculator;
use App\Services\QuotePdf;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Ajánlatkérő (árajánlat-készítő) — a portolt AcuWall app az Octopus stacken.
 *
 * A lista, a szerkesztő (Kalkuláció / Feltételek / Fizetési ütem / Ügyfél nézet
 * fülekkel) és a branded PDF a közös partner-, dokumentum- és jogosultsági
 * rendszerre épül. A PDF az Octopus Fájlkezelőjébe menthető, tetszőleges
 * mappába.
 */
class QuoteController extends Controller
{
    private const TABS = ['kalkulacio', 'feltetelek', 'fizetes', 'ugyfel'];

    public function index(Request $request): Response
    {
        $search = $request->string('search')->toString();

        $quotes = Quote::query()
            ->when($search !== '', function ($q) use ($search) {
                $q->where(function ($q) use ($search) {
                    $q->where('project_name', 'ilike', "%{$search}%")
                        ->orWhere('client_name', 'ilike', "%{$search}%")
                        ->orWhere('quote_number', 'ilike', "%{$search}%");
                });
            })
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (Quote $q) => [
                'id' => $q->id,
                'quote_number' => $q->quote_number,
                'project_name' => $q->project_name,
                'client_name' => $q->client_name,
                'location' => $q->location,
                'status' => $q->status,
                'version' => $q->version,
                'net_offer' => (int) $q->net_offer,
                'gross_offer' => (int) $q->gross_offer,
                'updated_at' => $q->updated_at->toIso8601String(),
            ]);

        return Inertia::render('Quotes/Index', [
            'quotes' => $quotes,
            'filters' => ['search' => $search],
            'meta' => QuoteBootstrap::meta(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $template = $request->string('template')->toString();
        $data = $template === 'sample'
            ? QuoteBootstrap::sampleProject()
            : QuoteBootstrap::blankTemplate();

        $data['id'] = '';
        $data['status'] = 'piszkozat';
        $data['version'] = 1;
        $data['approvedAt'] = null;
        $data['approvedBy'] = '';
        $data['quoteNumber'] = $data['quoteNumber'] ?: $this->nextQuoteNumber();
        $data['quoteDate'] = $data['quoteDate'] ?? now()->toDateString();
        $data['preparedBy'] = $data['preparedBy'] ?: $request->user()->email;

        if ($template !== 'sample') {
            $data['projectName'] = 'Új árajánlat';
            $data['clientName'] = '';
        }

        $quote = new Quote(['data' => $data, 'created_by' => $request->user()->id]);
        $quote->syncFromData();
        $quote->save();

        return redirect()
            ->route('ajanlatok.show', $quote)
            ->with('success', 'Új árajánlat létrehozva – töltse fel az adatokkal.');
    }

    /**
     * Almenü-átirányítás: a legutóbb szerkesztett ajánlat megnyitása a kért fülön.
     */
    public function tab(Request $request, string $tab): RedirectResponse
    {
        $tab = in_array($tab, self::TABS, true) ? $tab : 'kalkulacio';
        $quote = Quote::orderByDesc('updated_at')->first();

        if (! $quote) {
            return redirect()
                ->route('ajanlatok.index')
                ->with('info', 'Még nincs árajánlat – hozzon létre egyet a megnyitáshoz.');
        }

        return redirect()->route('ajanlatok.show', ['quote' => $quote->id, 'tab' => $tab]);
    }

    public function show(Request $request, Quote $quote): Response
    {
        $user = $request->user();
        $tab = $request->string('tab')->toString();
        $tab = in_array($tab, self::TABS, true) ? $tab : 'kalkulacio';

        return Inertia::render('Quotes/Editor', [
            'quote' => [
                'id' => $quote->id,
                'status' => $quote->status,
                'version' => $quote->version,
                'updated_at' => $quote->updated_at->toIso8601String(),
                'approved_at' => $quote->approved_at?->toIso8601String(),
                'data' => $quote->data,
            ],
            'totals' => QuoteCalculator::project($quote->data ?? []),
            'tab' => $tab,
            'folders' => $this->folderOptions($user),
            'can' => [
                'edit' => $user->can('ajanlatok.edit'),
                'delete' => $user->can('ajanlatok.delete'),
            ],
        ]);
    }

    public function update(Request $request, Quote $quote): RedirectResponse
    {
        $data = $request->input('data');
        abort_unless(is_array($data), 422);

        // Jóváhagyott/verziózott mezőket a szerkesztés nem írhat felül.
        $data['status'] = $quote->status;
        $data['version'] = $quote->version;

        $quote->data = $data;
        $quote->syncFromData();
        $quote->save();

        return back()->with('success', 'Az árajánlat mentve.');
    }

    public function approve(Request $request, Quote $quote): RedirectResponse
    {
        $data = $request->input('data');
        if (is_array($data)) {
            $quote->data = array_merge($data, [
                'status' => $quote->status,
                'version' => $quote->version,
            ]);
        }

        // Új jóváhagyás egy már jóváhagyott ajánlaton = új verzió.
        $newVersion = $quote->approved_at ? $quote->version + 1 : $quote->version;

        $payload = $quote->data;
        $payload['status'] = 'jóváhagyva';
        $payload['version'] = $newVersion;
        $payload['approvedAt'] = now()->toIso8601String();
        $payload['approvedBy'] = $request->user()->email;

        $quote->data = $payload;
        $quote->approved_at = now();
        $quote->approved_by = $request->user()->email;
        $quote->syncFromData();
        $quote->save();

        $quote->versions()->create([
            'version' => $quote->version,
            'data' => $quote->data,
            'approved_at' => now(),
            'approved_by' => $request->user()->email,
        ]);

        return back()->with('success', "Az árajánlat jóváhagyva (v{$quote->version}).");
    }

    public function destroy(Quote $quote): RedirectResponse
    {
        $quote->delete();

        return redirect()->route('ajanlatok.index')->with('success', 'Az árajánlat törölve.');
    }

    /**
     * Ügyfél-PDF generálása és mentése az Octopus Fájlkezelőjébe (választott mappa).
     */
    public function savePdf(Request $request, Quote $quote): RedirectResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:190'],
            'folder_id' => ['nullable', 'integer', 'exists:folders,id'],
            'mode' => ['nullable', 'in:summary,detailed'],
            'theme' => ['nullable', 'in:print,brand'],
        ], [
            'title.required' => 'Adjon meg egy fájlnevet.',
        ]);

        $folder = $validated['folder_id'] ? Folder::find($validated['folder_id']) : null;
        abort_unless(Folder::canCreateIn($user, $folder), 403, 'Ebbe a mappába nincs jogosultsága menteni.');

        // A friss, képernyőn látott állapotból dolgozunk, ha a kliens elküldte.
        $source = is_array($request->input('data')) ? $request->input('data') : ($quote->data ?? []);

        $pdf = QuotePdf::render(
            $source,
            $validated['mode'] ?? ($source['pdfMode'] ?? 'summary'),
            $validated['theme'] ?? 'print',
        );

        $filename = Str::of($validated['title'])->limit(180, '')->trim().'.pdf';

        DB::transaction(function () use ($quote, $user, $folder, $validated, $pdf, $filename) {
            $disk = Document::diskFor('egyeb', strlen($pdf));

            $document = Document::create([
                'title' => $validated['title'],
                'category' => 'egyeb',
                'folder_id' => $folder?->id,
                'partner_id' => $quote->partner_id,
                'project_id' => $quote->project_id,
                'description' => "Árajánlat PDF: {$quote->quote_number}",
                'uploaded_by' => $user->id,
            ]);

            $path = "doc-{$document->id}/".Str::uuid()->toString().'.pdf';
            Storage::disk($disk)->put($path, $pdf);

            $document->versions()->create([
                'version_number' => 1,
                'is_current' => true,
                'disk' => $disk,
                'file_path' => $path,
                'original_filename' => (string) $filename,
                'mime_type' => 'application/pdf',
                'size_bytes' => strlen($pdf),
                'uploaded_by' => $user->id,
            ]);
        });

        $where = $folder ? "a(z) „{$folder->name}” mappába" : 'a Fájlkezelő gyökerébe';

        return back()->with('success', "Az ügyfél-PDF elmentve {$where}.");
    }

    /**
     * PDF közvetlen letöltése (mentés nélkül) – gyors előnézethez.
     */
    public function downloadPdf(Request $request, Quote $quote)
    {
        $mode = $request->string('mode')->toString() ?: ($quote->data['pdfMode'] ?? 'summary');
        $theme = $request->string('theme')->toString() ?: 'print';
        $pdf = QuotePdf::render($quote->data ?? [], $mode, $theme);

        $name = Str::slug(($quote->quote_number ?: 'acuwall').'-'.$quote->project_name) ?: 'arajanlat';

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$name.'.pdf"',
        ]);
    }

    /* ------------------------------------------------------------------ */

    private function nextQuoteNumber(): string
    {
        $year = now()->year;
        $count = Quote::withTrashed()->whereYear('created_at', $year)->count();

        do {
            $number = sprintf('AW-%d-%03d', $year, ++$count);
        } while (Quote::withTrashed()->where('quote_number', $number)->exists());

        return $number;
    }

    /**
     * A felhasználó által elérhető mappák (ahová menthet) – lapos, behúzott lista.
     *
     * @return array<int, array{id:int,name:string,depth:int}>
     */
    private function folderOptions(\App\Models\User $user): array
    {
        $visibleIds = Folder::visibleIdsFor($user);
        $folders = Folder::query()
            ->whereIn('id', $visibleIds)
            ->orderBy('name')
            ->get(['id', 'name', 'parent_id'])
            ->keyBy('id');

        $depth = function ($id) use (&$depth, $folders) {
            $f = $folders->get($id);

            return ($f && $f->parent_id && $folders->has($f->parent_id)) ? $depth($f->parent_id) + 1 : 0;
        };

        return $folders
            ->filter(fn ($f) => Folder::canCreateIn($user, $f))
            ->map(fn ($f) => ['id' => $f->id, 'name' => $f->name, 'depth' => $depth($f->id)])
            ->sortBy('name')
            ->values()
            ->all();
    }
}
