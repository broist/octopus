<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Fázisok / mérföldkövek: szakaszok határidővel és készültséggel (spec §5/2).
        Schema::create('project_phases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('name', 120);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->date('starts_on')->nullable();
            $table->date('due_on')->nullable();
            $table->unsignedTinyInteger('progress')->default(0); // 0–100 készültség
            $table->text('note')->nullable();
            $table->timestamps();

            $table->index(['project_id', 'sort_order']);
        });

        // Gantt-függőségek: melyik fázis mire vár (spec: "mi mire vár").
        Schema::create('phase_dependencies', function (Blueprint $table) {
            $table->foreignId('phase_id')
                ->constrained('project_phases')->cascadeOnDelete();
            $table->foreignId('depends_on_id')
                ->constrained('project_phases')->cascadeOnDelete();
            $table->primary(['phase_id', 'depends_on_id']);
        });

        // Projekt-napló / tevékenységfolyam (spec §5/2 utolsó pont).
        Schema::create('project_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()
                ->constrained('users')->nullOnDelete();
            $table->string('type', 30); // letrehozva / modositva / statusz / fazis / torolve ...
            $table->string('description', 500);
            $table->timestamps();

            $table->index(['project_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_activities');
        Schema::dropIfExists('phase_dependencies');
        Schema::dropIfExists('project_phases');
    }
};
