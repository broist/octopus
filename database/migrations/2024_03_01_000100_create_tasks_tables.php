<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Feladatok / To-do (spec §13).
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->string('title', 200);
            $table->text('description')->nullable();

            // Köthető projekthez/alprojekthez, de lehet független is.
            $table->foreignId('project_id')->nullable()
                ->constrained('projects')->nullOnDelete();

            $table->string('status', 20)->default('teendo')->index();   // teendo / folyamatban / kesz
            $table->string('priority', 20)->default('kozepes');          // alacsony / kozepes / magas
            $table->date('due_on')->nullable()->index();
            $table->timestamp('completed_at')->nullable();

            $table->foreignId('created_by')->nullable()
                ->constrained('users')->nullOnDelete();

            $table->timestamps();
        });

        // Felelős(ök) — több felelős is kijelölhető.
        Schema::create('task_user', function (Blueprint $table) {
            $table->foreignId('task_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->primary(['task_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_user');
        Schema::dropIfExists('tasks');
    }
};
