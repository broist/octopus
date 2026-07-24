<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A napi jelentéshez tartozó alvállalkozói létszám (spec §11: „mely
     * alvállalkozók, hány fővel"). Egy sor = egy alvállalkozó (partners,
     * is_subcontractor) aznapi jelenléte a helyszínen, létszámmal és opcionális
     * megjegyzéssel (mit csináltak).
     */
    public function up(): void
    {
        Schema::create('daily_report_subcontractors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('daily_report_id')->constrained('daily_reports')->cascadeOnDelete();
            $table->foreignId('subcontractor_id')->constrained('partners')->cascadeOnDelete();
            $table->unsignedSmallInteger('headcount')->default(0);
            $table->string('note')->nullable();
            $table->timestamps();

            $table->index('daily_report_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_report_subcontractors');
    }
};
