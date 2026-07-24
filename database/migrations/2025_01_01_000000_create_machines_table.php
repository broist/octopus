<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Gépek és eszközök törzse (spec §7): nagyobb gépek és értékesebb eszközök
     * nyilvántartása — kéziszerszám tételes követése NEM cél. Törzsadat + aktuális
     * hely/státusz + felelős személy, valamint a két lejárati figyeléssel követett
     * dátum: következő esedékes szerviz és a műszaki vizsga/érvényesség vége.
     * A foglalás, a karbantartási előzmény és a dokumentumok külön táblákban.
     */
    public function up(): void
    {
        Schema::create('machines', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('kind', 40)->nullable();              // kategória (Machines::KINDS)
            $table->string('identifier', 120)->nullable();       // azonosító / rendszám
            $table->unsignedSmallInteger('manufacture_year')->nullable(); // gyártási év
            $table->date('purchased_on')->nullable();            // beszerzés dátuma
            $table->string('ownership', 20)->default('sajat');   // sajat | berelt
            $table->string('rental_source')->nullable();         // ha bérelt: kitől (opcionális)

            $table->string('status', 20)->default('szabad');     // szabad | hasznalatban | szervizben
            $table->string('location')->nullable();              // aktuális hely / telephely
            $table->foreignId('responsible_user_id')->nullable() // felelős / kezelő (opcionális)
                ->constrained('users')->nullOnDelete();

            // Lejárati figyeléssel követett dátumok (Dashboard + notifications:deadlines).
            $table->date('next_service_on')->nullable();         // következő esedékes szerviz
            $table->date('inspection_valid_until')->nullable();  // műszaki vizsga / érvényesség

            $table->text('note')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
            $table->index('next_service_on');
            $table->index('inspection_valid_until');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('machines');
    }
};
