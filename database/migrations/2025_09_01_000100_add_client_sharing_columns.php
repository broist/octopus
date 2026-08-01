<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ügyfélportál — explicit megosztás.
 *
 * Semmi nem látszik az ügyfélnek magától: minden megosztható tartalom külön
 * kapcsolót kap, és alapból KIKAPCSOLT. Így belső jegyzet, költség vagy
 * alvállalkozói ár soha nem szivárog ki véletlenül.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->boolean('client_visible')->default(false)->after('description');
            // Az ügyfélnek szánt rövid összefoglaló (a belső leírás helyett).
            $table->text('client_summary')->nullable()->after('client_visible');
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->boolean('client_visible')->default(false)->after('description');
        });

        Schema::table('daily_reports', function (Blueprint $table) {
            $table->boolean('client_visible')->default(false)->after('obstacles');
        });

        Schema::table('quotes', function (Blueprint $table) {
            $table->boolean('client_visible')->default(false)->after('project_id');
            // Az ügyfél online visszajelzése: elfogadva | elutasitva (null = nyitott).
            $table->string('client_response', 20)->nullable()->after('client_visible');
            $table->text('client_response_note')->nullable()->after('client_response');
            $table->timestamp('client_responded_at')->nullable()->after('client_response_note');
        });
    }

    public function down(): void
    {
        Schema::table('quotes', function (Blueprint $table) {
            $table->dropColumn(['client_visible', 'client_response', 'client_response_note', 'client_responded_at']);
        });

        Schema::table('daily_reports', function (Blueprint $table) {
            $table->dropColumn('client_visible');
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->dropColumn('client_visible');
        });

        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn(['client_visible', 'client_summary']);
        });
    }
};
