<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Hibához csatolt fotó (spec §12: fotós dokumentálás). A napló-fotók
     * mintájára, hibrid tárolással; a document_id a Fájlkezelő tükör-dokumentumát
     * köti (a fotók a Dokumentumtárba is bekerülnek).
     */
    public function up(): void
    {
        Schema::create('defect_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('defect_id')->constrained('defects')->cascadeOnDelete();
            $table->string('disk', 32);
            $table->string('file_path');
            $table->string('original_filename');
            $table->string('mime_type', 128)->nullable();
            $table->unsignedBigInteger('size_bytes')->default(0);
            $table->foreignId('document_id')->nullable()->constrained('documents')->nullOnDelete();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('defect_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('defect_photos');
    }
};
