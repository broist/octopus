<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Ellenőrző-sablonok (spec §12): a felhasználók maguk hozhatnak létre és
     * szerkeszthetnek testre szabható checklist-sablonokat (átadás-átvétel,
     * munkavédelmi bejárás, minőségi ellenőrzés). A tételek külön táblában.
     */
    public function up(): void
    {
        Schema::create('checklist_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('purpose', 20)->default('minoseg'); // Qa::PURPOSES
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('checklist_templates');
    }
};
