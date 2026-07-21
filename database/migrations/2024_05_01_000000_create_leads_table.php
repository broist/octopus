<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Webes ajánlatkérések (acuwall.hu űrlap) — a lead_id a duplikáció-
        // védelem kulcsa: ugyanaz az e-mail kétszer feldolgozva sem hoz létre
        // két projektet.
        Schema::create('leads', function (Blueprint $table) {
            $table->id();
            $table->string('lead_id', 100)->unique();
            $table->string('name', 200)->nullable();
            $table->string('email', 255)->nullable();
            $table->string('phone', 50)->nullable();
            $table->string('location', 200)->nullable();
            $table->string('building_type', 200)->nullable();
            $table->string('area', 100)->nullable();
            $table->string('plot_status', 200)->nullable();
            $table->string('design_needs', 200)->nullable();
            $table->string('planned_start', 100)->nullable();
            $table->text('description')->nullable();
            $table->text('raw_body')->nullable();
            $table->string('source', 30)->default('email'); // email | webhook
            $table->foreignId('project_id')->nullable()
                ->constrained('projects')->nullOnDelete();
            $table->timestamp('received_at')->nullable();
            $table->timestamps();
        });

        // Laravel database notifications (harang ikon a fejlécben).
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('leads');
    }
};
