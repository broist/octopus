<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ügyfélportál: a külső (is_external) fiók ahhoz a partnerhez kötődik, akinek
 * a projektjeit láthatja. Enélkül a portál nem enged be senkit — a partner-
 * kötés maga a hozzáférés-vezérlés.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('partner_id')
                ->nullable()
                ->after('is_external')
                ->constrained('partners')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('partner_id');
        });
    }
};
