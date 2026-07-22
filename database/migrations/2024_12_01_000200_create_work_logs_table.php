<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Munkaidő-nyilvántartás (spec §5/6): ki melyik projekten hány órát
     * dolgozott. Rögzítés módja: mindenki manuálisan, saját magának viszi fel
     * a ledolgozott óráit. Órabér / bérköltség itt SZÁNDÉKOSAN nem tárolódik.
     */
    public function up(): void
    {
        Schema::create('work_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->date('work_date');
            $table->decimal('hours', 5, 2);
            $table->text('note')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'work_date']);
            $table->index('project_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_logs');
    }
};
