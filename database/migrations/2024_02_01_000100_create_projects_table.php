<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table) {
            $table->id();

            // Subprojects: one level of nesting (spec §5/2 – alprojektek).
            $table->foreignId('parent_id')->nullable()
                ->constrained('projects')->nullOnDelete();

            $table->string('code', 30)->unique();   // projekt azonosító, pl. P-2026-001
            $table->string('name', 200);

            $table->foreignId('client_id')->nullable()
                ->constrained('partners')->nullOnDelete();
            $table->foreignId('project_manager_id')->nullable()
                ->constrained('users')->nullOnDelete();

            // ajanlat → szerzodott → folyamatban → atadas → lezart
            $table->string('status', 20)->default('ajanlat')->index();
            $table->string('construction_type', 20)->nullable(); // ujepites/felujitas/bovites/egyeb

            $table->string('location_city', 120)->nullable();
            $table->string('location_address')->nullable();
            // Site coordinates — a Napi jelentés modul időjárás-lekéréséhez (spec §11).
            $table->decimal('latitude', 9, 6)->nullable();
            $table->decimal('longitude', 9, 6)->nullable();

            $table->date('starts_on')->nullable();
            $table->date('ends_on')->nullable(); // tervezett befejezés

            $table->text('description')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index('parent_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('projects');
    }
};
