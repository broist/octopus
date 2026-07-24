<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Anyagtörzs (spec §8): anyag neve, kategória, mértékegység, opcionálisan
     * cikkszám. A konkrét, projekthez kötött beszerzések a material_procurements
     * táblában — itt csak a törzsadat (nincs valós idejű raktárkészlet).
     */
    public function up(): void
    {
        Schema::create('materials', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('category', 40)->nullable();   // Materials::CATEGORIES
            $table->string('unit', 20);                    // Materials::UNITS (m2, db, zsák…)
            $table->string('sku', 60)->nullable();         // opcionális cikkszám
            $table->text('note')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('category');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('materials');
    }
};
