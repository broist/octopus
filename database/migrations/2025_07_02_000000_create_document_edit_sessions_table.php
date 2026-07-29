<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Egy „megnyitás asztali Office-ban” munkamenet. Az Office nem küld
        // munkamenet-sütit (ahogy a rendszer-letöltő sem), ezért a hozzáférést
        // maga a megnyitó URL hordozza: benne egy rövid életű, egyetlen
        // dokumentumra és felhasználóra szóló, visszavonható jegy.
        Schema::create('document_edit_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // A jegy SHA-256 lenyomata (a nyílt érték csak a linkben él).
            // Ugyanaz az indok, mint a naptár-jelszónál: gépi, nagy entrópiájú
            // token, amit az Office mentésenként többször is felmutat.
            $table->char('token_hash', 64)->unique();

            // Az ebben a munkamenetben létrehozott verzió: a második mentéstől
            // ezt írjuk felül, hogy egy megnyitás EGY verziót jelentsen, ne
            // annyit, ahányszor a felhasználó Ctrl+S-t nyom.
            $table->foreignId('version_id')->nullable()
                ->constrained('document_versions')->nullOnDelete();

            $table->timestamp('last_used_at')->nullable();
            $table->string('last_ip', 45)->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('revoked_at')->nullable();

            $table->timestamps();

            $table->index(['document_id', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_edit_sessions');
    }
};
