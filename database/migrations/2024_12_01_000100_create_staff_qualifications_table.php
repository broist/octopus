<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Munkatársi végzettségek / jogosultságok (spec §5/6): szakképesítések,
     * tanúsítványok, gépkezelői jogosítványok, munkavédelmi oktatás — lejárati
     * figyelmeztetéssel (`valid_until`). Az alvállalkozói tanúsítványok mintája,
     * opcionális csatolt fájllal (hibrid tárolás).
     */
    public function up(): void
    {
        Schema::create('staff_qualifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('type', 40);
            $table->string('name');
            $table->string('issuer')->nullable();
            $table->date('valid_from')->nullable();
            $table->date('valid_until')->nullable();
            $table->text('note')->nullable();

            // Opcionális csatolt fájl (Document::diskFor – hibrid S3/local).
            $table->string('disk', 30)->nullable();
            $table->string('file_path')->nullable();
            $table->string('original_filename')->nullable();
            $table->string('mime_type', 120)->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();

            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['user_id', 'valid_until']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('staff_qualifications');
    }
};
