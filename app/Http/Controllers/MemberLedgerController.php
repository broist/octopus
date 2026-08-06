<?php

namespace App\Http\Controllers;

use App\Models\CompanyMember;
use App\Models\Folder;
use App\Models\MemberPayment;
use App\Models\RecurringSharedCost;
use App\Models\SharedCost;
use App\Models\SharedCostShare;
use App\Models\User;
use App\Services\LedgerIngestor;
use App\Support\MemberLedger;
use App\Support\Settings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Tagi kölcsön és közös (céges) költségek — a Pénzügy modul almenüje.
 *
 * Két oldala van egy dolognak:
 *  - KÖTELEZETTSÉG: a közös költségek (könyvelői számla, előfizetések, egyéb)
 *    a tagok között százalékos arányban felosztva;
 *  - BEFIZETÉS: amit a tag ténylegesen átutalt a céges bankszámlára tagi
 *    kölcsönként.
 *
 * A kettő különbsége a tag EGYENLEGE: negatív = még be kell fizetnie, pozitív =
 * többet adott be, mint a rá eső rész (a cég tartozik neki).
 *
 * A könyvelői számla sorát nem kézzel kell felvenni: a Fájlkezelő figyelt
 * mappájába feltöltött PDF-ből a LedgerIngestor automatikusan létrehozza.
 */
class MemberLedgerController extends Controller
{
    public function __construct(private LedgerIngestor $ingestor) {}

    /* ====================================================================== */
    /* Nézetek */
    /* ====================================================================== */

