<?php

namespace App\Services;

use App\Models\Lead;
use App\Models\Partner;
use App\Models\Project;
use App\Models\User;
use App\Notifications\LeadProjectCreated;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

/**
 * Az acuwall.hu ajánlatkérő űrlapjáról érkező levelek feldolgozása:
 * e-mail szöveg → Lead + ügyfél (Partner) + projekt (ajánlati fázis)
 * + felületi értesítés a projektkezelő jogú munkatársaknak.
 */
class LeadIngestor
{
    /**
     * Az űrlap-e-mail címkéi → lead mezők. A sorrend a levél formátumát követi.
     *
     * @var array<string, string>
     */
    private const FIELD_LABELS = [
        'Név' => 'name',
        'Email' => 'email',
        'Telefonszám' => 'phone',
        'Projekt helyszíne' => 'location',
        'Épület típusa' => 'building_type',
        'Becsült alapterület' => 'area',
        'Telek állapota' => 'plot_status',
        'Szükséges tervezés / statika' => 'design_needs',
        'Tervezett indulás' => 'planned_start',
    ];

    /**
     * Nyers e-mail törzs (HTML vagy sima szöveg) feldolgozása.
     * Ha nem ajánlatkérő levél (nincs Lead ID), null-t ad vissza.
     */
    public function ingestText(string $body, string $source = 'email', ?\DateTimeInterface $receivedAt = null): ?Lead
    {
        $text = $this->toPlainText($body);

        if (! preg_match('/Lead\s*ID:\s*([A-Z0-9][A-Z0-9\-]{5,})/iu', $text, $m)) {
            return null; // nem az űrlap levele
        }

        $leadId = trim($m[1]);

        // Duplikáció-védelem: ugyanaz a levél kétszer sem hoz létre két projektet.
        $existing = Lead::where('lead_id', $leadId)->first();
        if ($existing) {
            return $existing;
        }

        $fields = $this->parseFields($text);
        $fields['description'] = $this->parseDescription($text);

        return $this->createLead($leadId, $fields, $text, $source, $receivedAt);
    }

    /**
     * Strukturált adat (webhook) feldolgozása — ugyanaz a folyamat, parse nélkül.
     *
     * @param  array<string, mixed>  $data
     */
    public function ingestArray(array $data): ?Lead
    {
        $leadId = trim((string) ($data['lead_id'] ?? ''));
        if ($leadId === '') {
            return null;
        }

        $existing = Lead::where('lead_id', $leadId)->first();
        if ($existing) {
            return $existing;
        }

        $fields = [];
        foreach (array_values(self::FIELD_LABELS) as $key) {
            $fields[$key] = $this->clean($data[$key] ?? null);
        }
        $fields['description'] = $this->clean($data['description'] ?? null);

        return $this->createLead($leadId, $fields, json_encode($data, JSON_UNESCAPED_UNICODE) ?: '', 'webhook', null);
    }

    /* ------------------------------------------------------------------ */
    /* Lead → Partner + Projekt + értesítés                                */
    /* ------------------------------------------------------------------ */

    /**
     * @param  array<string, ?string>  $fields
     */
    private function createLead(string $leadId, array $fields, string $rawBody, string $source, ?\DateTimeInterface $receivedAt): Lead
    {
        return DB::transaction(function () use ($leadId, $fields, $rawBody, $source, $receivedAt) {
            $client = $this->findOrCreateClient($fields);
            $project = $this->createProject($leadId, $fields, $client);

            $lead = Lead::create([
                'lead_id' => $leadId,
                ...$fields,
                'raw_body' => mb_substr($rawBody, 0, 60000),
                'source' => $source,
                'project_id' => $project->id,
                'received_at' => $receivedAt ?? now(),
            ]);

            $this->notify($lead);

            Log::info("Lead feldolgozva: {$leadId} → projekt #{$project->id} ({$project->code})");

            return $lead;
        });
    }

    /**
     * @param  array<string, ?string>  $fields
     */
    private function findOrCreateClient(array $fields): ?Partner
    {
        $name = $fields['name'] ?? null;
        $email = $fields['email'] ?? null;

        if (! $name && ! $email) {
            return null;
        }

        // Meglévő ügyfél e-mail alapján — ne duplikáljuk a partnereket.
        if ($email) {
            $existing = Partner::where('email', $email)->first();
            if ($existing) {
                if (! $existing->is_client) {
                    $existing->update(['is_client' => true]);
                }

                return $existing;
            }
        }

        return Partner::create([
            'name' => $name ?: $email,
            'is_company' => false,
            'is_client' => true,
            'source' => 'lead',
            'email' => $email,
            'phone' => $fields['phone'] ?? null,
            'note' => 'Automatikusan létrehozva webes ajánlatkérésből.',
        ]);
    }

