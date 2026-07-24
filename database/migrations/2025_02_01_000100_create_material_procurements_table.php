<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Projekthez kötött anyagbeszerzés (spec §8): melyik projekthez (vagy
     * alprojekthez) mit, mennyit, milyen áron, kitől (beszállító a CRM-ből).
     * Státusz: tervezett → megrendelve → beérkezett. A „tervezett", de még nem
     * megrendelt tételek adják a Dashboard hiány-riasztását; a beérkezés a
     * naptárban is megjelenik (szállítás). Nincs valós idejű raktárkészlet.
     */
    public function up(): void
    {
        Schema::create('material_procurements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('material_id')->constrained('materials')->cascadeOnDelete();
            $table->foreignId('supplier_id')->nullable()   // beszállító (partners, is_supplier)
                ->constrained('partners')->nullOnDelete();

            $table->string('status', 20)->default('tervezett'); // tervezett | megrendelve | beerkezett
            $table->decimal('quantity', 12, 3);                 // rendelt mennyiség
            $table->decimal('unit_price', 14, 2)->nullable();   // egységár (Ft)
            $table->date('ordered_on')->nullable();             // megrendelés dátuma
            $table->date('expected_on')->nullable();            // várható beérkezés (naptár)
            $table->date('received_on')->nullable();            // tényleges beérkezés
            $table->decimal('received_quantity', 12, 3)->nullable();
            $table->text('note')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['project_id', 'status']);
            $table->index('status');
            $table->index('expected_on');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('material_procurements');
    }
};
