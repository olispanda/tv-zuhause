# UI-Kit: Dock, Icons und Material-3-Look

Diese Seite erklärt, wie Dock, Icons und das Material-3-Design (M3) in CleanFrame zusammenhängen und wo du was anpasst, ohne zu raten. Sie gilt für den Launcher (`app/`) und das Standby-Dashboard (`app/standby/`).

## Überblick: welche Datei macht was

| Datei | Inhalt | Anfassen für … |
| --- | --- | --- |
| `app/m3.css` | M3-Schicht: Farbrollen, Formen, Zustände, Elevation, **Komponenten-Tokens** | Look: Farben, Ecken, Fokus, Avatar |
| `app/assets/palette.js` | schaltet Tag/Nacht-Palette (`html.pal-day` / `html.pal-night`) nach dem Sonnenstand | Standort, Schwelle, Vorschau `?theme=day` |
| `app/style.css` | Grundlayout: Positionen, Grössen, Abstände, Glas-Materialien | nur mit Geometrie-Checks (s. unten) |
| `app/main.js` → `DOCK_MODES` | Kachelbreite/-höhe und Abstand (`pitch`) im Dock je Modus | Dock-Grösse |
| `app/assets/icons/` | monochrome Markensymbole (SVG) + `metrics.js` | neue Icons |
| `app/device.js` | erkennt installierte Apps und ordnet Marken zu | Marken-Zuordnung |
| `app/local-config.js` | **deine** Haushaltswerte (nicht in Git) | Eingangsnamen, Zusatzmarken, Standort |
| `app/standby/style.css`, `app/standby/js/config.js` | Standby-Dashboard: Komponenten bzw. Farben/Themes | Dashboard-Look |
| `app/standby/js/local-config.js` | Zuhause-Koordinate (nicht in Git) | Zuhause |

## Das Icon-System

1. **Symbole** liegen als weisse, einfarbige SVGs in `app/assets/icons/<id>.svg`. Die Farbe kommt zur Laufzeit aus CSS: Das SVG wird als Maske benutzt (`mask-image`) und mit `currentColor` gefüllt. Darum funktioniert jedes Symbol in Tag/Nacht, Hell/Dunkel und im Fokus automatisch.
2. **Metriken**: `app/assets/icons/metrics.js` enthält für jedes SVG den gemessenen sichtbaren Bereich und die Tintenmenge. Damit zentriert `markHtml()` in `main.js` jedes Symbol optisch und gleicht dünne und volle Marken in der Grösse an. Der TV misst nichts selbst.
3. **Registry**: Eine Marke gilt genau dann, wenn ihr Eintrag in `metrics.js` steht (`markId()` in `main.js`). Die Utility-Umrisse `apps`, `art`, `home` und `settings` sind ausgenommen. Es gibt keine zweite Liste mehr, die man nachpflegen muss.
4. **Zuordnung App → Marke** (`device.js`):
   - Die neun Standard-Apps über ihre feste native ID (`IDS`), dabei ist `id` = Marke.
   - Zusatzmarken über die native App-ID (`EXTRA_BRANDS`), z.B. Spotify, HBO Max, Tubi.
   - Über den exakten App-Namen (`NAME_BRANDS`), wenn die ID je nach Region variiert, z.B. `plex`.
   - Haushaltseigene Zuordnungen kommen über `brands` in `app/local-config.js`.
   - Die gefundene Marke landet als `brand`/`mark` am App-Eintrag und wird mit den Home-Einstellungen gespeichert.
5. **Fallback**: Apps ohne Marke bekommen einen **Tonal-Avatar**: das Initial auf einer abgerundeten Fläche in der aktuellen Schriftfarbe, gleich gross wie die Marken. Auf Home (Dock und Liste) bleibt er einfarbig. In „All apps“ und im Editor liegt das TV-eigene App-Icon darüber, sobald es lädt.

### Neues Icon hinzufügen (Beispiel Plex)

