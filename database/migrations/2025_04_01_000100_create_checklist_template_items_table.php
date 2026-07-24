<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Egy ellenőrző-sablon tételei (ellenőrzési pontok), sorrenddel.
     */
    public function up(): void
    {
        Schema::create('checklist_template_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('checklist_template_id')->constrained('checklist_templates')->cascadeOnDelete();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->string('text', 500);
            $table->timestamps();

            $table->index('checklist_template_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('checklist_template_items');
    }
};
