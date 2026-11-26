import type { BagContents } from '../items/Bag';
import type { Pokemon } from '../pokemon';
import type { RaidInFlight } from './raidInFlight';

/**
 * The last thirty raids, written down as each one settles: when, where, who
 * and what went in, what came home, and what was lost and why.
 *
 * The vault keeps no history of its own, so a Pokemon a raid lost used to be
 * simply absent - the player swore they had caught a level 6 Pidgey, and
 * nothing in the save could say where it went (Olly, 25 Nov 2026). This is that
 * record, read straight out of `raidProgress.raidLog` in the browser's storage.
 * It is written by `SaveManager` at the four places a raid in flight is
 * settled - got home, lost to the clock, lost in a fight, walked away from -
 * and is measured off the vault itself on either side of the settling, so it
 * says what the save did rather than what a screen said it would.
 *
 * Optional with an empty default, so no save version bump. Phaser-free.
 */

/** How a raid ended, in the save's own words. */
export type RaidLogEnding = 'out' | 'clock' | 'fainted' | 'walked-away';

export const RAID_LOG_ENDINGS: readonly RaidLogEnding[] = ['out', 'clock', 'fainted', 'walked-away'];

/** How many raids are kept, newest last. */
export const RAIDS_LOGGED = 30;

/** One Pokemon as the log names it: its vault id, its kind, its level and any nickname. */
export interface LoggedPokemon {
  readonly id: string;
  readonly species: string;
  readonly level: number;
  readonly nickname?: string;
}

/** Pokemon and supplies, as one side of a raid's account. */
export interface RaidLogSide {
  readonly pokemon: readonly LoggedPokemon[];
  readonly items: BagContents;
}

export interface RaidLogEntry {
  /** When the raid settled, as an ISO time. */
  readonly at: string;
  readonly mapId: string;
  /** Where it went in, when the raid's record named it. */
  readonly insertionId?: string;
  readonly ending: RaidLogEnding;
  /** How much of the raid's clock was used, when the ending knew it. */
  readonly elapsedMs?: number;
  /** Who went and what was packed, and the pack it was packed in. */
  readonly took: RaidLogSide & { readonly pack?: string };
  /** Who and what is in the vault because of the raid: the team that got back, and every find. */
  readonly home: RaidLogSide;
  /** What the raid cost: who did not come back, what was taken, and the pack when it went down. */
  readonly lost: RaidLogSide & { readonly pack?: string };
}

/** The vault as the log needs it, so a test can hand it any. */
export interface VaultView {
  listPokemon(): readonly { readonly id: string; readonly pokemon: Pokemon }[];
  listItems(): BagContents;
}

/** The vault as the raid found it at its ending, before anything was settled. */
export interface RaidLogStart {
  readonly raid: RaidInFlight;
  readonly pokemon: ReadonlyMap<string, LoggedPokemon>;
  readonly items: BagContents;
}

const logged = (id: string, pokemon: Pokemon): LoggedPokemon => ({
  id,
  species: pokemon.base.id,
  level: pokemon.level,
  ...(pokemon.nickname === null ? {} : { nickname: pokemon.nickname }),
});

/**
 * Read before an ending touches the vault. Null when no raid is in flight -
 * the explorer run and the map maker's try are played on saves of their own,
 * and a raid whose record could not be written has nothing to log against.
 */
export function raidLogStart(raid: RaidInFlight | null | undefined, vault: VaultView): RaidLogStart | null {
  if (!raid) {
    return null;
  }
  return {
    raid,
    pokemon: new Map(vault.listPokemon().map(({ id, pokemon }) => [id, logged(id, pokemon)])),
    items: { ...vault.listItems() },
  };
}

/**
 * The raid's entry, measured off the vault once the ending has settled it and
 * before anything is put back that the raid did not bring (Oak's starter kit
 * after a wipe), so a restocked Satchel is never logged as having come home.
 */
