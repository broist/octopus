<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Fájlkezelő / Dokumentumtár (spec §10): a dokumentum a logikai egység,
        // a tényleges fájlok verziókként kapcsolódnak hozzá — új tervverziónál
        // a régi nem vész el, de egyértelmű, melyik az aktuális.
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->string('title', 200);
            // terv / engedely / szerzodes / teljesitesigazolas / foto / egyeb
            $table->string('category', 30)->index();

            // Kapcsolatok (spec: "köthető projekthez, megrendelőhöz, alvállalkozóhoz,
            // géphez" — a gép-kapcsolat a Gépek modullal együtt érkezik).
            $table->foreignId('project_id')->nullable()
                ->constrained('projects')->nullOnDelete();
            $table->foreignId('partner_id')->nullable()
                ->constrained('partners')->nullOnDelete();

            $table->text('description')->nullable();
            $table->foreignId('uploaded_by')->nullable()
                ->constrained('users')->nullOnDelete();

            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('document_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('version_number');
            $table->boolean('is_current')->default(false);

            // Hibrid tárolás (spec §10): 'documents' = szerver-lemez,
            // 'plans' = S3 (presigned URL-lel nyílik meg).
            $table->string('disk', 20);
            $table->string('file_path');
            $table->string('original_filename');
            $table->string('mime_type', 120)->nullable();
            $table->unsignedBigInteger('size_bytes')->default(0);

            $table->string('note', 500)->nullable(); // mi változott ebben a verzióban
            $table->foreignId('uploaded_by')->nullable()
                ->constrained('users')->nullOnDelete();

            $table->timestamps();

            $table->unique(['document_id', 'version_number']);
            $table->index(['document_id', 'is_current']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_versions');
        Schema::dropIfExists('documents');
    }
};
