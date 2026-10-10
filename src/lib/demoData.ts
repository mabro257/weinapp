import type { Rating, Wine } from './types'

/** Beispielweine für den Demo-Modus. Weingüter sind erfunden. */
export const DEMO_WINES: Wine[] = [
  w(1, 'Chianti Classico Riserva', 'Tenuta Beispiel', 'Italien', 'Toskana', 'rot', 2, [2], 4, 3),
  w(2, 'Chianti Rufina Riserva', 'Fattoria Esempio', 'Italien', 'Toskana', 'rot', 2, [2], 3, 4),
  w(3, 'Chianti Classico', 'Castello Modello', 'Italien', 'Toskana', 'rot', 2, [2], 3, 4),
  w(4, 'Brunello di Montalcino', 'Tenuta Campione', 'Italien', 'Toskana', 'rot', 4, [2], 4, 4),
  w(5, 'Rosso di Montalcino', 'Tenuta Campione', 'Italien', 'Toskana', 'rot', 2, [2], 3, 4),
  w(6, 'Barolo', 'Cantina Esempio', 'Italien', 'Piemont', 'rot', 4, [1], 4, 5),
  w(7, 'Barbaresco', 'Produttori Modello', 'Italien', 'Piemont', 'rot', 3, [1], 4, 5),
  w(8, 'Valtellina Superiore', 'Azienda Prova', 'Italien', 'Lombardei', 'rot', 3, [1], 3, 4),
  w(9, 'Riesling Smaragd', 'Weingut Musterhof', 'Österreich', 'Wachau', 'weiss', 3, [20], 3, 5),
  w(10, 'Riesling GG', 'Weingut Beispielberg', 'Deutschland', 'Rheingau', 'weiss', 3, [20], 3, 5),
  w(11, 'Riesling Kabinett', 'Weingut Probestein', 'Deutschland', 'Mosel', 'weiss', 2, [20], 2, 5),
  w(12, 'Spätburgunder trocken', 'Weingut Mustermann', 'Deutschland', 'Baden', 'rot', 2, [3], 2, 4),
  w(13, 'Pinot Noir Réserve', 'Domaine Exemple', 'Frankreich', 'Burgund', 'rot', 4, [3], 3, 4),
  w(14, 'Grüner Veltliner Federspiel', 'Weingut Probe', 'Österreich', 'Wachau', 'weiss', 2, [21], 3, 4),
  w(15, 'Rioja Reserva', 'Bodega Ejemplo', 'Spanien', 'Rioja', 'rot', 2, [8], 4, 3),
  w(16, 'Ribera del Duero Crianza', 'Bodega Muestra', 'Spanien', 'Ribera del Duero', 'rot', 2, [8], 4, 3),
  w(17, 'Côtes du Rhône', 'Domaine Exemple', 'Frankreich', 'Rhône', 'rot', 1, [7, 6], 3, 3),
  w(18, 'Bordeaux Supérieur', 'Château Modèle', 'Frankreich', 'Bordeaux', 'rot', 2, [5, 4], 4, 3),
  w(19, 'Sancerre', 'Domaine Essai', 'Frankreich', 'Loire', 'weiss', 3, [23], 2, 5),
  w(20, 'Sauvignon Blanc Ried', 'Weingut Steirerprobe', 'Österreich', 'Südsteiermark', 'weiss', 3, [23], 2, 5),
  w(21, 'Grauburgunder trocken', 'Weingut Kaiserprobe', 'Deutschland', 'Baden', 'weiss', 2, [24], 3, 3),
  w(22, 'Blaufränkisch Ried', 'Weingut Seeprobe', 'Österreich', 'Burgenland', 'rot', 3, [11], 3, 4),
  w(23, 'Primitivo di Manduria', 'Masseria Esempio', 'Italien', 'Apulien', 'rot', 2, [10], 5, 2),
  w(24, 'Prosecco Superiore', 'Cantina Bollicine', 'Italien', 'Venetien', 'schaum', 2, [32], 1, 3),
  w(25, 'Chablis', 'Domaine Exemple', 'Frankreich', 'Burgund', 'weiss', 3, [22], 2, 4),
]

function w(
  id: number, name: string, winery: string, country: string, region: string,
  type: Wine['type'], priceClass: number, grapeIds: number[], body: number, acidity: number,
): Wine {
  return { id, name, winery, country, region, type, priceClass, grapeIds, body, acidity, labelUrl: null }
}

export interface DemoRating extends Rating {
  userId: string
}

export const DEMO_ME = { id: 'demo-ich', displayName: 'Marcel', isAdmin: true }

