<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tényleges (nem anyag) költségek egy projekten (spec §9): alvállalkozói
     * költség (teljesítésigazolás alapján), gépköltség, egyéb. Az ANYAGKÖLTSÉG
     * NEM itt van — az az Anyagok modulból (material_procurements) származik
     * automatikusan, hogy ne legyen kettős könyvelés.
     *
     * Egy tétel opcionálisan bejövő számla is lehet (is_invoice): határidővel,
     * kifizetve/kifizetetlen státusszal és feltöltött PDF/fotó fájllal.
     */
    public function up(): void
    {
        Schema::create('project_costs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->string('category', 30);           // Finance::COST_CATEGORIES (alvallalkozo/gep/egyeb)
            $table->foreignId('partner_id')->nullable() // alvállalkozó / beszállító (CRM)
                ->constrained('partners')->nullOnDelete();
            $table->string('description');
            $table->decimal('amount', 14, 2);         // nettó összeg (Ft)
            $table->date('incurred_on');              // teljesítés / felmerülés dátuma

            // Bejövő számla (opcionális): határidő, kifizetettség, csatolt fájl.
            $table->boolean('is_invoice')->default(false);
            $table->date('due_on')->nullable();
            $table->boolean('is_paid')->default(false);
            $table->string('disk', 30)->nullable();
            $table->string('file_path')->nullable();
            $table->string('original_filename')->nullable();
            $table->string('mime_type', 120)->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['project_id', 'category']);
            $table->index(['is_invoice', 'is_paid', 'due_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_costs');
    }
};
