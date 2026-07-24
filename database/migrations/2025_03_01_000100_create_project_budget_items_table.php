<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Projekt-költségvetés (spec §9): projektenként (és alprojektenként) tervezett
     * költség tételesen, kategóriánként (munkadíj, anyag, alvállalkozó, gép, egyéb).
     * A tényleges költséggel összevetve adja a terv-vs-tény nézetet.
     */
    public function up(): void
    {
        Schema::create('project_budget_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->string('category', 30);           // Finance::BUDGET_CATEGORIES
            $table->string('description');
            $table->decimal('amount', 14, 2);         // tervezett nettó összeg (Ft)
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['project_id', 'category']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_budget_items');
    }
};
