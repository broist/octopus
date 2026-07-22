<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Alvállalkozói teljesítmény-értékelés (spec §5/5): 1–5 csillag + megjegyzés,
     * opcionálisan egy projekthez kötve — hogy legközelebb el lehessen dönteni,
     * kit hívnak vissza.
     */
    public function up(): void
    {
        Schema::create('subcontractor_ratings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('partner_id')->constrained('partners')->cascadeOnDelete();
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->foreignId('rated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedTinyInteger('score');
            $table->text('comment')->nullable();
            $table->timestamps();

            $table->index('partner_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subcontractor_ratings');
    }
};
