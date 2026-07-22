<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Alvállalkozó-specifikus mezők a közös partner-táblán (spec §5/5). A CRM
     * érintetlen marad — ezek csak az Alvállalkozók nézetben jelennek meg:
     * szakma/szakterület (kereshető), kapacitás (létszám) és elérhetőség.
     */
    public function up(): void
    {
        Schema::table('partners', function (Blueprint $table) {
            $table->string('trade', 60)->nullable()->after('is_subcontractor');
            $table->unsignedSmallInteger('crew_size')->nullable()->after('trade');
            $table->text('availability_note')->nullable()->after('crew_size');
        });
    }

    public function down(): void
    {
        Schema::table('partners', function (Blueprint $table) {
            $table->dropColumn(['trade', 'crew_size', 'availability_note']);
        });
    }
};
