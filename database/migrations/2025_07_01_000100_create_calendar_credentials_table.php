<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Eszközönkénti naptár-jelszó a CalDAV-hoz. A CalDAV-kliensek csak
        // basic autht tudnak, MFA-t nem — ezért NEM a fiók jelszavát adjuk a
        // telefonnak, hanem egy szűk hatókörű, visszavonható kulcsot, ami
        // kizárólag a /caldav végponton érvényes. Létrehozni csak belépve
        // lehet, tehát az MFA a kibocsátást továbbra is védi.
        Schema::create('calendar_credentials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // Eszköz megnevezése, pl. „István iPhone”.
            $table->string('name', 100);

            // A kulcs SHA-256 lenyomata. Szándékosan nem bcrypt: a token gépi
            // úton generált, nagy entrópiájú (nem felhasználó által választott
            // jelszó), így a lassú hash nem ad többletvédelmet — viszont a
            // CalDAV-kliens percenként hitelesít újra, ott a bcrypt költsége
            // valós terhelés lenne.
            $table->char('token_hash', 64);

            $table->timestamp('last_used_at')->nullable();
            $table->string('last_ip', 45)->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('revoked_at')->nullable();

            $table->timestamps();

            $table->index(['user_id', 'revoked_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('calendar_credentials');
    }
};
