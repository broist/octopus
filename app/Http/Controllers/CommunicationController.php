<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use App\Models\User;
use App\Notifications\AnnouncementPosted;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Kommunikáció (14. modul) — belső üzenőfal a vezetői kiértesítésekhez.
 *
 * Új bejegyzés posztolásakor minden aktív belső munkatárs harang-értesítést
 * kap, így a fontos közlemények mindenkihez eljutnak.
 */
class CommunicationController extends Controller
{
    public function index(Request $request): Response
    {
        $announcements = Announcement::query()
            ->with('author:id,name')
            ->orderByDesc('is_pinned')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Announcement $a) => [
                'id' => $a->id,
                'title' => $a->title,
                'body' => $a->body,
                'is_pinned' => $a->is_pinned,
                'author' => $a->author?->name,
                'created_at' => $a->created_at->toIso8601String(),
                'can_delete' => $request->user()->can('communication.delete')
                    || $a->user_id === $request->user()->id,
            ]);

        return Inertia::render('Communication/Index', [
            'announcements' => $announcements,
            'can' => [
                'create' => $request->user()->can('communication.create'),
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'body' => ['required', 'string', 'max:5000'],
            'is_pinned' => ['boolean'],
        ], [
            'title.required' => 'A cím megadása kötelező.',
            'body.required' => 'Az üzenet szövege kötelező.',
        ]);

        $announcement = Announcement::create([
            'user_id' => $request->user()->id,
            'title' => $data['title'],
            'body' => $data['body'],
            'is_pinned' => $data['is_pinned'] ?? false,
        ]);

        // Mindenki (a szerzőt kivéve) harang-értesítést kap.
        $recipients = User::where('is_active', true)
            ->where('is_external', false)
            ->where('id', '!=', $request->user()->id)
            ->get();
        Notification::send($recipients, new AnnouncementPosted($announcement));

        return back()->with('success', 'Az üzenet közzétéve.');
    }

    public function destroy(Request $request, Announcement $announcement): RedirectResponse
    {
        abort_unless(
            $request->user()->can('communication.delete') || $announcement->user_id === $request->user()->id,
            403,
        );

        $announcement->delete();

        return back()->with('success', 'Az üzenet törölve.');
    }
}
