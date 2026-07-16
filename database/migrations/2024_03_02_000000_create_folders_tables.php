<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Fájlkezelő mappastruktúra: tisztán logikai fa (a fájlok fizikai
        // helye nem változik mozgatáskor).
        Schema::create('folders', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->foreignId('parent_id')->nullable()
                ->constrained('folders')->nullOnDelete();

            // Korlátozott mappa: csak a folder_user-ben felsoroltak (és az
            // IT Admin) látják — a korlátozás lefelé öröklődik.
            $table->boolean('is_restricted')->default(false);

            $table->foreignId('created_by')->nullable()
                ->constrained('users')->nullOnDelete();

            $table->timestamps();
            $table->softDeletes();

            $table->index('parent_id');
        });

        // Mappa-hozzáférések: view = megtekintés/letöltés, edit = teljes
        // kezelés a mappán belül (feltöltés, átnevezés, mozgatás, törlés).
        Schema::create('folder_user', function (Blueprint $table) {
            $table->foreignId('folder_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('access', 10)->default('view');
            $table->primary(['folder_id', 'user_id']);
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->foreignId('folder_id')->nullable()->after('category')
                ->constrained('folders')->nullOnDelete();
            $table->index('folder_id');
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropConstrainedForeignId('folder_id');
        });
        Schema::dropIfExists('folder_user');
        Schema::dropIfExists('folders');
    }
};
