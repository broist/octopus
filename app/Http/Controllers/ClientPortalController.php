<?php

namespace App\Http\Controllers;

use App\Models\DailyReport;
use App\Models\DailyReportPhoto;
use App\Models\Document;
use App\Models\DocumentVersion;
use App\Models\Partner;
use App\Models\Project;
use App\Models\ProjectPhase;
use App\Models\Quote;
use App\Notifications\ClientQuoteResponse;
use App\Services\QuotePdf;
use App\Support\PhaseTree;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/**
 * Ügyfélportál (külső, `is_external` fiókok felülete).
 *
 * Az egész felület egyetlen elven áll: a belépett fiók partneréhez (megrendelő)
 * kötött, és KIFEJEZETTEN megosztott tartalmat mutatja. Nincs jogosultság-
 * finomhangolás, nincs modulmenü — minden lekérdezés a partnerből indul, és
 * minden megosztható elem `client_visible` kapcsolón múlik (alapból hamis).
 *
 * Amit az ügyfél lát: projektjeinek készültsége és ütemterve, a neki megosztott
 * dokumentumok, a helyszíni haladás fotókkal, valamint az árajánlatai — ez
 * utóbbiakra online is visszajelezhet.
 *
 * Amit soha nem lát: költség, árrés, alvállalkozói adat, belső jegyzet — ezek
 * a mezők egyszerűen nem kerülnek bele a válaszba.
 */
class ClientPortalController extends Controller
{
    public function index(Request $request): Response
    {
        // Félkész fiók (nincs partner): magyarázó képernyő a hibaoldal helyett.
        if ($request->user()->partner === null) {
            return Inertia::render('Portal/NoAccess');
        }

        $partner = $this->partner($request);

        $projects = Project::query()
            ->sharedWithClient($partner->id)
            ->with('projectManager:id,name,email,phone,job_title')
            ->withCount([
                'phases' => fn ($q) => $q->where('is_group', false),
                'subprojectPhases' => fn ($q) => $q->where('is_group', false),
                // Csak a ténylegesen letölthető (verzióval bíró) fájlokat számoljuk,
                // hogy a jelvény és a Dokumentumok fül ugyanazt mutassa.
                'documents as shared_documents_count' => fn ($q) => $q->where('client_visible', true)
                    ->whereHas('currentVersion'),
                'dailyReports as shared_reports_count' => fn ($q) => $q->where('client_visible', true),
                'quotes as open_quotes_count' => fn ($q) => $q->where('client_visible', true)
                    ->whereNull('client_response'),
            ])
            ->withAvg(['phases as phases_progress' => fn ($q) => $q->where('is_group', false)], 'progress')
            ->withAvg(['subprojectPhases as sub_phases_progress' => fn ($q) => $q->where('is_group', false)], 'progress')
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (Project $p) => [
                'id' => $p->id,
                'code' => $p->code,
                'name' => $p->name,
                'status' => $p->status,
                'status_label' => Project::STATUSES[$p->status] ?? $p->status,
                'progress' => $this->progressOf($p),
                'starts_on' => $p->starts_on?->toDateString(),
                'ends_on' => $p->ends_on?->toDateString(),
                'location' => $this->location($p),
                'manager' => $this->manager($p),
                'documents_count' => (int) $p->shared_documents_count,
                'reports_count' => (int) $p->shared_reports_count,
                'open_quotes_count' => (int) $p->open_quotes_count,
                'updated_at' => $p->updated_at->toIso8601String(),
            ])
            ->values();

