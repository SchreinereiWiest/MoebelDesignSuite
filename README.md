# Möbel Design Suite

Grundgerüst für eine Bildbibliothek mit Sammlungen und frei positionierbaren Moodboards. Das Repository trennt das Vite/React-Frontend von API und Worker im Node.js-Backend.

## Enthalten

- React 19, TypeScript, Vite und Tailwind CSS 4
- shadcn/ui-Struktur mit Radix UI, Lucide, React Hook Form und Zod
- React Router mit Carpenters-Anmeldung, geschützten Arbeitsbereichen und Rollenprüfung
- dnd-kit für sortierbare Sammlungen
- react-konva/Konva für die spätere freie Moodboard-Fläche
- Express-API mit Helmet, CORS und validierten Umgebungsvariablen
- Prisma ORM 7.10.1 mit PostgreSQL-Treiberadapter und initialer Migration
- privater Garage-S3-Speicher mit Presigned Upload-/Download-URLs
- BullMQ auf Valkey für Sharp-Bildverarbeitung, WebP-Vorschauen und technische Tags
- Docker Compose für Frontend, API, Worker, Migration, PostgreSQL und Valkey mit Traefik-Routing

## Design Suite

Die Anwendung unter `/` enthält die vollständigen Arbeitsbereiche für den Gestaltungsprozess:

- **Übersicht:** Kennzahlen, zuletzt hinzugefügte Inspirationen und aktuelle Moodboards
- **Inspiration Library:** Suche, kombinierbare Filter, Freigabestufen, Upload und Metadatenpflege
- **Design Explorer:** geführte Auswahl von Raum, Möbel, Material, Farbe, Stil und Details mit exakten oder ähnlichen Treffern
- **Moodboards:** Sammlungen als Galerie oder frei positionierbare Pinnwand mit Größe, Drehung, Notizen und Bewertungen
- **Kundenberatung:** gemeinsame Gefällt-/Gefällt-nicht-Bewertung und automatisch strukturiertes Designbriefing

Die Anmeldung verwendet den bestehenden Carpenters-Identitätsdienst im privaten Docker-Netzwerk. Firma, Benutzer, aktive Mitgliedschaft und Rolle werden dadurch weiterhin aus der Carpenters-Benutzerdatenbank bezogen; Passwörter oder Carpenters-JWTs sind nie für JavaScript lesbar. Die Design Suite prüft zusätzlich eine eigene Lizenz mit der Produkt-ID `moebel-design-suite`.

Rollen werden auch im Backend durchgesetzt:

- `admin`: Upload/Bildverwaltung, Firmeneinstellungen, Lizenzaktivierung und Tag-Vorschläge
- `manager`: Upload/Bildverwaltung und lesbare Lizenzinformationen
- `user`: Nutzung von Explorer, Bibliothek und persönlichen Moodboards
- `public`: vorbereitete Endkundenrolle; ausschließlich öffentlich freigegebene Bilder und Gestaltungsfunktionen

Bildfreigaben sind mandantenbezogen: `PRIVATE` bleibt bei der Eigentümerfirma, `RESTRICTED` ist für andere Firmen sichtbar und `PUBLIC` später auch für öffentliche Endkunden. Für beide externen Stufen ist eine ausdrückliche Bestätigung der Bildrechte erforderlich.

Der globale Tagkatalog speichert kanonische Tags und eindeutige Aliase. Tenant-Admins reichen neue Begriffe zunächst als Vorschlag ein; ähnliche Begriffe werden tenantübergreifend angezeigt. Nur konfigurierte globale Kuratoren können Vorschläge freigeben oder mit einem bestehenden Tag zusammenführen.

Die API wurde dafür um folgende Bereiche erweitert:

- `GET/PATCH/DELETE /api/images/:id` für Bilddetails und Verwaltung
- Mehrfach-Tag-, Sichtbarkeits- und Ähnlichkeitsfilter auf `GET /api/images`
- `GET /api/tags` für kategorisierte Merkmale und Trefferzahlen
- `GET /api/tags/suggestions` und `POST /api/tags/proposals` für den globalen Tagabgleich
- `GET/POST/PATCH/DELETE /api/collections` für Moodboards
- `POST /api/collections/:id/items` sowie `PATCH/DELETE /api/collections/:id/items/:itemId` für Positionen, Notizen und Bewertungen

