<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

/**
 * Diagnosztikai parancs a levélküldés ellenőrzéséhez. Kiírja az aktuális
 * mail-beállításokat, küld egy teszt e-mailt a megadott címre, és HIBA
 * esetén megmutatja a pontos kivételt (SMTP-kapcsolat, hitelesítés, stb.).
 *
 * Használat: php artisan mail:test valaki@example.com
 */
class TestMail extends Command
{
    protected $signature = 'mail:test {email : A címzett e-mail címe}';

    protected $description = 'Teszt e-mail küldése a levélküldés ellenőrzéséhez';

    public function handle(): int
    {
        $to = $this->argument('email');
        $mailer = config('mail.default');
        $host = config("mail.mailers.{$mailer}.host");
        $port = config("mail.mailers.{$mailer}.port");

        $this->line("Mailer:  <info>{$mailer}</info>");
        $this->line('Host:    <info>'.($host ?: '—')."</info>".($port ? " : {$port}" : ''));
        $this->line('Feladó:  <info>'.config('mail.from.address').'</info>');
        $this->line("Címzett: <info>{$to}</info>");
        $this->newLine();

        try {
            Mail::raw(
                "Ez egy teszt e-mail az Octopus rendszerből.\n\n".
                'Ha ezt megkaptad, a levélküldés helyesen működik.',
                function ($message) use ($to) {
                    $message->to($to)->subject('Octopus – teszt e-mail');
                },
            );
        } catch (\Throwable $e) {
            $this->error('❌ A küldés HIBÁRA futott:');
            $this->error(get_class($e).': '.$e->getMessage());
            $this->newLine();
            $this->warn('Tipp: éles szerveren a MAIL_* beállításokat a .env-ben kell megadni, '
                .'majd „php artisan config:clear”. A részletes hiba a storage/logs/laravel.log-ban is megjelenik.');

            return self::FAILURE;
        }

        $this->info('✅ Az e-mail átadva a mailernek — nincs kivétel a küldés során.');
        if ($mailer === 'smtp' && $host === 'mailpit') {
            $this->line('   A levél a Mailpit levélfogóba került: <info>http://localhost:8025</info> (nem valódi postafiók!).');
        } elseif ($mailer === 'log') {
            $this->line('   A „log” mailer nem küld valódi levelet — a tartalom a storage/logs/laravel.log-ba íródott.');
        } else {
            $this->line("   Nézd meg a(z) {$to} postafiókot (a spam mappát is).");
        }

        return self::SUCCESS;
    }
}
