<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Szerződéses (nettó) érték a projekten — a Pénzügy modul (spec §9) bevétel-
     * oldala. Ha nincs kitöltve, a bevétel az elfogadott/kiadott árajánlatból
     * (Quote.net_offer) származtatható. A bruttó számlázás/Számlázz.hu később.
     */
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->decimal('contract_value', 14, 2)->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn('contract_value');
        });
    }
};
