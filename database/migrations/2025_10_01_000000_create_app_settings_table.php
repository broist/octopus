<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Apró kulcs–érték tár azoknak a beállításoknak, amiknek nincs saját
     * táblájuk és a felületről állíthatók (tehát nem .env-be valók).
     *
     * Első fogyasztója a Tagi kölcsön modul figyelt mappája (ide kerül havonta
     * a könyvelői számla PDF-je) — App\Support\Settings olvassa/írja.
     */
    public function up(): void
    {
        Schema::create('app_settings', function (Blueprint $table) {
            $table->string('key', 120)->primary();
            $table->jsonb('value')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('app_settings');
    }
};
