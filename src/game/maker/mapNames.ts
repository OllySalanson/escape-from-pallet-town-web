/**
 * A name for a new map, in the voice the rest of Pallet Town is written in.
 *
 * A new map used to be called "My map" - the one name nothing in this world is
 * called. The world names its places the way an English coast and its
 * hinterland do, and grimly where it can: THE STAITHE, THE DROWNED HUNDRED,
 * CINDER RIDGE, RAVEN CRAG, THE WITHY BEDS, HOLLOW BECK, THE BLOWDOWN. So a
 * name is drawn from the same stock: the place-words the shipped maps are
 * made of, a few words of extraction-game grit, the Kanto Pokémon you would
 * actually meet on a wet afternoon, and the trades that work the land. The
 * player can change it - it is a starting point, not a verdict - and REROLL in
 * the map maker draws another.
 *
 * Every name it can make passes the word filter and fits a map file's name
 * (`mapNames.test.ts` asks all of them), so a reroll can never hand a player a
 * name the game would then refuse.
 */
import { MAP_FILE_LIMITS } from '../world/mapFile';

/** Words a place is called by: the shipped maps' own, and their country cousins. */
export const PLACE_WORDS = [
  'ADIT', 'BECK', 'BURN', 'CAUSEWAY', 'CAVERN', 'COMMON', 'COPPICE', 'CRAG', 'CROSSING', 'CULVERT',
  'CUT', 'DELVE', 'DENE', 'DROVE', 'FEN', 'FERRY', 'FLATS', 'FORD', 'GULLY', 'HANGER', 'HARD',
  'HEATH', 'HOLLOW', 'HOLT', 'KILNS', 'LANDING', 'LEDGE', 'LEVELS', 'MARSH', 'MERE', 'MILLPOND',
  'MOOR', 'MUDS', 'NESS', 'ORCHARD', 'QUARRY', 'REACH', 'ROOKERY', 'SALTINGS', 'SAWPIT', 'SCAR',
  'SLUICE', 'SPINNEY', 'STAIR', 'STAITHE', 'STRAND', 'TARN', 'TOWPATH', 'WARREN', 'WEIR', 'WHARF',
  'WITHY BEDS',
] as const;

/** How a place is: the weather, the damage, and what the raids have left of it. */
export const PLACE_MOODS = [
  'BITTER', 'BLACK', 'BROKEN', 'BURNT', 'CINDER', 'CRACKED', 'CROOKED', 'DEEP', 'DROWNED', 'DUSK',
  'ECHO', 'FAR', 'FLOODED', 'FOGGY', 'FORGOTTEN', 'GREY', 'HUNGRY', 'LAST', 'LONG', 'LOST', 'LOW',
  'MISTY', 'MUDDY', 'OLD', 'QUIET', 'RAVEN', 'ROTTEN', 'RUSTY', 'SALT', 'SILENT', 'STILL', 'STONY',
  'SUNKEN', 'THORNY', 'TIDAL', 'WET', 'WILD', 'WINDY',
] as const;

/** Kanto Pokémon a raid really meets in places like these. */
export const PLACE_CRITTERS = [
  'CATERPIE', 'DIGLETT', 'DODUO', 'DROWZEE', 'EKANS', 'GASTLY', 'GEODUDE', 'GRIMER', 'GROWLITHE',
  'HORSEA', 'KOFFING', 'KRABBY', 'MAGIKARP', 'MEOWTH', 'ODDISH', 'ONIX', 'PARAS', 'PIDGEY',
  'POLIWAG', 'PSYDUCK', 'RATTATA', 'SEEL', 'SHELLDER', 'SLOWPOKE', 'SPEAROW', 'TENTACOOL',
  'VENONAT', 'VULPIX', 'WEEDLE', 'ZUBAT',
] as const;

/** Whoever a place was named after: the trades that work it, and the ones that raid it. */
export const PLACE_OWNERS = [
  'BOSUN', 'COLLIER', 'DROVER', 'FERRYMAN', 'HIKER', 'HUNTER', 'KEEPER', 'MILLER', 'PEDLAR',
  'POACHER', 'RAIDER', 'RANGER', 'SALTER', 'SCOUT', 'SMUGGLER', 'TINKER', 'WARDEN',
] as const;

/** What somebody leaves behind them in a place's name. */
export const PLACE_LEAVINGS = ['END', 'FOLLY', 'LEAP', 'LUCK', 'REST', 'RUN'] as const;

/** A number from 0 to 1, as `Math.random` gives one; a seeded one in a test. */
export type Roll = () => number;

const pick = <T>(words: readonly T[], roll: Roll): T => words[Math.min(words.length - 1, Math.floor(roll() * words.length))];

/** Every way a name is put together, each a whole name or null if it would not fit. */
const SHAPES: readonly ((roll: Roll) => string)[] = [
  // CINDER STAITHE, DROWNED WEIR, ECHO CAVERN
  (roll) => `${pick(PLACE_MOODS, roll)} ${pick(PLACE_WORDS, roll)}`,
  (roll) => `${pick(PLACE_MOODS, roll)} ${pick(PLACE_WORDS, roll)}`,
  // SLOWPOKE WHARF, ZUBAT ADIT, MAGIKARP WEIR
  (roll) => `${pick(PLACE_CRITTERS, roll)} ${pick(PLACE_WORDS, roll)}`,
  // SMUGGLER'S CUT, DROVER'S REST, POACHER'S FOLLY
  (roll) => `${pick(PLACE_OWNERS, roll)}'S ${roll() < 0.5 ? pick(PLACE_WORDS, roll) : pick(PLACE_LEAVINGS, roll)}`,
  // THE LAST LANDING, THE SUNKEN SALTINGS
  (roll) => `THE ${pick(PLACE_MOODS, roll)} ${pick(PLACE_WORDS, roll)}`,
];

/** A name for a new map. Never longer than a map file's name may be. */
export function generateMapName(roll: Roll = Math.random): string {
  for (let tries = 0; tries < 8; tries += 1) {
    const name = pick(SHAPES, roll)(roll);
    if (name.length <= MAP_FILE_LIMITS.maxNameLength) {
      return name;
    }
  }
  return `${pick(PLACE_MOODS, roll)} ${pick(PLACE_WORDS, roll)}`;
}

/** Every name the generator can make, for the tests that hold all of them to the rules. */
export function everyGeneratedMapName(): readonly string[] {
  const names = new Set<string>();
  for (const word of PLACE_WORDS) {
    for (const mood of PLACE_MOODS) {
      names.add(`${mood} ${word}`);
      names.add(`THE ${mood} ${word}`);
    }
    for (const critter of PLACE_CRITTERS) {
      names.add(`${critter} ${word}`);
    }
    for (const owner of PLACE_OWNERS) {
      names.add(`${owner}'S ${word}`);
    }
  }
  for (const owner of PLACE_OWNERS) {
    for (const leaving of PLACE_LEAVINGS) {
      names.add(`${owner}'S ${leaving}`);
    }
  }
  return [...names].filter((name) => name.length <= MAP_FILE_LIMITS.maxNameLength);
}

let generated: ReadonlySet<string> | undefined;

/** Whether a name is one the generator made, so a map still called it has not been renamed. */
export function isGeneratedMapName(name: string): boolean {
  generated ??= new Set(everyGeneratedMapName());
  return generated.has(name);
}
