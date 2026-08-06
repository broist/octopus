<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A cég tagjai (tulajdonosai), akik között a közös költségek megoszlanak,
     * és akik tagi kölcsönként fizetnek be a céges bankszámlára.
     *
     * A `user_id` opcionális: a tagnak nem kell Octopus-fiókkal rendelkeznie,
     * de ha van, akkor ő látja a saját egyenlegét és kap harang-értesítést.
     * A `default_share` az alapértelmezett részesedés százalékban — ebből
     * készül minden új költség felosztása (a költségen felül is felülírható).
     */
    public function up(): void
    {
        Schema::create('company_members', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('default_share', 6, 3)->default(0);   // százalék, pl. 30.000
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['is_active', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_members');
    }
};