Vor dem ersten Start mit dem erweiterten Modell muss die neue Prisma-Migration eingespielt werden. Im Compose-Setup erledigt dies der `migrate`-Dienst automatisch.

## Schnellstart mit lokalen Infrastruktur-Containern

Voraussetzungen: Docker mit Compose-Plugin, eine laufende Traefik-Instanz und ein erreichbarer Garage-S3-Endpunkt. Traefik muss den Docker-Provider verwenden und mit dem in `TRAEFIK_NETWORK` eingetragenen externen Netzwerk verbunden sein.

```bash
cp .env.example .env
```

Danach in `.env` mindestens folgende Werte anpassen:

- `APP_HOST` auf die öffentliche Domain
- `CORS_ORIGIN` auf `https://<APP_HOST>`
- `TRAEFIK_NETWORK`, `TRAEFIK_HTTP_ENTRYPOINT`, `TRAEFIK_ENTRYPOINT` und `TRAEFIK_CERT_RESOLVER` passend zur vorhandenen Traefik-Instanz
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` und `S3_SECRET_ACCESS_KEY` auf den vorgesehenen Garage-Bucket
- `CARPENTERS_API_URL=http://backendjs:5000` für den internen Identitätsdienst
- `LICENSE_SERVER_URL=http://licensing-api:5100` und `LICENSE_SERVER_API_KEY` passend zum Lizenzserver-Client
- `SESSION_SECRET` mit mindestens 32 zufälligen Zeichen
- optional `PUBLIC_LOGIN_KEY` mit mindestens 24 zufälligen Zeichen und `GLOBAL_TAG_CURATOR_USER_IDS`

Die Dienste `backendjs`, `licensing-api` und die Suite-API müssen im externen Docker-Netzwerk `MoebelDesign` hängen. Der zentrale Lizenzdatensatz muss für dieselbe Carpenters-`tenantId` das Produkt `moebel-design-suite` enthalten. Die Module `public-content` und `moodboards` werden getrennt geprüft; eine Firma kann daher nur die Design Suite oder zusätzlich Carpenters Production lizenzieren.

Ein öffentlicher Login-Link hat beispielsweise die Form:

```text
http://suite.localhost/login?publicKey=<PUBLIC_LOGIN_KEY>
```

Der Key wird einmalig serverseitig geprüft, gegen ein kurzlebiges HttpOnly-Cookie ausgetauscht und sofort aus der Browseradresse entfernt. Die separate öffentliche Benutzerdatenbank ist bewusst noch nicht angebunden; das Panel zeigt diesen Zustand entsprechend an.

Das in `TRAEFIK_NETWORK` konfigurierte Docker-Netzwerk muss bereits existieren. Anschließend:

```bash
docker compose up --build
```

Die Anwendung ist anschließend unter `https://<APP_HOST>` erreichbar. Traefik leitet `/api` direkt an den API-Container und alle anderen Pfade an das Frontend weiter; HTTP-Aufrufe werden dauerhaft auf HTTPS umgeleitet. API und Frontend veröffentlichen keine direkten Host-Ports. Der einmalige `migrate`-Container spielt vor API und Worker die Prisma-Migration ein.

Das Frontend läuft im Compose-Verbund im Vite-Entwicklungsmodus auf Port `5173`. `./frontend` wird nach `/app` gemountet, während die Container-Abhängigkeiten in einem separaten Volume unter `/app/node_modules` bleiben. Änderungen an React-, TypeScript- oder CSS-Dateien werden dadurch ohne Image-Neubau per Hot Module Replacement übernommen.

Nach Änderungen an `package.json` oder `package-lock.json` muss das Frontend-Image samt Abhängigkeits-Volume neu erzeugt werden:

```bash
docker compose up -d --build --renew-anon-volumes frontend
```

