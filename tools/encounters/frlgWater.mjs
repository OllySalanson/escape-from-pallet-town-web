// Reads the water of FireRed's own wild encounter table and writes what the
// game fishes from.
//
//   node tools/encounters/frlgWater.mjs            # fetch, write both files
//   node tools/encounters/frlgWater.mjs --check    # fetch, fail if either differs
//
// FireRed gives a place's water two tables beside its tall grass: `fishing_mons`,
// ten slots of which the Old Rod reads two, the Good Rod three and the Super Rod
// five, and `water_mons`, the five slots surfing rolls. Both are read here out of
// pret/pokefirered's `src/data/wild_encounters.json` - the table the cartridge
// is built from - at the same pinned commit `tools/species/verifyStats.mjs`
// reads the base stats from, along with the slot rates and which slots each rod
// reads, so nothing about fishing is typed from memory.
//
// Two places are read, because the game has two kinds of water and FireRed has
// a place of each that this game has a place for:
//
//  - **Pallet Town** is the sea. FireRed's Pallet Town is a beach with the sea
//    off it, and this game's Pallet Town runs down into the tide - its saltings,
//    strand, hard and headland stand on exactly that water.
//  - **Viridian City** is fresh water: the pond FireRed's Viridian City has, and
//    this game's Viridian City keeps. FireRed fishes every Kanto river and pond
//    the same way with the two lower rods (Route 6, 22 and 25 read slot for slot
//    the same), so it is also what every other river, brook and tarn here reads.
//
// FireRed is taken over LeafGreen where the two differ, which in these slots is
// only the order of Pallet's Horsea and Krabby; the LeafGreen rows are written
// to the snapshot beside them so that is a fact rather than a claim.
//
// Two files come out. `frlg-water.json` beside this script is the committed
// snapshot of the source, surfing slots and the Super Rod included, for whoever
// adds those next; `src/game/world/generated/fishingWaters.ts` is the part the
// game reads.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = join(HERE, 'frlg-water.json');
const GENERATED = join(HERE, '../../src/game/world/generated/fishingWaters.ts');

const PRET_COMMIT = 'c75f352304d529f6ba92d4f74b9cf8b5c3810788';
const PRET_URL = `https://raw.githubusercontent.com/pret/pokefirered/${PRET_COMMIT}/src/data/wild_encounters.json`;

/** The game's two waters, and the FireRed place each is read from. */
const WATERS = [
  { id: 'sea', label: 'sPalletTown', place: 'Pallet Town' },
  { id: 'fresh', label: 'sViridianCity', place: 'Viridian City' },
];

const fetchText = async (url) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, {
      headers: { 'user-agent': 'escape-from-pallet-town fishing audit' },
    });
    if (response.ok) return response.text();
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new Error(`could not fetch ${url}`);
};

/** `SPECIES_NIDORAN_F` -> `nidoran-f`, the id the game knows a species by. */
const speciesId = (constant) =>
  constant
    .replace(/^SPECIES_/, '')
    .toLowerCase()
    .replace(/_/g, '-');

const slots = (mons) =>
  mons.map((mon) => ({
    speciesId: speciesId(mon.species),
    minLevel: mon.min_level,
    maxLevel: mon.max_level,
  }));

const source = JSON.parse(await fetchText(PRET_URL));
const group = source.wild_encounter_groups.find((candidate) => candidate.for_maps);
const field = (type) => group.fields.find((candidate) => candidate.type === type);
const fishingField = field('fishing_mons');
const waterField = field('water_mons');
const encounter = (label) => {
  const found = group.encounters.find((candidate) => candidate.base_label === label);
  if (!found?.fishing_mons || !found.water_mons) {
    throw new Error(`${label} has no water in FireRed's table`);
  }
  return found;
};

const waters = WATERS.map((water) => {
  const versions = Object.fromEntries(
    ['FireRed', 'LeafGreen'].map((version) => {
      const found = encounter(`${water.label}_${version}`);
      return [
        version,
        {
          map: found.map,
          fishing: slots(found.fishing_mons.mons),
          surfing: {
            encounterRate: found.water_mons.encounter_rate,
            slots: slots(found.water_mons.mons),
          },
        },
      ];
    }),
  );
  return { id: water.id, place: water.place, ...versions };
});

const snapshot = {
  ruling:
    "Generation III FireRed/LeafGreen water: the fishing and surfing slots of the two places whose water this game has, read from FireRed's own wild encounter table. The game fishes from the FireRed rows.",
  source: {
    pokefirered: {
      url: PRET_URL,
      note: 'the FireRed disassembly - the table the cartridge is built from',
    },
  },
  fishingRates: fishingField.encounter_rates,
  rods: fishingField.groups,
  surfingRates: waterField.encounter_rates,
  waters,
};

const rodSlots = (water) => {
  const fishing = water.FireRed.fishing;
  return Object.fromEntries(
    ['old_rod', 'good_rod'].map((rod) => [
      rod,
      snapshot.rods[rod].map((slot) => ({ ...fishing[slot], weight: snapshot.fishingRates[slot] })),
    ]),
  );
};

const slotLine = (slot) =>
  `    { speciesId: '${slot.speciesId}', minLevel: ${slot.minLevel}, maxLevel: ${slot.maxLevel}, weight: ${slot.weight} },`;

const generated = `// Generated by tools/encounters/frlgWater.mjs from pret/pokefirered's own wild
// encounter table (${PRET_URL}).
// Do not edit: re-run the script.

import type { WildEncounterEntry } from '../../pokemon/encounters';

/** Which FireRed place each of the game's waters is read from. */
export const FISHING_WATER_SOURCES = {
${waters.map((water) => `  ${water.id}: '${water.FireRed.map}',`).join('\n')}
} as const;

/**
 * What each rod reads, slot for slot: the species and levels of the slot, and
 * its FireRed rate out of 100 as the weight. The Super Rod's five slots are in
 * \`tools/encounters/frlg-water.json\` and nowhere here.
 */
export const FISHING_WATER_SLOTS: Readonly<
  Record<keyof typeof FISHING_WATER_SOURCES, Readonly<Record<'oldRod' | 'goodRod', readonly WildEncounterEntry[]>>>
> = {
${waters
  .map((water) => {
    const rods = rodSlots(water);
    return `  ${water.id}: {\n    oldRod: [\n${rods.old_rod.map((slot) => `  ${slotLine(slot)}`).join('\n')}\n    ],\n    goodRod: [\n${rods.good_rod.map((slot) => `  ${slotLine(slot)}`).join('\n')}\n    ],\n  },`;
  })
  .join('\n')}
};
`;

const written = `${JSON.stringify(snapshot, null, 1)}\n`;
if (process.argv.includes('--check')) {
  const stale = [
    readFileSync(SNAPSHOT, 'utf8') === written ? null : 'frlg-water.json',
    readFileSync(GENERATED, 'utf8') === generated ? null : 'generated/fishingWaters.ts',
  ].filter(Boolean);
  if (stale.length > 0) {
    console.error(`${stale.join(' and ')} no longer match FireRed; re-run without --check`);
    process.exit(1);
  }
  console.log('frlg-water.json and fishingWaters.ts match FireRed.');
} else {
  writeFileSync(SNAPSHOT, written);
  writeFileSync(GENERATED, generated);
  console.log(`wrote ${SNAPSHOT} and ${GENERATED}`);
}
