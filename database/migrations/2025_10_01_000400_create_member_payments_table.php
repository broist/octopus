<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tagi kölcsön befizetés: egy tag pénzt utal a céges bankszámlára.
     *
     * Ez az EGYETLEN forrása annak, hogy „ki mennyit fizetett be” — a
     * kötelezettség oldala a shared_cost_shares. A tag egyenlege ebből a
     * kettőből áll elő (befizetve − rá eső rész).
     *
     * A `shared_cost_id` opcionális: ha ki van töltve, a befizetés egy konkrét
     * költséghez tartozik (így látszik, ki rendezte már az adott számlát); ha
     * üres, általános tagi kölcsön befizetés.
     */
    public function up(): void
    {
        Schema::create('member_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_member_id')->constrained('company_members')->cascadeOnDelete();
            $table->foreignId('shared_cost_id')->nullable()->constrained('shared_costs')->nullOnDelete();
            $table->date('paid_on');
            $table->string('currency', 3)->default('HUF');
            $table->decimal('amount', 14, 2);
            $table->decimal('exchange_rate', 14, 6)->default(1);
            $table->decimal('amount_huf', 14, 2);
            $table->string('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['company_member_id', 'paid_on']);
            $table->index(['shared_cost_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('member_payments');
    }
};
