# Kestrel Field Ops – Airbase Manager

Indie-Browserspiel im Pixel-Look: Du sitzt im Operations-Büro einer Airbase, schaust aus dem Fenster auf Startbahn 27 und managst alles über die Dokumente und das Terminal auf deinem Schreibtisch.

Eine einzige HTML-Datei, kein Server, kein Account. Der Spielstand liegt im `localStorage` des Browsers.

## Spielen

- `index.html` im Browser öffnen, fertig.
- Online über **GitHub Pages**: Repo → Settings → Pages → Source „Deploy from a branch“ → Branch `main`, Ordner `/ (root)`. Danach läuft das Spiel unter `https://gloprglirp.github.io/AirbaseManager/`.

Leertaste pausiert, Tasten 1–4 ändern das Tempo.

## Modi

- **Kampagne:** Früh-, Spät- und Nachtschicht (je 8 Spielstunden) mit 3 Zielen pro Schicht. Schichtbericht mit XP und Budget-Bonus, Beförderungen vom Second Lieutenant bis zum Brigadier General. Flugzeuge, Ausbauten und Ausbildung werden mit dem Rang freigeschaltet.
- **Free Play:** keine Schichten, alles von Anfang an verfügbar.

## Inhalt

- **Fenster:** Jets rollen, starten mit Nachbrenner und landen; C-130 bringt Nachschub; Tag/Nacht, Wetter, Luftangriffe; Hangars mit Baukran; Patriot- und Avenger-Starts. Gerendert in niedriger Auflösung mit begrenzter Palette und Dithering.
- **Tasking:** CAP, Strike, Recon, Intercept mit Taktik (Aggression, Formation, ROE, Flughöhe).
- **Flightline:** Tanken, Bewaffnen, Reparieren, Turnaround, Pilotentausch.
- **Supply:** JP-8, AIM-120, AIM-9X, AGM-65, GBU-12, 20mm, Chaff, Flares, Ersatzteile, PAC-3, Stinger.
- **Base:** Hangars, Patriot-Batterie, Avenger SHORAD, Tanklager, Munitionsbunker, Crew-Unterkünfte; Bodencrews und Ersatzpiloten ausbilden; Flugzeuge kaufen (F-16C, F-15E, F/A-18E, A-10C, F-35A, KC-135R, E-3G).
- **Career:** Rang, XP, laufende Schichtziele, Rangleiter mit Freischaltungen.
- **Tac map:** Papierkarte mit Flügen, Raids und Einsätzen; Taktik im Flug ändern, Tanker, Rückruf.
- **Sound:** synthetisch per Web Audio (Triebwerke, Funk, Alarm, Explosionen, Donner).

## Aufbau

Der Code liegt in Teilen unter `src/`, `build.sh` setzt daraus `index.html` zusammen:

| Datei | Inhalt |
|---|---|
| `01-head.html` | Titel, Schriften, CSS |
| `02-body.html` | Raum, Fenster, Klemmbrett |
| `03-data.js` | Daten: Ressourcen, Flugzeugtypen, Ausbauten, Spielstand |
| `04-sim-ground.js` | Bodencrews, Logistik, Startbahn, Rollwege |
| `05-sim-air.js` | Flüge, Luftkampf, SAMs, Raids, Einsätze, Spielschritt |
| `10-sim-base.js` | Bau, Ausbildung, Beschaffung |
| `13-campaign.js` | Kampagne: Schichten, Ziele, XP, Ränge, Freischaltungen |
| `06/07/12-scene-*.js` | Fensteransicht (Canvas) |
| `14-pixel.js` | Pixel-Look: Palette und Dithering der Fensteransicht |
| `08-ui-panels.js`, `09-ui-main.js` | Terminal, Tac Map, Eingabe, Hauptschleife |
| `11-audio.js` | Sound |

Nach Änderungen in `src/`:

```bash
./build.sh
```

Schriften: Jersey 10, Pixelify Sans und Silkscreen von Google Fonts (SIL Open Font License).
