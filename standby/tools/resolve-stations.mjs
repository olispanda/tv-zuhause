// Build-time: resolve station names to transport.opendata.ch IDs and coordinates -> app/standby/data/stations.json
import { writeFileSync } from 'node:fs';
const NAMES = ['Zürich HB', 'Zürich Hardbrücke', 'Zürich Altstetten', 'Zürich Oerlikon', 'Zürich Stadelhofen', 'Zürich Wipkingen', 'Zürich Wiedikon',
  'Zürich Enge', 'Zürich Wollishofen', 'Zürich Tiefenbrunnen', 'Zürich Seebach', 'Zürich Affoltern', 'Stettbach', 'Zürich Selnau', 'Zürich Giesshübel',
  'Zürich Saalsporthalle', 'Zürich Brunau', 'Zürich Manegg', 'Zürich Leimbach', 'Sood-Oberleimbach', 'Adliswil', 'Zürich Binz', 'Zürich Friesenberg',
  'Zürich Schweighof', 'Zürich Triemli', 'Uitikon Waldegg', 'Ringlikon', 'Uetliberg', 'Wallisellen', 'Dübendorf', 'Dietlikon', 'Glattbrugg', 'Opfikon',
  'Zürich Flughafen', 'Regensdorf-Watt', 'Schlieren', 'Urdorf', 'Urdorf Weihermatt', 'Glanzenberg', 'Dietikon', 'Kilchberg ZH', 'Rüschlikon', 'Thalwil',
  'Zollikon', 'Küsnacht ZH', 'Küsnacht Goldbach', 'Erlenbach ZH', 'Schwerzenbach ZH', 'Birmensdorf ZH', 'Bonstetten-Wettswil', 'Langnau-Gattikon',
  'Rümlang', 'Oberglatt ZH', 'Kloten', 'Kloten Balsberg', 'Bassersdorf', 'Effretikon', 'Kemptthal', 'Uster', 'Nänikon-Greifensee',
  'Zollikerberg', 'Herrliberg-Feldmeilen', 'Buchs-Dällikon', 'Otelfingen', 'Killwangen-Spreitenbach', 'Neuenhof', 'Wettingen', 'Berikon-Widen',
  'Hedingen', 'Affoltern am Albis', 'Horgen', 'Oberrieden', 'Niederglatt ZH',
  'Baden', 'Aarau', 'Zug', 'Winterthur', 'Bern'];
const out = [];
for (const q of NAMES) {
  const r = await (await fetch('https://transport.opendata.ch/v1/locations?type=station&query=' + encodeURIComponent(q))).json();
  const s = (r.stations || []).find((x) => x.id && x.coordinate && x.coordinate.x);
  if (!s) { console.log('MISSING', q); continue; }
  out.push({ id: s.id, name: s.name, p: [s.coordinate.y, s.coordinate.x] });
  console.log(q.padEnd(22), '->', s.id, s.name, s.coordinate.x, s.coordinate.y, s.name !== q ? '  <-- name differs' : '');
}
writeFileSync(new URL('../../app/standby/data/stations.json', import.meta.url), JSON.stringify(out, null, 0));
