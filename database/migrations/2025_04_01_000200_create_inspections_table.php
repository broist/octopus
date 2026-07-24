<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Egy elvégzett ellenőrzés (spec §12): egy sablonból (vagy szabadon)
     * példányosított checklist egy projekten, kitöltve. A tételek eredménye
     * külön táblában (pillanatkép, hogy a sablon utólagos módosítása ne írja át).
     */
    public function up(): void
    {
        Schema::create('inspections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('checklist_template_id')->nullable()
                ->constrained('checklist_templates')->nullOnDelete();
            $table->string('title');
            $table->string('purpose', 20)->default('minoseg'); // Qa::PURPOSES
            $table->date('inspected_on');
            $table->string('status', 20)->default('folyamatban'); // folyamatban | lezart
            $table->text('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['project_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inspections');
    }
};
