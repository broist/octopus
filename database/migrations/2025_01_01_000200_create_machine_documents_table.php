<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Géphez csatolt dokumentumok (spec §7): gépkönyv, biztosítás,
     * vizsgadokumentumok, számla — a SubcontractorDocument mintájára,
     * hibrid S3/local tárolással.
     */
    public function up(): void
    {
        Schema::create('machine_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('machine_id')->constrained('machines')->cascadeOnDelete();
            $table->string('category', 40);                      // Machines::DOC_CATEGORIES
            $table->string('disk', 30);
            $table->string('file_path');
            $table->string('original_filename');
            $table->string('mime_type', 120)->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('machine_documents');
    }
};
