<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Karbantartási előzmény (spec §7): mikor mit javítottak/szervizeltek,
     * opcionálisan költséggel. A szervizlap/számla fájlja is csatolható
     * (hibrid S3/local tárolás — Document::diskFor, a TaskAttachment mintája).
     */
    public function up(): void
    {
        Schema::create('machine_maintenances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('machine_id')->constrained('machines')->cascadeOnDelete();
            $table->string('type', 30);                          // szerviz | javitas | vizsga | egyeb
            $table->date('performed_on');
            $table->text('description');
            $table->decimal('cost', 12, 2)->nullable();          // opcionális költség (HUF)

            // Opcionális csatolt fájl (szervizlap, számla).
            $table->string('disk', 30)->nullable();
            $table->string('file_path')->nullable();
            $table->string('original_filename')->nullable();
            $table->string('mime_type', 120)->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['machine_id', 'performed_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('machine_maintenances');
    }
};