    /**
     * @param  array<string, ?string>  $fields
     */
    private function createProject(string $leadId, array $fields, ?Partner $client): Project
    {
        $name = 'Ajánlatkérés – '.($fields['name'] ?? 'ismeretlen');
        if (! empty($fields['location'])) {
            $name .= " ({$fields['location']})";
        }

        $project = Project::create([
            'code' => Project::suggestNextCode(),
            'name' => mb_substr($name, 0, 200),
            'client_id' => $client?->id,
            'status' => 'ajanlat',
            'construction_type' => $this->guessConstructionType($fields['building_type'] ?? null),
            'location_city' => $fields['location'] ?? null,
            'description' => $this->buildDescription($leadId, $fields),
        ]);

        $project->logActivity(
            'letrehozva',
            "Projekt automatikusan létrehozva webes ajánlatkérésből (Lead: {$leadId}).",
        );

        return $project;
    }

    private function notify(Lead $lead): void
    {
        // Mindenki, aki projektet hozhat létre (IT Admin, Projektvezető…).
        $recipients = User::where('is_active', true)
            ->where('is_external', false)
            ->permission('projects.create')
            ->get();

        Notification::send($recipients, new LeadProjectCreated($lead));
    }

    /**
     * @param  array<string, ?string>  $fields
     */
    private function buildDescription(string $leadId, array $fields): string
    {
        $lines = [
            'Webes ajánlatkérés az acuwall.hu űrlapról.',
            "Lead ID: {$leadId}",
            '',
        ];

        $labels = array_flip(self::FIELD_LABELS);
        foreach ($fields as $key => $value) {
            if ($key === 'description' || $value === null || $value === '') {
                continue;
            }
            $lines[] = ($labels[$key] ?? $key).': '.$value;
        }

        if (! empty($fields['description'])) {
            $lines[] = '';
            $lines[] = 'Projektleírás:';
            $lines[] = $fields['description'];
        }

        return implode("\n", $lines);
    }

    private function guessConstructionType(?string $buildingType): ?string
    {
        if (! $buildingType) {
            return null;
        }

        $t = mb_strtolower($buildingType);

        return match (true) {
            str_contains($t, 'új') || str_contains($t, 'uj') => 'ujepites',
            str_contains($t, 'felújít') || str_contains($t, 'felujit') => 'felujitas',
            str_contains($t, 'bővít') || str_contains($t, 'bovit') => 'bovites',
            default => null,
        };
    }

    /* ------------------------------------------------------------------ */
    /* Szövegfeldolgozás                                                   */
    /* ------------------------------------------------------------------ */

    /**
     * @return array<string, ?string>
     */
    private function parseFields(string $text): array
    {
        $fields = [];

        foreach (self::FIELD_LABELS as $label => $key) {
            $pattern = '/^\s*'.preg_quote($label, '/').'\s*:\s*(.*)$/miu';
            $fields[$key] = preg_match($pattern, $text, $m) ? $this->clean($m[1]) : null;
        }

        return $fields;
    }

    /**
     * A Projektleírás a címke utáni sorokban áll, a záró lábjegyzetig.
     */
    private function parseDescription(string $text): ?string
    {
        if (! preg_match('/Projektleírás:\s*\n?(.*?)(?:\n\s*Ez egy automatikus|$)/siu', $text, $m)) {
            return null;
        }

        return $this->clean($m[1]);
    }

    /**
     * HTML levél → sima szöveg (címkénként új sor), sima szövegnél no-op.
     */
    private function toPlainText(string $body): string
    {
        $text = preg_replace('/<(script|style)\b[^>]*>.*?<\/\1>/si', '', $body) ?? $body;
        $text = preg_replace('/<br\s*\/?>/i', "\n", $text) ?? $text;
        $text = preg_replace('/<\/(p|div|tr|li|h[1-6]|td)>/i', "\n", $text) ?? $text;
        $text = strip_tags($text);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = str_replace(["\r\n", "\r", "\u{00A0}"], ["\n", "\n", ' '], $text);

        return trim(preg_replace('/\n{3,}/', "\n\n", $text) ?? $text);
    }

    /**
     * Mezőérték tisztítása: whitespace le, az űrlap üres-jele ("-") → null.
     */
    private function clean(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = trim((string) $value);

        return ($value === '' || $value === '-' || $value === '–') ? null : $value;
    }
}
