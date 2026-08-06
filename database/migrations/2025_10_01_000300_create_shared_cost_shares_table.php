<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Egy közös költség fejenkénti felosztása. A százalékok költségenként
     * eltérhetnek (pl. a könyvelés mind a négy tagot érinti 30-30-20-20%-kal,
     * a ChatGPT-előfizetés viszont csak hármukat).
     *
     * Az `amount` a kerekítési maradékkal együtt van szétosztva, tehát a
     * tételek összege PONTOSAN a költség összege.
     */
    public function up(): void
    {
        Schema::create('shared_cost_shares', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shared_cost_id')->constrained('shared_costs')->cascadeOnDelete();
            $table->foreignId('company_member_id')->constrained('company_members')->cascadeOnDelete();
            $table->decimal('share_percent', 6, 3);
            $table->decimal('amount', 14, 2);       // a költség pénznemében
            $table->decimal('amount_huf', 14, 2);   // forintra váltva
            $table->timestamps();

            $table->unique(['shared_cost_id', 'company_member_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shared_cost_shares');
    }
};
