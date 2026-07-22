<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Alvállalkozóhoz csatolt dokumentumok (spec §5/5): alvállalkozói
     * szerződések, teljesítésigazolások, bejövő számláik, egyéb. A
     * TaskAttachment tábla mása — hibrid S3/local tárolás (Document::diskFor).
     */
    public function up(): void
    {
        Schema::create('subcontractor_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('partner_id')->constrained('partners')->cascadeOnDelete();
            $table->string('category', 40)->default('egyeb');
            $table->string('disk', 30)->default('documents');
            $table->string('file_path');
            $table->string('original_filename');
            $table->string('mime_type', 120)->nullable();
            $table->unsignedBigInteger('size_bytes')->default(0);
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('partner_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subcontractor_documents');
    }
};
