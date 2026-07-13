<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Shared partner database (spec §5): clients (megrendelő), suppliers
     * (beszállító) and subcontractors (alvállalkozó) live in ONE table with
     * role flags — no data duplication. The CRM and Subcontractor modules
     * add their own richer columns later; this is the shared core needed by
     * the Projects module (a project references its client).
     */
    public function up(): void
    {
        Schema::create('partners', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->boolean('is_company')->default(true);

            // Role flags — a partner can be several of these at once.
            $table->boolean('is_client')->default(false);
            $table->boolean('is_supplier')->default(false);
            $table->boolean('is_subcontractor')->default(false);

            $table->string('contact_name')->nullable();
            $table->string('email')->nullable();
            $table->string('phone', 50)->nullable();
            $table->string('tax_id', 30)->nullable();
            $table->string('address')->nullable();
            $table->text('note')->nullable();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('partners');
    }
};
