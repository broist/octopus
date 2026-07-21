<?php

namespace App\Http\Controllers;

use App\Services\LeadIngestor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Opcionális közvetlen becsatorna: a weboldal űrlap-kezelője HTTP POST-tal
 * is beküldheti a leadet (megbízhatóbb, mint az e-mail feldolgozás).
 *
 *   POST /webhooks/lead
 *   Fejléc:  X-Octopus-Token: <LEADS_WEBHOOK_TOKEN>
 *   Törzs:   JSON { lead_id, name, email, phone, location, building_type,
 *                   area, plot_status, design_needs, planned_start, description }
 *
 * Amíg a LEADS_WEBHOOK_TOKEN üres, a végpont le van tiltva (404).
 */
class LeadWebhookController extends Controller
{
    public function store(Request $request, LeadIngestor $ingestor): JsonResponse
    {
        $token = config('leads.webhook_token');

        abort_if(! $token, 404);
        abort_unless(hash_equals($token, (string) $request->header('X-Octopus-Token')), 403);

        $lead = $ingestor->ingestArray($request->all());

        if (! $lead) {
            return response()->json(['error' => 'lead_id hiányzik'], 422);
        }

        return response()->json([
            'lead_id' => $lead->lead_id,
            'project_id' => $lead->project_id,
            'created' => $lead->wasRecentlyCreated,
        ], $lead->wasRecentlyCreated ? 201 : 200);
    }
}