export function closeRaidLog(
  start: RaidLogStart,
  settled: VaultView,
  ending: RaidLogEnding,
  now: Date,
  elapsedMs?: number,
): RaidLogEntry {
  const { raid } = start;
  const after = new Map(settled.listPokemon().map(({ id, pokemon }) => [id, logged(id, pokemon)]));
  const took = raid.pokemonIds.flatMap((id) => {
    const went = start.pokemon.get(id);
    return went === undefined ? [] : [went];
  });
  const cameBack = raid.pokemonIds.flatMap((id) => {
    const back = after.get(id);
    return back === undefined ? [] : [back];
  });
  const found = [...after.values()].filter(({ id }) => !start.pokemon.has(id));
  const lostPokemon = took.filter(({ id }) => !after.has(id));

  const packLost = raid.packItemId !== undefined && ending !== 'out';
  const settledItems = settled.listItems();
  const homeItems: Record<string, number> = {};
  const lostItems: Record<string, number> = {};
  for (const itemId of new Set([...Object.keys(raid.items), ...Object.keys(start.items), ...Object.keys(settledItems)])) {
    const packed = raid.items[itemId] ?? 0;
    // The pack is never in its own contents: a wipe takes it on top of them.
    const change = (settledItems[itemId] ?? 0) - (start.items[itemId] ?? 0) + (packLost && itemId === raid.packItemId ? 1 : 0);
    const home = Math.max(0, packed + change);
    if (home > 0) {
      homeItems[itemId] = home;
    }
    if (ending !== 'out' && packed > home) {
      lostItems[itemId] = packed - home;
    }
  }

  return {
    at: now.toISOString(),
    mapId: raid.mapId,
    ...(raid.insertionId === undefined ? {} : { insertionId: raid.insertionId }),
    ending,
    ...(elapsedMs === undefined || !Number.isFinite(elapsedMs) ? {} : { elapsedMs: Math.max(0, Math.round(elapsedMs)) }),
    took: { pokemon: took, items: { ...raid.items }, ...(raid.packItemId === undefined ? {} : { pack: raid.packItemId }) },
    home: { pokemon: [...cameBack, ...found], items: homeItems },
    lost: { pokemon: lostPokemon, items: lostItems, ...(packLost ? { pack: raid.packItemId } : {}) },
  };
}

/** The log with one more raid on the end, the oldest falling off past `RAIDS_LOGGED`. */
export function withRaidLogged(log: readonly RaidLogEntry[] | undefined, entry: RaidLogEntry | null): readonly RaidLogEntry[] | undefined {
  return entry === null ? log : [...(log ?? []), entry].slice(-RAIDS_LOGGED);
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const whole = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

function readPokemon(value: unknown): LoggedPokemon[] {
  return (Array.isArray(value) ? value : []).flatMap((entry: unknown) =>
    isRecord(entry) && typeof entry.id === 'string' && typeof entry.species === 'string' && whole(entry.level)
      ? [{
          id: entry.id,
          species: entry.species,
          level: entry.level,
          ...(typeof entry.nickname === 'string' ? { nickname: entry.nickname } : {}),
        }]
      : [],
  );
}

function readItems(value: unknown): BagContents {
  if (!isRecord(value)) {
    return {};
  }
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => whole(entry[1]) && entry[1] > 0));
}

function readSide(value: unknown): RaidLogSide & { readonly pack?: string } {
  const side = isRecord(value) ? value : {};
  return {
    pokemon: readPokemon(side.pokemon),
    items: readItems(side.items),
    ...(typeof side.pack === 'string' ? { pack: side.pack } : {}),
  };
}

/** Back out of a save, keeping only entries that are one. */
export function readRaidLog(value: unknown): readonly RaidLogEntry[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value
    .flatMap((entry: unknown): RaidLogEntry[] => {
      if (
        !isRecord(entry) ||
        typeof entry.at !== 'string' ||
        typeof entry.mapId !== 'string' ||
        !RAID_LOG_ENDINGS.includes(entry.ending as RaidLogEnding)
      ) {
        return [];
      }
      const home = readSide(entry.home);
      return [{
        at: entry.at,
        mapId: entry.mapId,
        ...(typeof entry.insertionId === 'string' ? { insertionId: entry.insertionId } : {}),
        ending: entry.ending as RaidLogEnding,
        ...(whole(entry.elapsedMs) ? { elapsedMs: entry.elapsedMs } : {}),
        took: readSide(entry.took),
        home: { pokemon: home.pokemon, items: home.items },
        lost: readSide(entry.lost),
      }];
    })
    .slice(-RAIDS_LOGGED);
}
