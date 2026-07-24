<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A napi jelentéshez tartozó saját dolgozók (spec §11: „kik dolgoztak").
     * A belső felhasználók (users, is_external=false) közül, akik aznap a
     * helyszínen voltak — az own_headcount szám mellett a névsor is rögzíthető.
     */
    public function up(): void
    {
        Schema::create('daily_report_user', function (Blueprint $table) {
            $table->foreignId('daily_report_id')->constrained('daily_reports')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();

            $table->primary(['daily_report_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_report_user');
    }
};
