<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Munkatársak / Erőforrások (6. modul): a belépés dátuma a HR-nézethez.
     * A többi törzsadat (név, elérhetőség, beosztás, fénykép) már a users
     * táblán van — nincs adatduplikáció, a dolgozó = belső felhasználó.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->date('hired_on')->nullable()->after('job_title');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('hired_on');
        });
    }
};
