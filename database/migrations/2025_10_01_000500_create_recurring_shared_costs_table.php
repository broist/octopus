<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Ismétlődő közös költség sablonja (pl. ChatGPT-előfizetés: minden hónap
     * 7-én esedékes, és csak három tagot érint). Az ütemező havonta egyszer
     * legyártja belőle a konkrét shared_costs sort.
     *
     * A résztvevők és a százalékaik JSON-ban vannak — ez sablon, nem főkönyv:
     * [{"member_id": 1, "percent": 33.333}, …]. Ha üres, a tagok
     * alapértelmezett részesedése (company_members.default_share) érvényes.
     */
    public function up(): void
    {
        Schema::create('recurring_shared_costs', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('category', 30);
            $table->string('currency', 3)->default('HUF');
            $table->decimal('amount', 14, 2);
            $table->decimal('exchange_rate', 14, 6)->default(1);
            $table->unsignedTinyInteger('due_day')->default(1);   // a hónap hányadikán esedékes
            $table->date('start_month')->nullable();              // ettől a hónaptól generál
            $table->boolean('is_active')->default(true);
            $table->jsonb('shares')->nullable();
            $table->date('last_period')->nullable();              // utoljára legenerált hónap
            $table->text('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recurring_shared_costs');
    }
};
