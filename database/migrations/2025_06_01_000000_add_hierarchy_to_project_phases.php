<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Hierarchia a fázisokhoz (spec §6): az ütemterv-sablonok (MS Project WBS)
     * több szintű munkastruktúrát hoznak, ezért a fázisok fává állnak össze.
     *
     * - `parent_id`: a szülő fázis (csoport). Törléskor az egész ág megy.
     * - `level`:     mélység a fában (0 = felső szint) — a megjelenítés gyorsításához.
     * - `wbs`:       a sablonból hozott hierarchikus sorszám, pl. „1.4.1.2”.
     * - `is_group`:  összegző sor (nincs saját dátuma/készültsége, gyerekekből gördül).
     * - `is_milestone`: mérföldkő (nulla időtartamú, kritikus pont).
     *
     * A `sort_order` továbbra is a *teljes* fa mélységi bejárásának sorrendje,
     * így egyetlen `orderBy('sort_order')` a helyes megjelenítési sorrendet adja.
     */
    public function up(): void
    {
        Schema::table('project_phases', function (Blueprint $table) {
            $table->foreignId('parent_id')->nullable()->after('project_id')
                ->constrained('project_phases')->cascadeOnDelete();
            $table->unsignedTinyInteger('level')->default(0)->after('sort_order');
            $table->string('wbs', 40)->nullable()->after('level');
            $table->boolean('is_group')->default(false)->after('wbs');
            $table->boolean('is_milestone')->default(false)->after('is_group');

            // A sablonsorok neve hosszabb lehet a korábbi 120 karakternél.
            $table->string('name', 200)->change();
        });

        // A sablonok több száz sort hoznak: a fa felépítése menjen indexről.
        Schema::table('project_phases', function (Blueprint $table) {
            $table->index(['project_id', 'parent_id']);
        });
    }

    public function down(): void
    {
        Schema::table('project_phases', function (Blueprint $table) {
            $table->dropIndex(['project_id', 'parent_id']);
            $table->dropConstrainedForeignId('parent_id');
            $table->dropColumn(['level', 'wbs', 'is_group', 'is_milestone']);
            $table->string('name', 120)->change();
        });
    }
};
