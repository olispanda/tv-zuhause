# Zürich HB Live – Standby-Karte

Live-Karte von Zürich (Züge, Flugzeuge, Uhr). CleanFrame zeigt sie nach 5 Minuten ohne Tastendruck als Standby (`app/picture.js`).

- **Karte (läuft auf dem TV):** `app/standby/` – Einstellungen in `app/standby/js/config.js`
- **Werkzeuge (nur Mac/PC):** `standby/tools/`

## Im Browser ansehen

```
python3 standby/tools/serve.py
```

Dann http://127.0.0.1:8791/ öffnen. Der Server leitet die Flugdaten weiter, weil adsb.lol keine CORS-Header sendet.

## Daten

| Was | Quelle | Schlüssel |
| --- | --- | --- |
| Zugläufe, Echtzeit-Haltezeiten | transport.opendata.ch (Abfahrtstafeln von ~56 Bahnhöfen) | keiner |
| Zugpositionen | berechnet: Echtzeit-Halte + Gleisnetz (`app/standby/data/rails.json`) | – |
| Flugzeuge | adsb.lol (ADS-B) | keiner |
| Karte / Relief | OpenFreeMap (OpenStreetMap), Terrarium-DEM | keiner |

## Daten neu erzeugen

```
cd standby/tools && npm install
node build-rails.mjs          # Gleisnetz → app/standby/data/rails.json
node resolve-stations.mjs     # Bahnhöfe → app/standby/data/stations.json
```
