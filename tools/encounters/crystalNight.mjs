// Reads what comes out at night in Pokemon Crystal and writes what this game's
// tall grass swaps in when a raid is played at night.
//
//   node tools/encounters/crystalNight.mjs            # fetch, write both files
//   node tools/encounters/crystalNight.mjs --check    # fetch, fail if either differs
//
// FireRed has no clock: its wild tables are the same at noon and at midnight.
// Night as a thing wildlife does was invented one generation earlier, by
// Gold, Silver and Crystal, whose every patch of grass has three tables of
// seven slots - morning, day and night - and Crystal's are the ones read here,
// out of pret/pokecrystal's `data/wild/{johto,kanto}_grass.asm` at a pinned
// commit. Nothing about night is typed from memory.
//
// The rule is about species rather than places, because the game's places are
// its own and Crystal's are Crystal's - but it is read off places, slot for
// slot, so "for that kind of place" is in it: a Spearow on an open road gives
// way to a Rattata, a Caterpie in a wood to an Oddish, a Sandshrew under Mt.
// Moon to a Clefairy, because that is what happens on Crystal's own roads,
// woods and mountain routes when the sun goes down.
//
//  1. Only grass under the sky is read: every route, the National Park, Ilex
//     Forest and the ground outside the Ruins of Alph and Mt. Silver, because
//     that is where the clock is the reason a slot changes: Crystal's towers
//     turn Rattata into Gastly because Gastly haunt towers, which says nothing
//     about what a road does after dark.
//  2. A species **keeps daylight hours** when every one of those places that
//     has it by day has none of it by night. Rattata is out by night on twelve
//     of the seventeen routes it is out by day on, so it stays out; Pidgey is
//     out by night on none of fourteen.
//  3. Its **night species** is whatever takes its slot by night on the most
//     places, counting only the original 151 this game has, and only when it
//     does so on at least two of them - one place is that place's own story.
//     A tie goes to the earlier name, so the choice never moves.
//  4. A species that keeps daylight hours with no night species keeps its slot
//     by night. Pidgey is the one that matters: its night slot is a Hoothoot on
//     fourteen routes, and the 151 have no owl.
//
// Two files come out: `crystal-night.json` beside this script, the snapshot of
// every outdoor table's day and night slots, and
// `src/game/world/generated/nightSwaps.ts`, the swaps with the places that
// make each one.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = join(HERE, 'crystal-night.json');
const GENERATED = join(HERE, '../../src/game/world/generated/nightSwaps.ts');
const SPECIES = join(HERE, '../species/frlg-base-stats.json');

const PRET_COMMIT = '3bc8daa4173e96a7f4011dad3922eb6fa5dad5c6';
const SOURCES = ['johto_grass', 'kanto_grass'].map(
  (file) => `https://raw.githubusercontent.com/pret/pokecrystal/${PRET_COMMIT}/data/wild/${file}.asm`,
);

/** Grass under the sky that is not a route. */
const OUTDOOR_PLACES = new Set(['NATIONAL_PARK', 'ILEX_FOREST', 'RUINS_OF_ALPH_OUTSIDE', 'SILVER_CAVE_OUTSIDE']);
const isOutdoors = (place) => place.startsWith('ROUTE_') || OUTDOOR_PLACES.has(place);

/** How many places a night species has to take the slot on. */
const LEAST_PLACES = 2;

const fetchText = async (url) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, {
      headers: { 'user-agent': 'escape-from-pallet-town night audit' },
    });
    if (response.ok) return response.text();
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new Error(`could not fetch ${url}`);
};

// The game knows a species by its own id; Crystal by a constant (`FARFETCH_D`,
// `MR__MIME`, `NIDORAN_F`). Both reduce to the same letters.
const letters = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '');
const gameIds = new Map(
  JSON.parse(readFileSync(SPECIES, 'utf8')).species.map((entry) => [letters(entry.name), entry.name]),
);
/** The game's id for a Crystal constant, or the constant lowercased for a species past the 151. */
const speciesId = (constant) => gameIds.get(letters(constant)) ?? constant.toLowerCase();
const inGame = (id) => gameIds.has(letters(id)) && gameIds.get(letters(id)) === id;

