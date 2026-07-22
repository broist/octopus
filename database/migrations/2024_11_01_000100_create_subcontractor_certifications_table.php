<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Alvállalkozói jogi/adminisztratív dokumentumok (spec §5/5): szerződés,
     * felelősségbiztosítás, engedélyek/tanúsítványok, kamarai regisztráció —
     * lejárati figyelmeztetéssel (a `valid_until` alapján). Opcionálisan a
     * dokumentum fájlja is csatolható (a TaskAttachment disk-mintája).
     */
    public function up(): void
    {
        Schema::create('subcontractor_certifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('partner_id')->constrained('partners')->cascadeOnDelete();
            $table->string('type', 40);
            $table->string('name');
            $table->string('issuer')->nullable();
            $table->date('valid_from')->nullable();
            $table->date('valid_until')->nullable();
            $table->text('note')->nullable();

            // Opcionális csatolt fájl (hibrid tárolás – Document::diskFor).
            $table->string('disk', 30)->nullable();
            $table->string('file_path')->nullable();
            $table->string('original_filename')->nullable();
            $table->string('mime_type', 120)->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();

            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['partner_id', 'valid_until']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subcontractor_certifications');
    }
};
