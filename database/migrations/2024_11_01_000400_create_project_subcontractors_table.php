<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Alvállalkozó ↔ projekt hozzárendelés (spec §5/5: „melyik alvállalkozó
     * melyik projekten, milyen feladaton dolgozik"). A pénzügyi elszámolás
     * (szerződéses összeg, teljesítésigazolás, kifizetés) a Pénzügy modulhoz
     * (9.) tartozik — itt csak a hozzárendelés és a feladatkör rögzül.
     */
    public function up(): void
    {
        Schema::create('project_subcontractors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('partner_id')->constrained('partners')->cascadeOnDelete();
            $table->string('scope')->nullable(); // milyen feladaton dolgozik
            $table->text('note')->nullable();
            $table->timestamps();

            $table->unique(['project_id', 'partner_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_subcontractors');
    }
};
