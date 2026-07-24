<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A napi jelentéshez csatolt helyszíni fotók (spec §11 + §10): a
     * TaskAttachment mintájára, hibrid tárolással (S3/local). A fotók a
     * Dokumentumtárba is bekerülnek, projekthez rendelve — ezt a document_id
     * köti a Fájlkezelő megfelelő dokumentumához (Document + DocumentVersion).
     */
    public function up(): void
    {
        Schema::create('daily_report_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('daily_report_id')->constrained('daily_reports')->cascadeOnDelete();

            $table->string('disk', 32);
            $table->string('file_path');
            $table->string('original_filename');
            $table->string('mime_type', 128)->nullable();
            $table->unsignedBigInteger('size_bytes')->default(0);

            // Tükrözés a Fájlkezelőbe (spec §10: a helyszíni fotók ide is begyűlnek).
            $table->foreignId('document_id')->nullable()->constrained('documents')->nullOnDelete();

            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('daily_report_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_report_photos');
    }
};
