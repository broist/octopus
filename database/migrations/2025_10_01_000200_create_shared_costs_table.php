<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Közös (céges) költség, amit a tagok osztanak el egymás között: könyvelői
     * díj, szoftver-előfizetés, bank, biztosítás stb.
     *
     * Három forrásból keletkezhet (`source`):
     *  - `pdf`       – a Fájlkezelő figyelt mappájába feltöltött számla PDF-jéből
     *                  automatikusan (a `document_id` mutat a dokumentumra; ez
     *                  egyben az idempotencia kulcsa: egy PDF-ből egy sor),
     *  - `ismetlodo` – ismétlődő sablonból generálva (pl. ChatGPT-előfizetés),
     *  - `kezi`      – kézzel felvett egyéb költség.
     *
     * Deviza: az `amount` mindig a `currency` pénznemében értendő; az egyenlegek
     * közös nevezője a forint, ezért az `amount_huf` = amount × exchange_rate
     * mentéskor rögzül (utólagos árfolyamváltozás nem írja át a múltat).
     */
    public function up(): void
    {
        Schema::create('shared_costs', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('category', 30);                 // MemberLedger::CATEGORIES
            $table->date('period_month')->nullable();        // elszámolási hónap 1. napja
            $table->date('due_on');                          // fizetési határidő
            $table->date('issued_on')->nullable();           // számla kiállítása

            $table->string('currency', 3)->default('HUF');
            $table->decimal('amount', 14, 2);                // bruttó, a saját pénznemében
            $table->decimal('net_amount', 14, 2)->nullable();
            $table->decimal('vat_amount', 14, 2)->nullable();
            $table->decimal('exchange_rate', 14, 6)->default(1);
            $table->decimal('amount_huf', 14, 2);            // felosztás alapja

            $table->string('supplier_name')->nullable();
            $table->string('invoice_number', 80)->nullable();

            $table->string('source', 20)->default('kezi');   // pdf | ismetlodo | kezi
            // Egy dokumentumból legfeljebb egy költség — a mappa-figyelő ebből
            // tudja, hogy egy PDF-et már feldolgozott (a soft delete is számít:
            // a kézzel törölt sort nem hozza vissza).
            $table->foreignId('document_id')->nullable()->unique()
                ->constrained('documents')->nullOnDelete();
            $table->foreignId('recurring_cost_id')->nullable();

            // Ha a PDF-ből valamelyik adat nem volt kiolvasható, a sor létrejön,
            // de „ellenőrizendő” jelzéssel — a felhasználó pótolja a felületen.
            $table->boolean('needs_review')->default(false);
            $table->text('parse_note')->nullable();
            $table->text('note')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['due_on']);
            $table->index(['period_month']);
            $table->index(['source', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shared_costs');
    }
};
