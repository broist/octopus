<?php

namespace App\Notifications;

use App\Models\SharedCost;
use App\Support\MemberLedger;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Harang-értesítés a tagoknak: új közös költség keletkezett (számla PDF-jéből
 * vagy ismétlődő sablonból), tehát esedékes a tagi kölcsön befizetés.
 */
class SharedCostCreated extends Notification
{
    use Queueable;

    public function __construct(public SharedCost $cost) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        $symbol = MemberLedger::CURRENCY_SYMBOLS[$this->cost->currency] ?? $this->cost->currency;
        $total = number_format((float) $this->cost->amount, 0, ',', ' ')." {$symbol}";

        $share = $this->cost->shares()
            ->whereHas('member', fn ($q) => $q->where('user_id', $notifiable->id))
            ->value('amount');

        $body = "Összesen {$total}, határidő: ".$this->cost->due_on->format('Y.m.d.');
        if ($share !== null) {
            $body .= ' Rád eső rész: '.number_format((float) $share, 0, ',', ' ')." {$symbol}.";
        }

        return [
            'title' => 'Esedékes befizetés: '.$this->cost->title,
            'body' => $body,
            'url' => route('finance.ledger'),
        ];
    }
}
