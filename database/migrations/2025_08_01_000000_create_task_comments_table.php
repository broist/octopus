<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Feladat-idővonal: hozzászólások és rendszeresemények (státuszváltás)
        // egy táblában, hogy időrendben egyetlen folyamként legyenek olvashatók.
        Schema::create('task_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();

            $table->string('kind', 20)->default('comment');   // comment / status
            $table->text('body')->nullable();                 // hozzászólás szövege
            $table->string('from_status', 20)->nullable();     // státuszváltásnál
            $table->string('to_status', 20)->nullable();

            $table->timestamps();
            $table->index(['task_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_comments');
    }
};
