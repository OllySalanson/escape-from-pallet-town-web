import type { WildEncounterTable } from '../pokemon/encounters';
import type { GridPosition } from '../movement/gridMovement';
import type { WorldMapDefinition, WorldMapId } from '../worldMap';
import { districtAt } from './districts';
import { FISHING_WATER_SLOTS, type FISHING_WATER_SOURCES } from './generated/fishingWaters';
import type { EncounterRng } from './wildEncounters';

/**
 * Fishing: how a Pokemon that lives in the water is met, by FireRed's own rule.
 *
 * Every water species in this game used to live in the tall grass beside the
 * water, because nothing could be met in the water itself (playtest 25). FireRed
 * meets them with a rod, and so does this: face water with a rod in the pack,
 * press the interact key, and FireRed's own cast is played out - a second of
 * casting, a row of dots, and then either nothing or a Pokemon on the hook.
 *
 * Everything that decides a cast is FireRed's and is read off pret/pokefirered
 * rather than remembered (`src/field_player_avatar.c`, the `Fishing*` tasks, and
 * `src/wild_encounter.c`, `ChooseWildMonIndex_Fishing`):
 *
 * - **What bites** is the water's own table: ten slots a place, of which the Old
 *   Rod reads two at 70/30 and the Good Rod three at 60/20/20. The slots and
 *   their levels are generated from FireRed's table (`tools/encounters/
 *   frlgWater.mjs`), and the level is uniform between the slot's two ends, as
 *   `ChooseWildMonLevel` draws it. The Super Rod is not here: its slots start at
 *   level 15 and run to 35, which is a different game from one played at 2-15.
 * - **Whether anything bites** is a coin: `Random() & 1` in `Fishing6`. FireRed
 *   then goes straight from the bite to the hook (`Fishing7` steps over the
 *   reeling window Ruby and Sapphire had), so there is nothing to time - a bite
 *   is a Pokemon on the hook.
 * - **How long it takes** is a second's cast (`Fishing3`, sixty frames) and then
 *   four to ten dots a third of a second apart (`Fishing4`/`Fishing5`: one in
 *   ten of `randVal + 4`, capped at ten, a dot every twenty frames).
 *
 * The raid adds one thing, which is the price: **a cast is spent on the raid
 * clock**, like a step or a line of dialogue, because it is time the player
 * chose to spend standing at the water's edge while the hunter walks. The cast
 * is shown in the dialogue box, as FireRed shows it, and the clock runs through
 * it exactly as it runs through any box the player opened. The fight a bite
 * starts is an ordinary wild fight, rolled by `rollEncounter` like a step in
 * tall grass.
 *
 * Surfing is the other half of FireRed's water and is not here yet: this game's
 * Surf opens a door and moves nobody onto the water. Its slots are recorded in
 * `tools/encounters/frlg-water.json` for when it does.
 */

/** The game's two waters: the sea, and every river, brook, pond and tarn. */
export type FishingWater = keyof typeof FISHING_WATER_SOURCES;

/** The rods, by item id, best last. */
export const ROD_ITEM_IDS = ['old-rod', 'good-rod'] as const;
export type RodItemId = (typeof ROD_ITEM_IDS)[number];

const ROD_SLOTS: Readonly<Record<RodItemId, 'oldRod' | 'goodRod'>> = {
  'old-rod': 'oldRod',
  'good-rod': 'goodRod',
};

/** A second of casting before the first dot: `Fishing3` waits sixty frames. */
export const CAST_MS = 1000;
/** A dot every twenty frames (`Fishing5`). */
export const DOT_MS = 1000 / 3;
/** The first round's dots are `Random() % 10 + 4`, capped at ten (`Fishing4`). */
export const FEWEST_DOTS = 4;
export const MOST_DOTS = 10;

/**
 * The table a rod reads in a water, as a table the encounter machinery rolls.
 * Its step rate is one because whether anything bites at all is the cast's coin
 * (`planCast`), not the table's.
 */
export function fishingTable(water: FishingWater, rod: RodItemId): WildEncounterTable {
  return { stepEncounterRate: 1, entries: FISHING_WATER_SLOTS[water][ROD_SLOTS[rod]] };
}

/**
 * The water at `tile`, the one a line is cast into: the sea where the place says
 * it stands on the sea, and fresh water everywhere else - which is every map
 * a player draws, and every place on the shipped maps but the tidal ones. Asked
 * of the water rather than the bank, because a bank can be the next place over.
 */
export function fishingWaterAt(mapId: WorldMapId, tile: GridPosition): FishingWater {
  return districtAt(mapId, tile)?.water ?? 'fresh';
}

/**
 * Whether a rod can be cast at `tile`: open water that nobody can stand on.
 * A bridge deck is water underneath and ground on top, so it is not; a shut
 * Surf door is, but the door answers the interact key first.
 */
export function isFishingWater(
  map: Pick<WorldMapDefinition, 'terrain' | 'collision'>,
  tile: GridPosition,
): boolean {
  return map.terrain[tile.y]?.[tile.x] === 'water' && map.collision[tile.y]?.[tile.x] === true;
}

/** The best rod the pack holds, or null without one. */
export function bestRod(count: (itemId: string) => number): RodItemId | null {
  return [...ROD_ITEM_IDS].reverse().find((rod) => count(rod) > 0) ?? null;
}

/** One cast, decided before it is shown: how many dots, and whether it bites. */
export interface CastPlan {
  readonly dots: number;
  readonly bites: boolean;
}

/** The cast's two draws, in FireRed's order: the dots, then the coin. */
export function planCast(rng: EncounterRng = Math.random): CastPlan {
  const dots = Math.min(MOST_DOTS, Math.floor(rng() * 10) + FEWEST_DOTS);
  return { dots, bites: rng() < 0.5 };
}

/**
 * How long a cast of `dots` dots stands at the water before it is answered: the
 * cast, a dot every twenty frames, and one more twenty frames in which FireRed
 * finds the row is full (`Fishing5`).
 */
export function castDurationMs(plan: CastPlan): number {
  return CAST_MS + (plan.dots + 1) * DOT_MS;
}

/** The dots showing `elapsedMs` into a cast: the first twenty frames after the cast. */
export function dotsShown(plan: CastPlan, elapsedMs: number): number {
  // `DOT_MS` is a third of a second, which no float holds exactly: without the
  // nudge a dot due on the boundary would land on the next frame instead.
  return Math.max(0, Math.min(plan.dots, Math.floor((elapsedMs - CAST_MS) / DOT_MS + 1e-9)));
}

/**
 * FireRed's own lines (`gText_NotEvenANibble`, `gText_PokemonOnHook` in
 * `src/strings.c`), with the game's three dots for FireRed's two-dot ellipsis.
 */
export const NOT_EVEN_A_NIBBLE = 'Not even a nibble...';
export const ON_THE_HOOK = "A POKéMON's on the hook!";