/** Every grass table in a file: `{ place, day: [...], night: [...] }`, seven slots each. */
const parse = (text) => {
  const tables = [];
  let current = null;
  let section = null;
  for (const line of text.split('\n')) {
    const start = line.match(/def_grass_wildmons (\w+)/);
    if (start) {
      current = { place: start[1], morn: [], day: [], nite: [] };
      tables.push(current);
      section = null;
      continue;
    }
    const heading = line.match(/^\s*; (morn|day|nite)\s*$/);
    if (heading) {
      section = heading[1];
      continue;
    }
    const slot = line.match(/^\s*db (\d+), (\w+)/);
    if (slot && current && section) {
      current[section].push(speciesId(slot[2]));
    }
  }
  return tables.map((table) => ({ place: table.place, day: table.day, night: table.nite }));
};

const tables = (await Promise.all(SOURCES.map(fetchText)))
  .flatMap(parse)
  .filter((table) => isOutdoors(table.place))
  .sort((a, b) => a.place.localeCompare(b.place));
for (const table of tables) {
  if (table.day.length !== 7 || table.night.length !== 7) {
    throw new Error(`${table.place} is not seven slots by day and by night`);
  }
}

const dayOut = new Map();
for (const table of tables) {
  for (const species of new Set(table.day)) {
    const record = dayOut.get(species) ?? { places: 0, outByNight: 0 };
    record.places += 1;
    if (table.night.includes(species)) record.outByNight += 1;
    dayOut.set(species, record);
  }
}
const keepsDaylight = (species) => dayOut.get(species)?.outByNight === 0;

/** day species -> night species -> the places it takes the slot on. */
const takers = new Map();
for (const table of tables) {
  table.day.forEach((species, slot) => {
    const taker = table.night[slot];
    if (!keepsDaylight(species) || !inGame(species) || !inGame(taker)) return;
    const byTaker = takers.get(species) ?? new Map();
    byTaker.set(taker, (byTaker.get(taker) ?? new Set()).add(table.place));
    takers.set(species, byTaker);
  });
}

const swaps = [...takers.entries()]
  .map(([day, byTaker]) => {
    const [night, places] = [...byTaker.entries()]
      .map(([taker, set]) => [taker, [...set].sort()])
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0];
    return { day, night, places };
  })
  .filter((swap) => swap.places.length >= LEAST_PLACES)
  .sort((a, b) => a.day.localeCompare(b.day));

const kept = [...dayOut.keys()]
  .filter((species) => keepsDaylight(species) && inGame(species) && !swaps.some((swap) => swap.day === species))
  .sort();

const snapshot = {
  ruling:
    "Generation II Crystal's day and night grass slots, for every patch of grass under the sky. FireRed has no clock; Crystal is the game night came from, and this game's night raids read their swaps from these tables.",
  source: {
    pokecrystal: {
      urls: SOURCES,
      note: 'the Crystal disassembly - the tables the cartridge is built from',
    },
  },
  places: tables,
};

const generated = `// Generated by tools/encounters/crystalNight.mjs from pret/pokecrystal's own
// grass tables at ${PRET_COMMIT}.
// Do not edit: re-run the script.

/**
 * A species that keeps daylight hours, and the one that takes its slot by
 * night - with the outdoor places in Crystal that do it.
 */
export interface NightSwap {
  readonly day: string;
  readonly night: string;
  readonly places: readonly string[];
}

export const NIGHT_SWAPS: readonly NightSwap[] = [
${swaps
  .map((swap) => `  { day: '${swap.day}', night: '${swap.night}', places: [${swap.places.map((place) => `'${place}'`).join(', ')}] },`)
  .join('\n')}
];

/**
 * Species that keep daylight hours and have nothing in the 151 to give their
 * slot to, so they keep it by night.
 */
export const KEPT_BY_NIGHT: readonly string[] = [
${kept.map((species) => `  '${species}',`).join('\n')}
];
`;

const written = `${JSON.stringify(snapshot, null, 1)}\n`;
if (process.argv.includes('--check')) {
  const stale = [
    readFileSync(SNAPSHOT, 'utf8') === written ? null : 'crystal-night.json',
    readFileSync(GENERATED, 'utf8') === generated ? null : 'generated/nightSwaps.ts',
  ].filter(Boolean);
  if (stale.length > 0) {
    console.error(`${stale.join(' and ')} no longer match Crystal; re-run without --check`);
    process.exit(1);
  }
  console.log('crystal-night.json and nightSwaps.ts match Crystal.');
} else {
  writeFileSync(SNAPSHOT, written);
  writeFileSync(GENERATED, generated);
  console.log(`wrote ${SNAPSHOT} and ${GENERATED}`);
}
