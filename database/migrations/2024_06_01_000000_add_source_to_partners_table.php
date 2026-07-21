<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A CRM modul finomítása: honnan került be a partner. A webes
     * ajánlatkérésből automatikusan létrehozott ügyfelek 'lead' jelölést
     * kapnak — így a CRM listában megkülönböztethetők a kézzel felvittektől.
     */
    public function up(): void
    {
        Schema::table('partners', function (Blueprint $table) {
            $table->string('source', 20)->default('manual')->after('is_subcontractor');
        });
    }

    public function down(): void
    {
        Schema::table('partners', function (Blueprint $table) {
            $table->dropColumn('source');
        });
    }
};