    public function index(Request $request): Response
    {
        $year = $request->integer('year');
        $onlyOpen = $request->boolean('open');

        $members = CompanyMember::query()
            ->with('user:id,name')
            ->orderBy('sort_order')->orderBy('id')
            ->get();

        // Egyenleg: a rá eső részek és a befizetései teljes időszakra.
        $owedBy = SharedCostShare::query()
            ->whereHas('cost')
            ->selectRaw('company_member_id, sum(amount_huf) as s')
            ->groupBy('company_member_id')
            ->pluck('s', 'company_member_id');

        $paidBy = MemberPayment::query()
            ->selectRaw('company_member_id, sum(amount_huf) as s')
            ->groupBy('company_member_id')
            ->pluck('s', 'company_member_id');

        // Költségenkénti, tagonkénti rendezettség.
        $settledByShare = MemberPayment::query()
            ->whereNotNull('shared_cost_id')
            ->selectRaw('shared_cost_id, company_member_id, sum(amount_huf) as s')
            ->groupBy('shared_cost_id', 'company_member_id')
            ->get()
            ->mapWithKeys(fn ($r) => ["{$r->shared_cost_id}-{$r->company_member_id}" => (float) $r->s]);

        $costs = SharedCost::query()
            ->when($year > 0, fn ($q) => $q->whereYear('due_on', $year))
            ->with(['shares.member:id,name', 'document:id,title'])
            ->orderByDesc('due_on')->orderByDesc('id')
            ->get();

        $rows = $costs->map(function (SharedCost $cost) use ($settledByShare) {
            $shares = $cost->shares->map(function (SharedCostShare $share) use ($cost, $settledByShare) {
                $paid = $settledByShare["{$cost->id}-{$share->company_member_id}"] ?? 0.0;

                return [
                    'id' => $share->id,
                    'member_id' => $share->company_member_id,
                    'member_name' => $share->member?->name ?? '—',
                    'share_percent' => (float) $share->share_percent,
                    'amount' => (float) $share->amount,
                    'amount_huf' => (float) $share->amount_huf,
                    'paid_huf' => $paid,
                    'outstanding_huf' => round(max(0, (float) $share->amount_huf - $paid), 2),
                    'settled' => $paid + 0.5 >= (float) $share->amount_huf,
                ];
            })->values();

            $outstanding = round($shares->sum('outstanding_huf'), 2);

            return [
                'id' => $cost->id,
                'title' => $cost->title,
                'category' => $cost->category,
                'category_label' => MemberLedger::CATEGORIES[$cost->category] ?? $cost->category,
                'period_month' => $cost->period_month?->toDateString(),
                'period_label' => $cost->periodLabel(),
                'due_on' => $cost->due_on->toDateString(),
                'issued_on' => $cost->issued_on?->toDateString(),
                'overdue' => $outstanding > 0 && $cost->due_on->isPast(),
                'currency' => $cost->currency,
                'amount' => (float) $cost->amount,
                'net_amount' => $cost->net_amount !== null ? (float) $cost->net_amount : null,
                'vat_amount' => $cost->vat_amount !== null ? (float) $cost->vat_amount : null,
                'exchange_rate' => (float) $cost->exchange_rate,
                'amount_huf' => (float) $cost->amount_huf,
                'supplier_name' => $cost->supplier_name,
                'invoice_number' => $cost->invoice_number,
                'source' => $cost->source,
                'source_label' => MemberLedger::SOURCES[$cost->source] ?? $cost->source,
                'needs_review' => $cost->needs_review,
                'parse_note' => $cost->parse_note,
                'note' => $cost->note,
                'document_id' => $cost->document_id,
                'document_url' => $cost->document_id ? route('documents.show', $cost->document_id) : null,
                'outstanding_huf' => $outstanding,
                'settled' => $outstanding <= 0.5,
                'shares' => $shares,
            ];
        });

        if ($onlyOpen) {
            $rows = $rows->where('settled', false)->values();
        }

        return Inertia::render('Finance/Ledger', [
            'members' => $members->map(function (CompanyMember $m) use ($owedBy, $paidBy) {
                $owed = (float) ($owedBy[$m->id] ?? 0);
                $paid = (float) ($paidBy[$m->id] ?? 0);

                return [
                    'id' => $m->id,
                    'name' => $m->name,
                    'user_name' => $m->user?->name,
                    'default_share' => (float) $m->default_share,
                    'is_active' => $m->is_active,
                    'owed_huf' => round($owed, 2),
                    'paid_huf' => round($paid, 2),
                    'balance_huf' => round($paid - $owed, 2),
                ];
            })->values(),
            'costs' => $rows->values(),
            'payments' => MemberPayment::query()
                ->with(['member:id,name', 'cost:id,title'])
                ->orderByDesc('paid_on')->orderByDesc('id')
                ->limit(100)
                ->get()
                ->map(fn (MemberPayment $p) => [
                    'id' => $p->id,
                    'member_id' => $p->company_member_id,
                    'member_name' => $p->member?->name ?? '—',
                    'paid_on' => $p->paid_on->toDateString(),
                    'currency' => $p->currency,
                    'amount' => (float) $p->amount,
                    'amount_huf' => (float) $p->amount_huf,
                    'exchange_rate' => (float) $p->exchange_rate,
                    'note' => $p->note,
                    'cost_id' => $p->shared_cost_id,
                    'cost_title' => $p->cost?->title,
                ])->values(),
            'filters' => ['year' => $year ?: null, 'open' => $onlyOpen],
            'years' => $this->availableYears(),
            'categories' => MemberLedger::CATEGORIES,
            'currencies' => MemberLedger::CURRENCIES,
            'symbols' => MemberLedger::CURRENCY_SYMBOLS,
            'watch' => $this->watchInfo(),
            'can' => [
                'edit' => $request->user()->can('finance.edit'),
                'delete' => $request->user()->can('finance.delete'),
            ],
        ]);
    }

