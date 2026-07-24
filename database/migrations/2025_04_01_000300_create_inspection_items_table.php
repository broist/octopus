<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Egy ellenőrzés tételei az eredménnyel (megfelelt / nem megfelelt / na),
     * opcionális megjegyzéssel. A tétel szövege a példányosításkor a sablonból
     * másolódik ide (pillanatkép).
     */
    public function up(): void
    {
        Schema::create('inspection_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inspection_id')->constrained('inspections')->cascadeOnDelete();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->string('text', 500);
            $table->string('result', 20)->default('nyitott'); // Qa::INSPECTION_RESULTS
            $table->string('note')->nullable();
            $table->timestamps();

            $table->index('inspection_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inspection_items');
    }
};