        return Inertia::render('Portal/Index', [
            'partner' => ['id' => $partner->id, 'name' => $partner->name],
            'projects' => $projects,
        ]);
    }

    public function project(Request $request, Project $project): Response
    {
        $partner = $this->partner($request);
        $this->assertShared($project, $partner);

        $project->load([
            'projectManager:id,name,email,phone,job_title',
            'phases',
            'documents' => fn ($q) => $q->where('client_visible', true)->with('currentVersion'),
            'dailyReports' => fn ($q) => $q->where('client_visible', true)->with('photos'),
            'quotes' => fn ($q) => $q->where('client_visible', true)->orderByDesc('updated_at'),
        ]);

        return Inertia::render('Portal/Project', [
            'partner' => ['id' => $partner->id, 'name' => $partner->name],
            'project' => [
                'id' => $project->id,
                'code' => $project->code,
                'name' => $project->name,
                'status' => $project->status,
                'status_label' => Project::STATUSES[$project->status] ?? $project->status,
                'progress' => $project->progress(),
                'starts_on' => $project->starts_on?->toDateString(),
                'ends_on' => $project->ends_on?->toDateString(),
                'location' => $this->location($project),
                // Az ügyfélnek szánt összefoglaló — a belső leírás nem kerül ki.
                'summary' => $project->client_summary,
                'manager' => $this->manager($project),
            ],
            'phases' => $this->phasePayload($project),
            'documents' => $project->documents
                ->filter(fn (Document $d) => $d->currentVersion !== null)
                ->map(fn (Document $d) => [
                    'id' => $d->id,
                    'title' => $d->title,
                    'category' => $d->category,
                    'category_label' => Document::CATEGORIES[$d->category] ?? $d->category,
                    'filename' => $d->currentVersion->original_filename,
                    'size_bytes' => (int) $d->currentVersion->size_bytes,
                    'previewable' => $d->currentVersion->isPreviewable(),
                    'version_id' => $d->currentVersion->id,
                    'updated_at' => $d->updated_at->toIso8601String(),
                ])
                ->values(),
            'reports' => $project->dailyReports->map(fn (DailyReport $r) => [
                'id' => $r->id,
                'report_date' => $r->report_date->toDateString(),
                // Csak az elvégzett munka megy ki: az akadályok, a létszám és a
                // gép-/anyagmozgás belső információ.
                'work_done' => $r->work_done,
                'weather' => $r->weather,
                'photos' => $r->photos->map(fn (DailyReportPhoto $p) => [
                    'id' => $p->id,
                    'url' => route('ugyfel.foto', $p->id),
                    'filename' => $p->original_filename,
                ])->values(),
            ])->values(),
            'quotes' => $project->quotes->map(fn (Quote $q) => $this->quotePayload($q))->values(),
            'responses' => Quote::CLIENT_RESPONSES,
        ]);
    }

    /**
     * Saját fiók: jelszóváltás (a Fortify /user/password végpontjára megy).
     */
    public function account(Request $request): Response
    {
        $partner = $request->user()->partner;

        return Inertia::render('Portal/Account', [
            'partner' => $partner ? ['id' => $partner->id, 'name' => $partner->name] : null,
            'status' => session('status'),
        ]);
    }

    /* ------------------------------------------------------------------ */
    /* Fájlkiszolgálás                                                     */
    /* ------------------------------------------------------------------ */

    public function download(Request $request, DocumentVersion $version): SymfonyResponse
    {
        $this->assertDocumentShared($request, $version);

        return $this->serve($version->disk, $version->file_path, $version->original_filename, $version->mime_type, false);
    }

    public function preview(Request $request, DocumentVersion $version): SymfonyResponse
    {
        $this->assertDocumentShared($request, $version);
        abort_unless($version->isPreviewable(), 404);

        return $this->serve($version->disk, $version->file_path, $version->original_filename, $version->mime_type, true);
    }

    public function photo(Request $request, DailyReportPhoto $photo): SymfonyResponse
    {
        $partner = $this->partner($request);
        $report = $photo->report;

        abort_unless($report && $report->client_visible, 404);
        $this->assertShared($report->project, $partner);

        return $this->serve($photo->disk, $photo->file_path, $photo->original_filename, $photo->mime_type, true);
    }

    /**
     * Az árajánlat ügyfél-PDF-je, böngészőben megnyitva.
     */
    public function quotePdf(Request $request, Quote $quote): SymfonyResponse
    {
        $this->assertQuoteShared($request, $quote);

        $pdf = QuotePdf::render($quote->data ?? [], $quote->data['pdfMode'] ?? 'summary', 'print');
        $name = Str::slug(($quote->quote_number ?: 'arajanlat').'-'.$quote->project_name) ?: 'arajanlat';

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$name.'.pdf"',
        ]);
    }

    /* ------------------------------------------------------------------ */
    /* Ajánlat elfogadása / elutasítása                                    */
    /* ------------------------------------------------------------------ */

    public function respondToQuote(Request $request, Quote $quote): RedirectResponse
    {
        $this->assertQuoteShared($request, $quote);

        // Csak véglegesített (jóváhagyott) ajánlatra lehet nyilatkozni, és csak
        // egyszer — az újranyitást új verzió kiadása jelenti.
        abort_unless($quote->status === 'jóváhagyva', 403, 'Ez az árajánlat még nem végleges.');
        abort_unless($quote->client_response === null, 403, 'Erre az árajánlatra már válaszolt.');

        $data = $request->validate([
            'response' => ['required', 'in:'.implode(',', array_keys(Quote::CLIENT_RESPONSES))],
            'note' => ['nullable', 'string', 'max:2000'],
        ], [
            'response.required' => 'Válassza ki, hogy elfogadja vagy elutasítja az ajánlatot.',
            'response.in' => 'Érvénytelen válasz.',
        ]);

        $quote->update([
            'client_response' => $data['response'],
            'client_response_note' => $data['note'] ?? null,
            'client_responded_at' => now(),
        ]);

        $this->notifyQuoteResponse($request, $quote);

        // Kifejezetten a projekt oldalára térünk vissza (a `back()` a PDF-
        // megnyitás után rossz helyre vinne).
        return redirect()->route('ugyfel.projekt', $quote->project_id)->with(
            'success',
            $data['response'] === 'elfogadva'
                ? 'Köszönjük! Az ajánlat elfogadását rögzítettük, kollégánk hamarosan keresi Önt.'
                : 'A visszajelzését rögzítettük. Köszönjük, hogy időt szánt rá.',
        );
    }

    /* ------------------------------------------------------------------ */
    /* Belső segédek                                                       */
    /* ------------------------------------------------------------------ */

    private function partner(Request $request): Partner
    {
        $partner = $request->user()->partner;

        // A middleware már ellenőrizte; ez csak a versenyhelyzet (közben törölt
        // partner) elleni háló.
        abort_unless($partner !== null, 403, 'Ehhez a fiókhoz nincs megrendelő rendelve.');

        return $partner;
    }

    /**
     * A projekt tényleg ezé a megrendelőé, és tényleg meg van osztva vele?
     */
    private function assertShared(?Project $project, Partner $partner): void
    {
        abort_unless(
            $project !== null && $project->client_id === $partner->id && $project->client_visible,
            404,
        );
    }

    private function assertDocumentShared(Request $request, DocumentVersion $version): void
    {
        $partner = $this->partner($request);
        $document = $version->document;

        abort_unless($document && $document->client_visible, 404);
        $this->assertShared($document->project, $partner);
    }

    private function assertQuoteShared(Request $request, Quote $quote): void
    {
        $partner = $this->partner($request);

        abort_unless($quote->client_visible, 404);
        $this->assertShared($quote->project, $partner);
    }

    /**
     * @return array<string, mixed>
     */
    private function quotePayload(Quote $quote): array
    {
        return [
            'id' => $quote->id,
            'quote_number' => $quote->quote_number,
            'title' => $quote->project_name,
            'net_offer' => (int) $quote->net_offer,
            'gross_offer' => (int) $quote->gross_offer,
            'version' => (int) $quote->version,
            'is_final' => $quote->status === 'jóváhagyva',
            'response' => $quote->client_response,
            'response_label' => Quote::CLIENT_RESPONSES[$quote->client_response] ?? null,
            'response_note' => $quote->client_response_note,
            'responded_at' => $quote->client_responded_at?->toIso8601String(),
            'valid_until' => $quote->data['validUntil'] ?? null,
            'updated_at' => $quote->updated_at->toIso8601String(),
        ];
    }

    /**
     * Az ütemterv az ügyfélnek: a belső jegyzetek, függőségek és erőforrások
     * nélkül — csak a munkastruktúra, a dátumok és a készültség.
     *
     * CSAK AZ AKTÍV (beütemezett) sorok mennek ki: az ütemterv-sablon több száz
     * sorából az ügyfelet kizárólag az érdekli, amit már ténylegesen betettünk a
     * naptárba. Az „aktív” ismérve — a belső Gantt-tal azonosan — hogy a sornak
     * van kezdése ÉS határideje; a még ki nem töltött sorok fel sem kerülnek a
     * portálra. Az összegző sorok dátuma a gyerekekből gördül, így egy
     * beütemezett sor teljes szülő-útvonala megmarad, a fa nem szakad szét.
     *
     * @return \Illuminate\Support\Collection<int, array<string, mixed>>
     */
    private function phasePayload(Project $project)
    {
        $rollup = PhaseTree::rollup($project->phases);
        $today = today()->toDateString();

        return PhaseTree::flatten($project->phases)
            ->values()
            ->map(function (ProjectPhase $ph, int $i) use ($rollup, $today) {
                $roll = $rollup[$ph->id] ?? null;

                $startsOn = $ph->is_group ? ($roll['starts_on'] ?? null) : $ph->starts_on?->toDateString();
                $dueOn = $ph->is_group ? ($roll['due_on'] ?? null) : $ph->due_on?->toDateString();
                $progress = $ph->is_group ? ($roll['progress'] ?? 0) : $ph->progress;

                return [
                    'id' => $ph->id,
                    'seq' => $i + 1,
                    'level' => $ph->level,
                    'wbs' => $ph->wbs,
                    'name' => $ph->name,
                    'is_group' => $ph->is_group,
                    'is_milestone' => $ph->is_milestone,
                    'starts_on' => $startsOn,
                    'due_on' => $dueOn,
                    'progress' => $progress,
                    'is_overdue' => $dueOn !== null && $dueOn < $today && $progress < 100,
                ];
            })
            ->filter(fn (array $row) => $row['starts_on'] !== null && $row['due_on'] !== null)
            ->values();
    }

    private function progressOf(Project $project): int
    {
        if ($project->phases_count > 0) {
            return (int) round((float) $project->phases_progress);
        }

        return $project->subproject_phases_count > 0
            ? (int) round((float) $project->sub_phases_progress)
            : ($project->status === 'lezart' ? 100 : 0);
    }

    private function location(Project $project): ?string
    {
        $parts = array_filter([$project->location_city, $project->location_address]);

        return $parts ? implode(', ', $parts) : null;
    }

    /**
     * A kapcsolattartó projektvezető — az ügyfél egyetlen belépési pontja.
     *
     * @return array<string, string|null>|null
     */
    private function manager(Project $project): ?array
    {
        $pm = $project->projectManager;

        return $pm ? [
            'name' => $pm->name,
            'email' => $pm->email,
            'phone' => $pm->phone,
            'job_title' => $pm->job_title,
        ] : null;
    }

    /**
     * Értesítés a projektvezetőnek (és az ajánlat készítőjének) a válaszról.
     */
    private function notifyQuoteResponse(Request $request, Quote $quote): void
    {
        $recipients = collect([$quote->project?->projectManager, $quote->creator])
            ->filter()
            ->unique('id');

        foreach ($recipients as $user) {
            $user->notify(new ClientQuoteResponse($quote, $request->user()->name));
        }
    }

    private function serve(string $disk, string $path, ?string $filename, ?string $mime, bool $inline): SymfonyResponse
    {
        $storage = Storage::disk($disk);
        abort_unless($storage->exists($path), 404, 'A fájl nem található.');

        $name = $filename ?: 'fajl';

        // S3-on tárolt fájl: rövid életű, aláírt URL (mint a belső Fájlkezelőben).
        if ($disk === 'plans') {
            return redirect()->away($storage->temporaryUrl($path, now()->addMinutes(10), [
                'ResponseContentDisposition' => ($inline ? 'inline' : 'attachment').'; filename="'.rawurlencode($name).'"',
                'ResponseContentType' => $mime ?? 'application/octet-stream',
            ]));
        }

        if ($inline) {
            return $storage->response($path, $name, [
                'Content-Type' => $mime ?? 'application/octet-stream',
                'X-Content-Type-Options' => 'nosniff',
            ]);
        }

        return $storage->download($path, $name);
    }
}