    public function settings(Request $request): Response
    {
        $user = $request->user();
        $folder = $this->ingestor->watchFolder();

        return Inertia::render('Finance/LedgerSettings', [
            'members' => CompanyMember::query()
                ->with('user:id,name')
                ->orderBy('sort_order')->orderBy('id')
                ->get()
                ->map(fn (CompanyMember $m) => [
                    'id' => $m->id,
                    'name' => $m->name,
                    'user_id' => $m->user_id,
                    'user_name' => $m->user?->name,
                    'default_share' => (float) $m->default_share,
                    'is_active' => $m->is_active,
                    'sort_order' => $m->sort_order,
                    'has_history' => $m->shares()->exists() || $m->payments()->exists(),
                ])->values(),
            'recurring' => RecurringSharedCost::query()
                ->orderBy('title')
                ->get()
                ->map(fn (RecurringSharedCost $r) => [
                    'id' => $r->id,
                    'title' => $r->title,
                    'category' => $r->category,
                    'category_label' => MemberLedger::CATEGORIES[$r->category] ?? $r->category,
                    'currency' => $r->currency,
                    'amount' => (float) $r->amount,
                    'exchange_rate' => (float) $r->exchange_rate,
                    'due_day' => $r->due_day,
                    'start_month' => $r->start_month?->toDateString(),
                    'last_period' => $r->last_period?->toDateString(),
                    'is_active' => $r->is_active,
                    'note' => $r->note,
                    'shares' => collect($r->shareMap())
                        ->map(fn ($percent, $id) => ['member_id' => $id, 'percent' => $percent])
                        ->values(),
                ])->values(),
            'users' => User::where('is_active', true)->where('is_external', false)
                ->orderBy('name')->get(['id', 'name'])
                ->map(fn ($u) => ['id' => $u->id, 'name' => $u->name]),
            'folders' => $this->folderOptions($user),
            'watch' => $this->watchInfo(),
            'defaultMembers' => MemberLedger::DEFAULT_MEMBERS,
            'defaultWatchPath' => MemberLedger::DEFAULT_WATCH_PATH,
            'categories' => MemberLedger::CATEGORIES,
            'currencies' => MemberLedger::CURRENCIES,
            'can' => [
                'edit' => $user->can('finance.edit'),
                'delete' => $user->can('finance.delete'),
            ],
        ]);
    }

    /* ====================================================================== */
    /* Közös költségek */
    /* ====================================================================== */

    public function storeCost(Request $request): RedirectResponse
    {
        $data = $this->validateCost($request);

        DB::transaction(function () use ($data, $request) {
            $cost = SharedCost::create([
                ...$this->costAttributes($data),
                'source' => 'kezi',
                'created_by' => $request->user()->id,
            ]);

            $this->ingestor->applyShares($cost, $this->shareMap($data));
        });

        return back()->with('success', 'Költség rögzítve, a felosztás elkészült.');
    }

    public function updateCost(Request $request, SharedCost $cost): RedirectResponse
    {
        $data = $this->validateCost($request);

        DB::transaction(function () use ($data, $cost) {
            $cost->update([
                ...$this->costAttributes($data),
                // A kézi mentés egyben ellenőrzésnek is számít.
                'needs_review' => false,
                'parse_note' => null,
            ]);

            $cost->refresh();
            $this->ingestor->applyShares($cost, $this->shareMap($data));
        });

        return back()->with('success', 'Költség módosítva, a felosztás újraszámolva.');
    }

    public function destroyCost(SharedCost $cost): RedirectResponse
    {
        // A hozzá kötött befizetések megmaradnak általános tagi kölcsönként.
        $cost->payments()->update(['shared_cost_id' => null]);
        $cost->delete();

        return back()->with('success', 'Költség törölve.');
    }

    /* ====================================================================== */
    /* Befizetések */
    /* ====================================================================== */

