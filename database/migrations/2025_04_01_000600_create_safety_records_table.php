<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Munkavédelmi nyilvántartás (spec §12): oktatások, bejárások dátuma,
     * esemény-/baleseti napló. Opcionálisan projekthez köthető.
     */
    public function up(): void
    {
        Schema::create('safety_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->string('type', 20)->default('oktatas'); // Qa::SAFETY_TYPES
            $table->date('occurred_on');
            $table->string('title');
            $table->text('description')->nullable();
            $table->text('participants')->nullable(); // résztvevők (szabad szöveg)
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['type', 'occurred_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('safety_records');
    }
};
