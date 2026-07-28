<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('calendar_events', function (Blueprint $table) {
            // iCalendar UID: a bejegyzés stabil azonosítója a telefon felé. A
            // CalDAV-kliens ezzel ismeri fel ugyanazt az eseményt, ezért soha
            // nem változhat — a törölt-újra felvett esemény új UID-t kap.
            $table->string('uid', 255)->nullable()->after('id');

            // A CalDAV-objektum fájlneve. A kliens MAGA választja meg PUT-nál,
            // és nem feltétlenül egyezik a UID-del — ha nem ezt tárolnánk, a
            // telefon a saját, most létrehozott bejegyzésére 404-et kapna.
            // Octopusban készült bejegyzésnél a UID-ből származik.
            $table->string('caldav_uri', 255)->nullable();

            // A telefonról érkező eredeti VEVENT. Az Octopus adatmodellje nem
            // ismer ismétlődést, emlékeztetőt, résztvevőt — ezeket itt őrizzük
            // meg, hogy a szinkron-kör ne törölje őket a telefonról.
            $table->text('raw_ics')->nullable();
        });

        // Meglévő bejegyzések visszamenőleges UID-je.
        DB::statement("UPDATE calendar_events SET uid = gen_random_uuid()::text || '@octopus' WHERE uid IS NULL");

        Schema::table('calendar_events', function (Blueprint $table) {
            $table->string('uid', 255)->nullable(false)->change();
            $table->unique('uid');
        });
    }

    public function down(): void
    {
        Schema::table('calendar_events', function (Blueprint $table) {
            $table->dropUnique(['uid']);
            $table->dropColumn(['uid', 'caldav_uri', 'raw_ics']);
        });
    }
};