    public function storePayment(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'company_member_id' => ['required', 'exists:company_members,id'],
            'shared_cost_id' => ['nullable', 'exists:shared_costs,id'],
            'paid_on' => ['required', 'date'],
            'currency' => ['required', Rule::in(array_keys(MemberLedger::CURRENCIES))],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:999999999999'],
            'exchange_rate' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'note' => ['nullable', 'string', 'max:255'],
        ], [
            'company_member_id.required' => 'Válassza ki, ki fizetett be.',
            'amount.required' => 'Adja meg a befizetett összeget.',
            'paid_on.required' => 'Adja meg a befizetés dátumát.',
        ]);

        $rate = $data['currency'] === 'HUF' ? 1 : (float) ($data['exchange_rate'] ?? 0);
        if ($data['currency'] !== 'HUF' && $rate <= 0) {
            return back()->withErrors(['exchange_rate' => 'Devizás befizetéshez adja meg az árfolyamot.']);
        }

        MemberPayment::create([
            'company_member_id' => $data['company_member_id'],
            'shared_cost_id' => $data['shared_cost_id'] ?? null,
            'paid_on' => $data['paid_on'],
            'currency' => $data['currency'],
            'amount' => $data['amount'],
            'exchange_rate' => $rate,
            'amount_huf' => MemberLedger::toHuf((float) $data['amount'], $data['currency'], $rate),
            'note' => $data['note'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        return back()->with('success', 'Befizetés rögzítve.');
    }

    /**
     * Egy kattintás: a tagra eső, még nyitott rész befizetettként rögzítése.
     */
    public function settleShare(Request $request, SharedCostShare $share): RedirectResponse
    {
        $share->loadMissing('cost');
        $cost = $share->cost;

        abort_unless($cost !== null, 404);

        $paid = (float) MemberPayment::where('shared_cost_id', $cost->id)
            ->where('company_member_id', $share->company_member_id)
            ->sum('amount_huf');

        $outstandingHuf = round((float) $share->amount_huf - $paid, 2);

        if ($outstandingHuf <= 0) {
            return back()->with('info', 'Ez a rész már rendezve van.');
        }

        // A tétel a költség pénznemében kerül be, de a nyitott forintösszeggel
        // fedezve — így a részleges befizetés után is pontosan nullára zár.
        $rate = (float) $cost->exchange_rate ?: 1.0;
        $amount = $cost->currency === 'HUF' ? $outstandingHuf : round($outstandingHuf / $rate, 2);

        MemberPayment::create([
            'company_member_id' => $share->company_member_id,
            'shared_cost_id' => $cost->id,
            'paid_on' => now()->toDateString(),
            'currency' => $cost->currency,
            'amount' => $amount,
            'exchange_rate' => $cost->currency === 'HUF' ? 1 : $rate,
            'amount_huf' => $outstandingHuf,
            'note' => $cost->title,
            'created_by' => $request->user()->id,
        ]);

        return back()->with('success', 'Befizetés rögzítve.');
    }

    public function destroyPayment(MemberPayment $payment): RedirectResponse
    {
        $payment->delete();

        return back()->with('success', 'Befizetés törölve.');
    }

    /* ====================================================================== */
    /* Tagok */
    /* ====================================================================== */

    public function storeMember(Request $request): RedirectResponse
    {
        $data = $this->validateMember($request);

        CompanyMember::create($data);

        return back()->with('success', 'Tag hozzáadva.');
    }

    public function updateMember(Request $request, CompanyMember $member): RedirectResponse
    {
        $member->update($this->validateMember($request, $member));

        return back()->with('success', 'Tag módosítva.');
    }

    public function destroyMember(CompanyMember $member): RedirectResponse
    {
        // Akihez már tartozik felosztás vagy befizetés, azt nem töröljük — a
        // múltbeli elszámolás nem eshet szét; helyette inaktívvá tehető.
        if ($member->shares()->exists() || $member->payments()->exists()) {
            $member->update(['is_active' => false]);

            return back()->with('info', 'A tagnak már van elszámolása, ezért inaktívvá tettük törlés helyett.');
        }

        $member->delete();

        return back()->with('success', 'Tag törölve.');
    }

    /**
     * Az alapértelmezett tagok egy kattintással (első beállításkor).
     */
    public function seedMembers(): RedirectResponse
    {
        $order = 0;
        foreach (MemberLedger::DEFAULT_MEMBERS as $row) {
            $order += 10;
            CompanyMember::firstOrCreate(
                ['name' => $row['name']],
                ['default_share' => $row['share'], 'is_active' => true, 'sort_order' => $order],
            );
        }

        return back()->with('success', 'Az alapértelmezett tagok felvéve.');
    }

    /* ====================================================================== */
    /* Ismétlődő költségek */
    /* ====================================================================== */

    public function storeRecurring(Request $request): RedirectResponse
    {
        $data = $this->validateRecurring($request);

        RecurringSharedCost::create([
            ...$this->recurringAttributes($data),
            'created_by' => $request->user()->id,
        ]);

        return back()->with('success', 'Ismétlődő költség létrehozva.');
    }

    public function updateRecurring(Request $request, RecurringSharedCost $recurring): RedirectResponse
    {
        $recurring->update($this->recurringAttributes($this->validateRecurring($request)));

        return back()->with('success', 'Ismétlődő költség módosítva.');
    }

    public function destroyRecurring(RecurringSharedCost $recurring): RedirectResponse
    {
        $recurring->delete();

        return back()->with('success', 'Ismétlődő költség törölve.');
    }

    /* ====================================================================== */
    /* Beállítás + kézi beolvasás */
    /* ====================================================================== */

    public function updateSettings(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'watch_folder_id' => ['nullable', 'integer', 'exists:folders,id'],
        ]);

        if (empty($data['watch_folder_id'])) {
            Settings::forget(MemberLedger::SETTING_WATCH_FOLDER);
        } else {
            Settings::set(MemberLedger::SETTING_WATCH_FOLDER, (int) $data['watch_folder_id']);
        }

        return back()->with('success', 'A figyelt mappa elmentve.');
    }

    /**
     * Kézi beolvasás: a figyelt mappa még fel nem dolgozott PDF-jei + az
     * esedékes ismétlődő tételek.
     */
    public function rescan(): RedirectResponse
    {
        $fromPdf = $this->ingestor->scan();
        $recurring = $this->ingestor->generateRecurring();
        $total = $fromPdf + $recurring;

        if ($total === 0) {
            return back()->with('info', 'Nem találtunk új feldolgozható tételt.');
        }

        return back()->with('success', "{$total} új tétel keletkezett (számlából: {$fromPdf}, ismétlődőből: {$recurring}).");
    }

    /* ====================================================================== */
    /* Segédfüggvények */
    /* ====================================================================== */

    /**
     * @return array<string, mixed>
     */
    private function validateCost(Request $request): array
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:190'],
            'category' => ['required', Rule::in(array_keys(MemberLedger::CATEGORIES))],
            'period_month' => ['nullable', 'date'],
            'due_on' => ['required', 'date'],
            'issued_on' => ['nullable', 'date'],
            'currency' => ['required', Rule::in(array_keys(MemberLedger::CURRENCIES))],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:999999999999'],
            'net_amount' => ['nullable', 'numeric', 'min:0', 'max:999999999999'],
            'vat_amount' => ['nullable', 'numeric', 'min:0', 'max:999999999999'],
            'exchange_rate' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'supplier_name' => ['nullable', 'string', 'max:190'],
            'invoice_number' => ['nullable', 'string', 'max:80'],
            'note' => ['nullable', 'string', 'max:2000'],
            'shares' => ['required', 'array', 'min:1'],
            'shares.*.member_id' => ['required', 'exists:company_members,id'],
            'shares.*.percent' => ['required', 'numeric', 'min:0', 'max:100'],
        ], [
            'title.required' => 'Adjon meg megnevezést.',
            'due_on.required' => 'Adja meg a fizetési határidőt.',
            'amount.required' => 'Adja meg az összeget.',
            'shares.required' => 'Válasszon legalább egy tagot a felosztáshoz.',
        ]);

        if ($data['currency'] !== 'HUF' && (float) ($data['exchange_rate'] ?? 0) <= 0) {
            throw ValidationException::withMessages([
                'exchange_rate' => 'Devizás tételhez adja meg az árfolyamot.',
            ]);
        }

        if (array_sum(array_column($data['shares'], 'percent')) <= 0) {
            throw ValidationException::withMessages([
                'shares' => 'A felosztás összege nem lehet nulla.',
            ]);
        }

        return $data;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function costAttributes(array $data): array
    {
        $rate = $data['currency'] === 'HUF' ? 1.0 : (float) $data['exchange_rate'];

        return [
            'title' => $data['title'],
            'category' => $data['category'],
            'period_month' => $data['period_month'] ?? null,
            'due_on' => $data['due_on'],
            'issued_on' => $data['issued_on'] ?? null,
            'currency' => $data['currency'],
            'amount' => $data['amount'],
            'net_amount' => $data['net_amount'] ?? null,
            'vat_amount' => $data['vat_amount'] ?? null,
            'exchange_rate' => $rate,
            'amount_huf' => MemberLedger::toHuf((float) $data['amount'], $data['currency'], $rate),
            'supplier_name' => $data['supplier_name'] ?? null,
            'invoice_number' => $data['invoice_number'] ?? null,
            'note' => $data['note'] ?? null,
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<int, float>
     */
    private function shareMap(array $data): array
    {
        $map = [];

        foreach ($data['shares'] as $row) {
            $percent = (float) $row['percent'];
            if ($percent > 0) {
                $map[(int) $row['member_id']] = $percent;
            }
        }

        return $map;
    }

    /**
     * @return array<string, mixed>
     */
    private function validateMember(Request $request, ?CompanyMember $member = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'user_id' => [
                'nullable', 'exists:users,id',
                Rule::unique('company_members', 'user_id')->ignore($member?->id),
            ],
            'default_share' => ['required', 'numeric', 'min:0', 'max:100'],
            'is_active' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
        ], [
            'name.required' => 'Adja meg a tag nevét.',
            'user_id.unique' => 'Ehhez a felhasználóhoz már tartozik tag.',
            'default_share.required' => 'Adja meg az alapértelmezett részesedést.',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validateRecurring(Request $request): array
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:190'],
            'category' => ['required', Rule::in(array_keys(MemberLedger::CATEGORIES))],
            'currency' => ['required', Rule::in(array_keys(MemberLedger::CURRENCIES))],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:999999999999'],
            'exchange_rate' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'due_day' => ['required', 'integer', 'min:1', 'max:31'],
            'start_month' => ['nullable', 'date'],
            'is_active' => ['boolean'],
            'note' => ['nullable', 'string', 'max:2000'],
            'shares' => ['required', 'array', 'min:1'],
            'shares.*.member_id' => ['required', 'exists:company_members,id'],
            'shares.*.percent' => ['required', 'numeric', 'min:0', 'max:100'],
        ], [
            'title.required' => 'Adjon meg megnevezést.',
            'amount.required' => 'Adja meg az összeget.',
            'due_day.required' => 'Adja meg, a hónap hányadikán esedékes.',
            'shares.required' => 'Válasszon legalább egy tagot.',
        ]);

        if ($data['currency'] !== 'HUF' && (float) ($data['exchange_rate'] ?? 0) <= 0) {
            throw ValidationException::withMessages([
                'exchange_rate' => 'Devizás tételhez adja meg az árfolyamot.',
            ]);
        }

        return $data;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function recurringAttributes(array $data): array
    {
        return [
            'title' => $data['title'],
            'category' => $data['category'],
            'currency' => $data['currency'],
            'amount' => $data['amount'],
            'exchange_rate' => $data['currency'] === 'HUF' ? 1 : (float) $data['exchange_rate'],
            'due_day' => $data['due_day'],
            'start_month' => isset($data['start_month'])
                ? Carbon::parse($data['start_month'])->startOfMonth()->toDateString()
                : null,
            'is_active' => (bool) ($data['is_active'] ?? true),
            'note' => $data['note'] ?? null,
            'shares' => collect($this->shareMap($data))
                ->map(fn ($percent, $id) => ['member_id' => (int) $id, 'percent' => $percent])
                ->values()
                ->all(),
        ];
    }

    /**
     * A figyelt mappa állapota a felülethez.
     *
     * @return array<string, mixed>
     */
    private function watchInfo(): array
    {
        $folder = $this->ingestor->watchFolder();
        $configured = Settings::get(MemberLedger::SETTING_WATCH_FOLDER);

        return [
            'folder_id' => $folder?->id,
            'path' => $folder?->pathString(),
            'is_default' => $folder !== null && empty($configured),
            'url' => $folder ? route('documents.index', ['folder' => $folder->id]) : null,
        ];
    }

    /**
     * @return array<int, int>
     */
    private function availableYears(): array
    {
        $years = SharedCost::query()
            ->selectRaw('distinct extract(year from due_on)::int as y')
            ->orderByDesc('y')
            ->pluck('y')
            ->map(fn ($y) => (int) $y)
            ->all();

        $current = (int) now()->year;
        if (! in_array($current, $years, true)) {
            array_unshift($years, $current);
        }

        return $years;
    }

    /**
     * Lapos mappalista teljes útvonallal a mappaválasztóhoz.
     *
     * @return array<int, array{id:int,label:string}>
     */
    private function folderOptions(User $user): array
    {
        $visibleIds = Folder::visibleIdsFor($user);

        $folders = Folder::query()
            ->whereIn('id', $visibleIds)
            ->orderBy('name')
            ->get(['id', 'name', 'parent_id'])
            ->keyBy('id');

        return $folders->map(function (Folder $folder) use ($folders) {
            $parts = [$folder->name];
            $parent = $folder->parent_id;
            $guard = 0;

            while ($parent && $guard++ < 20) {
                $node = $folders->get($parent);
                if (! $node) {
                    break;
                }
                array_unshift($parts, $node->name);
                $parent = $node->parent_id;
            }

            return ['id' => $folder->id, 'label' => implode(' / ', $parts)];
        })
            ->sortBy('label')
            ->values()
            ->all();
    }
}
