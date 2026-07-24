<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Napi jelentés / Munkanapló (spec §11) — az építési napló digitális
     * megfelelője: projektenként (vagy alprojektenként) naponta egy helyszíni
     * bejegyzés. Elvégzett munka, akadályok, létszám (saját + alvállalkozói),
     * opcionális anyag-/gépmozgás, valamint a projekt helyszíne alapján a
     * mentéskor automatikusan lekért időjárás-pillanatkép (jsonb gyorsítótár).
     * A létszám „kik" része külön táblákban: saját dolgozók (daily_report_user),
     * alvállalkozói brigádok (daily_report_subcontractors). A fotók külön táblában
     * (daily_report_photos), a Dokumentumtárba is bekerülve.
     */
    public function up(): void
    {
        Schema::create('daily_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->date('report_date');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->text('work_done');                              // elvégzett munka
            $table->text('obstacles')->nullable();                  // akadályok / események
            $table->unsignedSmallInteger('own_headcount')->default(0); // saját dolgozók létszáma
            $table->text('material_movement')->nullable();          // anyagmozgás (opcionális)
            $table->text('machine_movement')->nullable();           // gépmozgás (opcionális)

            // Automatikus időjárás-pillanatkép (Open-Meteo), a mentés pillanatában
            // rögzítve — a projekt koordinátái alapján, kézzel nem kell beírni.
            $table->jsonb('weather')->nullable();
            $table->timestamp('weather_fetched_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['project_id', 'report_date']);
            $table->index('report_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_reports');
    }
};
