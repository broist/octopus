<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Hibalista / hiányossági jegyzék (spec §12): feltárt hibák — leírás, fotó
     * (külön táblában), felelős, határidő, státusz (nyitott / javítás alatt /
     * lezárt). Köthető ellenőrzéshez és projekthez/alprojekthez; egy kattintással
     * feladattá alakítható (task_id a létrehozott Feladatra mutat).
     */
    public function up(): void
    {
        Schema::create('defects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('inspection_id')->nullable()->constrained('inspections')->nullOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('severity', 20)->default('kozepes'); // Qa::SEVERITIES
            $table->string('status', 20)->default('nyitott');   // Qa::DEFECT_STATUSES
            $table->foreignId('responsible_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('due_on')->nullable();
            $table->foreignId('task_id')->nullable()->constrained('tasks')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['project_id', 'status']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('defects');
    }
};
