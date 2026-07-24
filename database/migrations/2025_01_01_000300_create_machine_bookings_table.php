<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Gépfoglalás / beosztás (spec §7 + §3): melyik gép mikor melyik projekten
     * van lefoglalva. Megjelenik az Ütemezés naptárban (csak-olvasható réteg),
     * és ütközés-jelzést ad, ha ugyanaz a gép átfedő időszakra van foglalva.
     */
    public function up(): void
    {
        Schema::create('machine_bookings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('machine_id')->constrained('machines')->cascadeOnDelete();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->date('starts_on');
            $table->date('ends_on');
            $table->text('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['machine_id', 'starts_on', 'ends_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('machine_bookings');
    }
};
