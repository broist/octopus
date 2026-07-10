# 🐙 Octopus — Építőipari projektvezető rendszer

Projektvezető és rendszerező webalkalmazás építőipari cégeknek. Böngészőből,
telefonról és tabletről is használható (PWA), self-hosted Linux szerverre tervezve.

- **Backend:** Laravel 13 (PHP 8.4), Inertia.js 2
- **Frontend:** React 18 + TypeScript + Tailwind CSS + Vite 8
- **Adatbázis:** PostgreSQL 16
- **Cache / queue / session:** Redis 7
- **Fájltárolás:** szerver-lemez (dokumentumok) + S3 (tervrajzok, presigned URL)
- **Auth:** Laravel Fortify + kétfaktoros (2FA) támogatás
- **Jogosultság:** spatie/laravel-permission + felhasználónkénti finomhangolás

## Előfeltétel

Csak **Docker Desktop** szükséges (Windows/macOS/Linux). Minden mást
(PHP, PostgreSQL, Redis, Node) a konténerek biztosítanak.

## Verziópolitika / biztonság

A Laravel **11-es széria kifutott a biztonsági támogatásból**: a CVE-2026-48019
(CRLF injection) a teljes `>=11.0.0,<12.0.0` tartományt érinti, javított 11.x
kiadás nélkül. Ezért a Composer nem is engedi telepíteni. A projekt emiatt a
**Laravel 13** (>= 13.12.0) támogatott, javított ágán fut.

Ellenőrzés:

```bash
docker compose run --rm --no-deps --entrypoint composer app audit
docker compose exec vite npm audit
```

> Megjegyzés: a `laravel/tinker` egyelőre nem támogatja a Laravel 13-at, ezért
> nincs a függőségek között. Amint megjelenik a támogatás, visszatehető.

## Indítás (fejlesztői mód)

```bash
# 1) Környezeti fájl
cp .env.example .env

# 2) Konténerek felépítése és indítása
docker compose up --build
```

Az első indításkor a rendszer automatikusan:

- telepíti a PHP és a Node függőségeket,
- legenerálja az `APP_KEY`-t,
- lefuttatja a migrációkat és a seedelést (jogosultságok + admin felhasználó).

### Elérhető felületek

| Szolgáltatás        | URL                        |
| ------------------- | -------------------------- |
| Alkalmazás          | http://localhost:8080      |
| Vite dev szerver    | http://localhost:5173      |
| Mailpit (e-mailek)  | http://localhost:8025      |
| PostgreSQL          | localhost:5432             |
| Redis               | localhost:6379             |

### Alapértelmezett belépés

```
E-mail:  admin@octopus.local
Jelszó:  octopus
```

> Éles környezetben állítsd be az `OCTOPUS_ADMIN_EMAIL` és
> `OCTOPUS_ADMIN_PASSWORD` értékeket a seedelés előtt.

### Leállítás / újraindítás

```bash
docker compose stop            # leállítás (adatok megmaradnak)
docker compose start           # újraindítás
docker compose down            # konténerek törlése (adatbázis megmarad)
docker compose down -v         # MINDEN törlése, adatbázissal együtt
```

> Az `app` konténer induláskor lefuttatja a migrációkat, ezért a PHP-FPM csak
> ~10–20 másodperc múlva kezd válaszolni. Addig a böngésző **502**-t mutathat —
> frissíts rá néhány másodperc múlva.

## Hasznos parancsok

```bash
# Artisan a konténerben
docker compose exec app php artisan <parancs>

# Migráció újrafuttatása seedeléssel
docker compose exec app php artisan migrate:fresh --seed

# Frontend típusellenőrzés / build
docker compose exec vite npm run types
docker compose exec vite npm run build

# Composer (egyszeri konténerben)
docker compose run --rm --no-deps --entrypoint composer app <parancs>
```

> ⚠️ A `docker/php/entrypoint.sh` és a `Dockerfile` **bele van építve az image-be**.
> Ha ezeket módosítod, kell egy `docker compose build app` is, különben a régi
> változat fut tovább.

## Teljesítmény (fontos Windows/macOS alatt)

A projekt könyvtára bind-mounttal van becsatolva (élő szerkesztéshez), de a
`vendor` és a `node_modules` **named volume-ban** van. Ha ezek is a bind mounton
lennének, a PHP minden kérésnél több tízezer fájlt olvasna vissza a gazdagép
fájlrendszeréről — mérve **~6000 ms** helyett így **~400 ms** egy oldalbetöltés.

Következmény: a `vendor/` és `node_modules/` **nem látszik a gazdagépen**. Ha az
IDE-nek kell (pl. PhpStorm kódkiegészítés), állíts be Docker-alapú távoli PHP
interpretert, vagy vedd ki a named volume sorokat a `docker-compose.yml`-ből.

Mivel a projekt egy **OneDrive-szinkronizált** mappában van, a régi, gazdagépen
maradt `vendor/` és `node_modules/` könyvtárak feleslegesen szinkronizálódnak —
nyugodtan törölhetők (a `.gitignore` amúgy is kizárja őket).

## Projektstruktúra

```
app/                 Laravel alkalmazáslogika (Models, Http, Actions, Support)
  Support/Modules.php  A 16 modul egységes forrása (menü + jogosultságok)
config/              Testreszabott konfiguráció (db, filesystems, fortify, permission)
database/            Migrációk, seederek, factoryk
docker/              Dockerfile, nginx és php beállítások, entrypoint
resources/js/        React + TypeScript frontend (Inertia oldalak)
resources/css/       Tailwind + Octopus design tokenek (fa-gerenda menü, kártyák)
routes/              web.php + modulonkénti route fájlok
```

## Fejlesztési ütemterv (modulok)

A modulok a specifikáció sorrendjében épülnek (1 → 16), a Számlázz.hu Számla
Agent integráció szándékosan a legutolsó lépés.

| # | Modul | Állapot |
|---|-------|---------|
| — | Alap (Docker, Laravel, design rendszer, auth, jogosultság) | ✅ kész |
| 1 | Vezérlőpult | ⬜ |
| 2 | Projektek / Munkák | ⬜ |
| 3 | Ütemezés / Naptár | ⬜ |
| 4 | Ügyfelek és partnerek (CRM) | ⬜ |
| 5 | Alvállalkozók | ⬜ |
| 6 | Munkatársak / Erőforrások | ⬜ |
| 7 | Gépek és eszközök | ⬜ |
| 8 | Anyagok / Készlet | ⬜ |
| 9 | Pénzügy / Költségvetés | ⬜ |
| 10 | Dokumentumtár | ⬜ |
| 11 | Napi jelentés / Munkanapló | ⬜ |
| 12 | Minőségbiztosítás / Munkavédelem | ⬜ |
| 13 | Feladatok / To-do | ⬜ |
| 14 | Kommunikáció | ⬜ |
| 15 | Riportok / Statisztikák | ⬜ |
| 16 | Felhasználók / Jogosultságok | ⬜ |
| 17 | Számlázz.hu integráció | ⬜ (legutolsó) |
