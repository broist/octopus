<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Ütemezés / Naptár (spec §5/3): beosztások, szállítások, események és
        // személyes bejegyzések. A projekt-mérföldkövek és feladat-határidők
        // nem itt tárolódnak — azokat a naptár a saját moduljukból olvassa.
        Schema::create('calendar_events', function (Blueprint $table) {
            $table->id();
            $table->string('title', 200);
            // beosztas (munkavégzés) / szallitas / esemeny / szemelyes
            $table->string('type', 20)->index();

            $table->foreignId('project_id')->nullable()
                ->constrained('projects')->nullOnDelete();

            // Nap-alapú ütemezés (több napos is lehet), opcionális időponttal.
            $table->date('starts_on');
            $table->date('ends_on');
            $table->time('start_time')->nullable();
            $table->time('end_time')->nullable();

            $table->string('location', 200)->nullable();
            $table->text('note')->nullable();

            $table->foreignId('created_by')->nullable()
                ->constrained('users')->nullOnDelete();

            $table->timestamps();

            $table->index(['starts_on', 'ends_on']);
        });

        // Résztvevők / beosztott munkatársak.
        Schema::create('calendar_event_user', function (Blueprint $table) {
            $table->foreignId('calendar_event_id')
                ->constrained('calendar_events')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->primary(['calendar_event_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('calendar_event_user');
        Schema::dropIfExists('calendar_events');
    }
};
