<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tényleges befejezés dátuma a fázison (spec §15: csúszás-elemzés —
     * „tervezett vs. tényleges határidők"). A rendszer automatikusan tölti,
     * amikor a fázis készültsége 100%-ra vált (és üríti, ha visszaesik).
     */
    public function up(): void
    {
        Schema::table('project_phases', function (Blueprint $table) {
            $table->date('completed_on')->nullable()->after('progress');
        });
    }

    public function down(): void
    {
        Schema::table('project_phases', function (Blueprint $table) {
            $table->dropColumn('completed_on');
        });
    }
};