Der konfigurierte Certificate Resolver muss bereits in Traefik existieren. Traefik selbst ist bewusst nicht Teil dieser Compose-Datei.

## Carpenters-PostgreSQL und -Valkey verwenden

Wenn die bestehenden Dienste über normale Hostnamen oder IPs erreichbar sind, genügen passende `DATABASE_URL`, `DIRECT_DATABASE_URL` und `VALKEY_URL` in `.env`. Starte dann nur die Anwendungsdienste:

```bash
docker compose up -d --build migrate api worker frontend
```

Werden PostgreSQL und Valkey nur über Containernamen in einem vorhandenen Docker-Netzwerk aufgelöst, `CARPENTERS_NETWORK` setzen und das Overlay verwenden:

```bash
docker compose -f compose.yaml -f compose.external.yaml up -d --build migrate api worker frontend
```

Für einen bestehenden PostgreSQL-Cluster sollte eine eigene Datenbank oder mindestens ein eigenes Schema samt eingeschränktem Benutzer angelegt werden. Zeigt `DATABASE_URL` auf PgBouncer, gehört die direkte Verbindung für Migrationen in `DIRECT_DATABASE_URL`.

## Garage vorbereiten

Der Bucket bleibt privat. Die Zugangsdaten benötigen mindestens Rechte zum Auflisten/Prüfen des Buckets sowie zum Lesen und Schreiben von Objekten. `S3_AUTO_CREATE_BUCKET=false` ist für einen zentral verwalteten Produktions-Bucket empfohlen; bei `true` versucht die API einen fehlenden Bucket selbst anzulegen.

Da der Browser direkt über Presigned URLs hochlädt, muss Garage CORS für die Frontend-Origin erlauben:

- Methoden: `PUT`, `GET`, `HEAD`
- Request-Header: mindestens `Content-Type`
- Origin: die reale Frontend-Domain, nicht pauschal `*` in Produktion

In PostgreSQL werden ausschließlich Object Keys wie `images/<uuid>/original/<datei>` und `images/<uuid>/variants/thumbnail.webp` gespeichert. Kurzlebige URLs erzeugt die API erst bei Bedarf.

## Lokale Entwicklung ohne Docker für App-Prozesse

PostgreSQL, Valkey und Garage müssen erreichbar sein; die zentrale `.env` liegt im Repository-Stamm.

```bash
cd backend
npm run db:deploy
npm run dev
```

In einem zweiten Terminal:

```bash
cd backend
npm run dev:worker
```

Und für das Frontend:

```bash
cd frontend
npm run dev
```

Vite liest die zentrale `.env` über `envDir` und leitet `/api` im Entwicklungsmodus an `VITE_DEV_API_PROXY` weiter.

## Upload-Ablauf

1. `POST /api/images/presign` mit `filename`, `contentType` und `size` legt einen Datensatz an und liefert eine PUT-URL.
2. Der Browser lädt die Datei mit dem gelieferten `Content-Type` direkt nach Garage.
3. `POST /api/images/:id/complete` prüft das Objekt und stellt einen BullMQ-Job ein.
4. Der Worker liest das Original, korrigiert EXIF-Orientierung, erzeugt Thumbnail und Preview als WebP und speichert Dimensionen, Metadaten und technische Tags.
5. `GET /api/images` liefert paginierte und nach Status, Tag oder Dateiname filterbare Datensätze mit signierten Thumbnail-URLs.

Die aktuelle Auto-Tagging-Stufe erzeugt Format- und Ausrichtungs-Tags. Ein ML-Modell kann später im Worker ergänzt werden, ohne den Upload-Ablauf zu ändern.

## Wichtige Befehle

```bash
cd frontend && npm run build
cd backend && npm run build
cd backend && npm run db:migrate
cd backend && npm run storage:ensure-bucket
MDS_ENV_FILE=.env.example docker compose --env-file .env.example config
```

`npm run db:migrate` ist für lokale Schemaentwicklung. In Deployment/Compose wird ausschließlich `prisma migrate deploy` verwendet.