1. Quelle wählen, bevorzugt [Simple Icons](https://simpleicons.org) (CC0) oder Custom Brand Icons (MIT). Keine selbst erfundenen Monogramme.
2. SVG als `app/assets/icons/<id>.svg` speichern und `fill="white"` auf das `<svg>`-Element setzen. Keine Farben, Verläufe oder Hintergrundkacheln. Ist die Wortmarke sehr breit, darf ein erkennbarer Teilpfad genommen werden (wie bei Prime oder Apple Music).
3. Metriken neu messen und übernehmen:
   ```sh
   node scripts/build-icon-metrics.mjs
   cp .local/materials/metrics.js app/assets/icons/metrics.js
   ```
   Vorher mit `git diff` prüfen, dass sich nur der neue Eintrag geändert hat.
4. Herkunft in `app/assets/icons/ADDITIONAL-SOURCES.json` eintragen (Quelle, Lizenz, Anpassung).
5. Zuordnung: Für eine eigene App reicht ein Eintrag in `app/local-config.js` → `brands: { 'NativeID.App': '<id>' }`. Für alle Nutzer kommt er in `EXTRA_BRANDS` (ID) oder `NAME_BRANDS` (exakter Name) in `device.js`, plus ein Test in `scripts/test-device.mjs`.
6. `npm run check` und `CLEANFRAME_PUBLIC_FONTS=1 npm run check:browser`.

Die native App-ID einer installierten App siehst du auf dem TV in „All apps“ (sie wird mit den Home-Apps gespeichert) oder über `npm run tv:info`.

## Den M3-Look anpassen

`m3.css` ist in fünf Abschnitte gegliedert. Für normale Anpassungen reicht **Abschnitt 3, Komponenten-Tokens**:

| Token | Wirkung | Standard |
| --- | --- | --- |
| `--dock-shape` | Eckenradius des Docks | `--md-shape-xl` (28px) |
| `--dock-container` | Dock-Fläche auf Hell/Dunkel | `--md-surface-low` |
| `--dock-photo-veil` | Tönung über dem Glas auf Foto | Scrim 50 % |
| `--tile-shape` | Ecken der Fokusfläche | 20px |
| `--tile-focus-container` / `--tile-focus-ink` | Fokusfläche und Schrift/Icon darauf | primary-container |
| `--tile-focus-ring` | Fokusring (M3: 3px) | `inset 0 0 0 3px primary` |
| `--tile-focus-elevation` | Schatten der fokussierten Kachel | `--md-elev-2` |
| `--tile-selected` | Markierung, wenn der Fokus oben in den Steuerelementen ist | Tint 14 % |
| `--tile-lifted-container` | App beim Umsortieren | secondary-container |
| `--avatar-shape`, `--avatar-tone`, `--avatar-tone-focus` | Form und Deckkraft des Initial-Avatars | 28 %, .16, .22 |
| `--control-focus-*` | Inputs / All apps / Settings im Fokus | primary-container |
| `--list-shape`, `--list-inner-shape`, `--list-container` | Settings-Liste (M3 „connected list“) | 28px / 8px |
| `--card-shape`, `--card-container` | Karten in „All apps“ | 28px |

Darunter liegen die **System-Tokens** (Abschnitt 2): die M3-Formskala `--md-shape-xs` bis `--md-shape-full`, die Zustands-Deckkräfte `--md-state-*`, die Elevation `--md-elev-1` bis `3` und das Easing. **Farben** stehen in Abschnitt 1 je Palette (`html.pal-night`, `html.pal-day`, jeweils plus Hell-Variante). Wer eine Palette ändert, sollte das passende Theme in `app/standby/js/config.js` mitziehen, damit Launcher und Standby zusammenpassen.

Regeln für den TV: Fokus-Feedback nur über `transform`, `opacity`, Farbe und feste Schatten, also keine Live-Unschärfe (`backdrop-filter`). Kein `inset:` und kein Flex-`gap` (das prüft `npm run check`).

### Dock-Grösse und Abstände

Grösse und Raster sind Layout, nicht Look. Sie stehen in `app/main.js`:

```js
var DOCK_MODES = { both: { tw: 288, th: 200, pitch: 296 }, text: { tw: 288, th: 104, pitch: 296 }, icons: { tw: 176, th: 144, pitch: 184 } };
```

- `tw`/`th`: Breite/Höhe einer Kachel, `pitch`: Abstand von Kachelanfang zu Kachelanfang (`pitch - tw` = Lücke).
- Die Symbolgrösse je Modus steht in `dockTileHtml()` (`appMark(a, Breite, Höhe, Grösse)`).
- Die Grundpositionen (`.dock`, `.plate`, `.tile`, Labels) stehen in `style.css`.

Die vorgerenderten Glas-Materialien sind auf die Dock-Position ausgerichtet. Nach Änderungen an Position oder Grösse deshalb immer die Browser-Checks laufen lassen (sie prüfen beide Layouts bei 1920 × 1080 und 1280 × 720) und auf Foto-Hintergrund visuell kontrollieren.

## Standby-Dashboard

`app/standby/style.css` hat denselben Aufbau: Farbrollen (vom Theme in `config.js` → `themes.<day|night>.ui` gesetzt), System-Tokens (`--shape-*`, `--elev-*`) und Komponenten. Komponenten sind die Uhr mit Status-Chip, die Ereigniskarten, die Liste „Seltenes“, die Kartenmarker und die Quellenangabe. Farben der Züge und Flugzeuge kommen aus `themes.<…>.colors`. Positionen sind mit `main.js` abgestimmt, denn die Uhr wird an derselben Stelle in die Karte gezeichnet.

## Lokale Anpassungen ohne Konflikte

Alles Haushaltsspezifische liegt in Dateien, die Git ignoriert. Ein `git pull` überschreibt sie nie:

| Was | Wo (nicht in Git) | Vorlage |
| --- | --- | --- |
| Eingangsnamen, Zusatzmarken, Standort für Tag/Nacht | `app/local-config.js` | `app/local-config.example.js` |
| Zuhause-Koordinate fürs Standby | `app/standby/js/local-config.js` | `app/standby/js/local-config.example.js` |
| App-Liste auf Home, Reihenfolge, Hintergrund, Schrift | im TV (localStorage), über Settings | – |
| Signatur, Zertifikate, TV-Adresse | `.local/` | `signing.example.json` |

Empfohlener Ablauf:

1. Einmalig: `cp app/local-config.example.js app/local-config.js` und ausfüllen (ebenso fürs Standby).
2. Keine Haushaltswerte in getrackte Dateien schreiben (`device.js`, `palette.js`, `config.js`). Fehlt dir eine Einstellung, ergänze lieber einen Schlüssel in `local-config.example.js` und lies ihn im Code mit Standardwert.
3. Eigene Look-Änderungen als kleine Commits auf einem eigenen Branch halten und Updates per `git pull --rebase` (oder `git merge`) holen. Konflikte entstehen dann nur, wo beide Seiten dieselbe Token-Zeile ändern.
4. Nach jedem Update: `npm run check`, die Browser-Checks und dann `npm run package` (packt `local-config.js` mit, wenn vorhanden).

`npm run export:public` ersetzt beide `local-config.js` durch leere Standards. Ein öffentliches Paket enthält also nie Koordinaten oder Eingangsnamen.
