<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Ütemezés-bővítés: munkanap-szám a fázisokhoz, és a függőségek típusa
     * (KK/BB/BK/KB) + eltolás (lag) a pivoton. Plusz fázis-erőforrások.
     */
    public function up(): void
    {
        Schema::table('project_phases', function (Blueprint $table) {
            $table->unsignedSmallInteger('work_days')->nullable()->after('due_on');
        });

        Schema::table('phase_dependencies', function (Blueprint $table) {
            // bk = befejezés→kezdés, kk = kezdés→kezdés, bb = befejezés→befejezés, kb = kezdés→befejezés
            $table->string('dep_type', 2)->default('bk')->after('depends_on_id');
            $table->smallInteger('lag_days')->default(0)->after('dep_type');
        });

        // Fázishoz rendelt erőforrások (kézi/gépi), naponta lebontható.
        Schema::create('phase_resources', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_phase_id')->constrained('project_phases')->cascadeOnDelete();
            $table->string('kind', 10)->default('kezi'); // kezi | gepi
            $table->string('name', 150);
            $table->unsignedSmallInteger('quantity')->default(1);
            $table->unsignedSmallInteger('work_days')->default(1);
            $table->string('note', 250)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('phase_resources');

        Schema::table('phase_dependencies', function (Blueprint $table) {
            $table->dropColumn(['dep_type', 'lag_days']);
        });

        Schema::table('project_phases', function (Blueprint $table) {
            $table->dropColumn('work_days');
        });
    }
};
