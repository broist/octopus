<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Ajánlatkérő (árajánlat-készítő) modul — a portolt AcuWall app adatai.
     *
     * A mélyen egymásba ágyazott, szabadon szerkeszthető szerkezetet (munkanemek
     * → tételek, fizetési ütem, feltétel-szekciók) a `data` JSON oszlop tárolja
     * — így a kalkulátor és a szerkesztő a teljes struktúrát hűen kezeli. A
     * fejléc- és összegző mezők külön, indexelhető oszlopokban is szerepelnek a
     * listázáshoz és kereséshez.
     */
    public function up(): void
    {
        Schema::create('quotes', function (Blueprint $table) {
            $table->id();
            $table->string('quote_number', 60)->nullable();
            $table->string('project_name', 250);
            $table->string('client_name', 250)->nullable();
            $table->string('location', 200)->nullable();
            $table->string('status', 30)->default('piszkozat'); // piszkozat | jóváhagyva
            $table->unsignedInteger('version')->default(1);
            $table->unsignedBigInteger('net_offer')->default(0);
            $table->unsignedBigInteger('gross_offer')->default(0);
            $table->json('data'); // a teljes ajánlat (kategóriák, tételek, szekciók…)
            $table->foreignId('partner_id')->nullable()->constrained('partners')->nullOnDelete();
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->string('approved_by', 200)->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        // Jóváhagyott verziók pillanatképe (a jóváhagyás-folyamat megőrzése).
        Schema::create('quote_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quote_id')->constrained('quotes')->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->json('data');
            $table->timestamp('approved_at');
            $table->string('approved_by', 200)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quote_versions');
        Schema::dropIfExists('quotes');
    }
};