// Eigene Bewertungen: [Wein, Punkte, Jahrgang, Datum, Körper, Säure, Tannin, Notiz, Tags]
type Row = [number, number, number | null, string, number | null, number | null, number | null, string | null, string[]]
const MY_ROWS: Row[] = [
  [9, 92, 2022, '2026-10-08', 3, 5, null, 'Steinobst, salzig, langer Nachhall.', ['Zuhause']],
  [1, 91, 2021, '2026-08-12', 4, 3, 4, 'Kirschfrucht, weich, sehr trinkig.', ['Sommerfest mit Freunden']],
  [6, 89, 2018, '2026-07-30', 4, 5, 5, 'Rose und Teer, noch jung.', ['Restaurant Beispiel']],
  [12, 78, 2022, '2026-07-30', 2, 4, 2, 'Zu warm serviert, wirkte alkoholisch.', ['Restaurant Beispiel']],
  [14, 86, 2024, '2026-06-14', 3, 4, null, 'Pfeffrig, frisch, perfekt zum Heurigen.', ['Urlaub Wachau 2026']],
  [9, 90, 2021, '2026-06-13', 3, 5, null, null, ['Urlaub Wachau 2026']],
  [14, 84, 2023, '2026-06-12', null, null, null, null, ['Urlaub Wachau 2026']],
  [1, 88, 2020, '2026-03-03', 4, 3, 4, 'Noch etwas streng, Tannine präsent.', ['Restaurant Beispiel']],
  [7, 91, 2019, '2026-02-14', 4, 5, 5, 'Elegant, Rosenduft.', ['Weinabend']],
  [6, 87, 2017, '2026-01-20', null, null, null, null, ['Zuhause']],
  [10, 88, 2021, '2025-12-24', 3, 5, null, 'Zu Weihnachten, passt zur Gans.', ['Weihnachten']],
  [13, 95, 2019, '2025-12-31', 3, 4, 3, 'Großartig, Waldboden und Kirsche.', ['Silvester']],
  [12, 83, 2021, '2025-11-08', null, null, null, null, ['Zuhause']],
  [4, 90, 2016, '2025-10-30', 5, 4, 4, 'Kraftvoll, braucht Luft.', ['Weinabend']],
  [6, 91, 2016, '2025-10-04', 4, 5, 5, null, ['Weinabend']],
  [11, 86, 2023, '2025-09-12', 2, 5, null, 'Leicht, feine Restsüße.', ['Zuhause']],
  [2, 85, 2020, '2025-08-02', null, null, null, null, ['Sommerfest mit Freunden']],
  [1, 85, 2020, '2025-07-21', 4, 3, 4, 'Zum Essen sehr stimmig.', ['Urlaub Toskana 2025']],
  [5, 82, 2022, '2025-07-19', 3, 4, 3, null, ['Urlaub Toskana 2025']],
  [4, 89, 2017, '2025-07-17', 5, 4, 4, 'Im Weingut probiert.', ['Urlaub Toskana 2025']],
  [8, 86, 2019, '2025-06-01', 3, 4, 4, null, ['Restaurant Beispiel']],
  [20, 87, 2023, '2025-05-10', 2, 5, null, 'Holunder, knackig.', ['Zuhause']],
  [15, 81, 2018, '2025-04-11', 4, 3, 3, 'Viel Vanille, etwas plump.', ['Restaurant Beispiel']],
  [10, 86, 2020, '2025-03-15', null, null, null, null, ['Weinabend']],
  [9, 74, 2021, '2025-02-02', null, null, null, 'Korkfehler? Gedämpft.', ['Zuhause']],
  [13, 90, 2018, '2025-01-18', 3, 4, 3, null, ['Weinabend']],
  [7, 89, 2018, '2024-12-14', null, null, null, null, ['Weinabend']],
  [16, 85, 2019, '2024-11-23', 4, 3, 4, null, ['Restaurant Beispiel']],
  [12, 87, 2020, '2024-10-12', 2, 4, 2, 'Feiner als erwartet.', ['Zuhause']],
  [11, 88, 2022, '2024-09-07', null, null, null, null, ['Sommerfest mit Freunden']],
  [8, 86, 2018, '2024-08-15', null, null, null, null, ['Restaurant Beispiel']],
  [10, 80, 2019, '2024-07-04', null, null, null, null, ['Zuhause']],
  [9, 93, 2019, '2024-06-20', 3, 5, null, 'Bisher der beste Riesling.', ['Urlaub Wachau 2024']],
  [14, 88, 2023, '2024-06-19', null, null, null, null, ['Urlaub Wachau 2024']],
  [6, 84, 2015, '2024-05-01', null, null, null, null, ['Restaurant Beispiel']],
  [12, 90, 2019, '2024-04-13', null, null, null, null, ['Weinabend']],
  [11, 89, 2021, '2024-03-02', null, null, null, null, ['Zuhause']],
  [6, 94, 2013, '2024-02-10', null, null, null, 'Gereift, umwerfend.', ['Geburtstag']],
  [10, 88, 2018, '2024-01-06', null, null, null, null, ['Zuhause']],
  [13, 83, 2020, '2023-12-15', null, null, null, null, ['Restaurant Beispiel']],
  [12, 82, 2020, '2023-11-11', null, null, null, null, ['Zuhause']],
  [9, 90, 2018, '2023-10-07', null, null, null, null, ['Weinabend']],
  [20, 88, 2022, '2023-09-23', null, null, null, null, ['Zuhause']],
  [15, 85, 2017, '2023-08-19', null, null, null, null, ['Restaurant Beispiel']],
]

const FRIENDS = ['demo-f1', 'demo-f2', 'demo-f3', 'demo-f4']

/** Kleiner, fester Zufallsgenerator, damit die Demo-Daten immer gleich aussehen. */
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export function buildDemoRatings(): DemoRating[] {
  const out: DemoRating[] = []
  let id = 1
  for (const r of MY_ROWS) {
    out.push({
      id: id++, userId: DEMO_ME.id, wineId: r[0], score: r[1], vintage: r[2], tastedOn: r[3],
      body: r[4], acidity: r[5], tannin: r[6], note: r[7], tags: r[8],
    })
  }
  const rnd = seeded(42)
  for (const wine of DEMO_WINES) {
    for (const f of FRIENDS) {
      if (rnd() < 0.45) continue
      const base = 80 + Math.round(rnd() * 12)
      out.push({
        id: id++, userId: f, wineId: wine.id, score: base, vintage: 2018 + Math.floor(rnd() * 5),
        tastedOn: '2025-0' + (1 + Math.floor(rnd() * 9)) + '-15',
        body: wine.body, acidity: wine.acidity, tannin: wine.type === 'rot' ? 3 + Math.round(rnd()) : null,
        note: null, tags: [],
      })
    }
  }
  return out
}
