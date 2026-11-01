import { MATERIAL_IDS, type ItemId } from '../items';
import type { GridPosition } from '../movement/gridMovement';
import type { SeededRng } from '../run/rng';
import type { WorldMapDefinition, WorldMapId } from '../worldMap';
import type { WorldLoot } from './loot';
import { stepDistances } from './mapStructure';
import { trainerSightTiles, type TrainerWatch } from './trainerSight';

/**
 * **Every raid has something worth staying for** (six strangers played the game
 * and the best play they found was to leave inside a minute: fourteen raids out
 * of fourteen at level 5, nobody hunted, nothing at stake).
 *
 * Three pieces of the raid's own, laid on a stream of their own so nothing else
 * in a seed moves: a little money in sight of the landing, a little more along
 * the way, and **the stake**, a prize a good walk off and a little too far from
 * the nearest way out. All three are ordinary prizes (`loot.ts`), so a light
 * shows them, a caption names them, the chip gives the way and the result screen
 * says what was left. Taking the stake is heard (`HunterPack.comeFor`), so it is
 * paid for on the walk out.
 *
 * And the ground a raid could pick up on its way straight out holds nothing but
 * that first bit of money: `walkOut` is every tile a landing-to-exit walk could
 * call in on for less than `WALK_OUT_TRIP_STEPS`, and the ordinary pool is seated
 * elsewhere. What a piece of the pool is and how many are laid do not change.
 *
 * Every walk here is outdoors and empty-handed, with every figure and every
 * trainer's watch a wall, so the stake can always be reached and carried out with
 * no fight, no field move and no boat. How much further a player has to go for
 * it is measured by `tools/raids/veteranLoop.mts`.
 */

/** The maps a raid has a stake on. A retired map coming back is a row here; a player's map is its maker's to lay. */
const MAPS_WITH_STAKES: readonly WorldMapId[] = ['greystone-vale'];

export const hasRaidStake = (mapId: WorldMapId): boolean => MAPS_WITH_STAKES.includes(mapId);

/** A walk from the landing to here and on to the nearest way out shorter than this holds no ordinary piece: about 18 seconds. */
export const WALK_OUT_TRIP_STEPS = 120;
/** How far the stake lies from the landing, in steps: 13 to 26 seconds on open ground. */
export const STAKE_LEAST_WALK = 90;
export const STAKE_MOST_WALK = 170;
/** The least walk from the stake to the nearest way out: nine seconds with somebody behind you. */
export const STAKE_LEAST_WALK_OUT = 60;

/** How far either way of the landing a thing is on the smallest screen, in tiles: 320x240, with its chips. */
export const IN_SIGHT = { across: 9, down: 6 } as const;
/** The walk to the first money: nearest the first of these that is free, so it is on the way and on the screen. */
const FIRST_MONEY_WALKS = [7, 8, 6, 9, 5, 10, 4] as const;
/** The second money is this share of the way to the stake. */
const SECOND_MONEY_SHARE = 0.55;
/** How far along the route either way the second money may move to find a free tile. */
const SECOND_MONEY_SLACK = 12;

/** What the money on the way pays: almost nothing, on purpose. */
const FIRST_MONEY = 10;
const SECOND_MONEY = 25;

/** What a stake can be, with how often. Money twice over, because it is what the early game was short of. */
const STAKE_MONEY = [60, 75, 90, 110] as const;
const STAKE_SUPPLIES: readonly { readonly itemId: ItemId; readonly quantity: number }[] = [
  { itemId: 'great-ball', quantity: 2 },
  { itemId: 'super-potion', quantity: 2 },
];
/** The most money one raid's trail can come to: under a berth, which keeps the drain a drain (`hub/trader.ts`). */
export const MOST_TRAIL_MONEY = FIRST_MONEY + SECOND_MONEY + Math.max(...STAKE_MONEY);
/** The money a new save's first stake always is: enough to read on the result screen, and never a thing it cannot carry. */
const FIRST_RAID_STAKE_MONEY = 75;

/** The ground's answers for one landing on one map in one gate state. */
export interface StakeGround {
  /** Mask by `y * width + x`: what a walk straight out could call in on. */
  readonly walkOut: Uint8Array;
  /** Where the stake may lie. */
  readonly seats: readonly GridPosition[];
  /** Steps from the landing, -1 where the walk does not reach. */
  readonly steps: readonly Int32Array[];
  /** Mask by `y * width + x`: ground a piece may be seated on at all. */
  readonly standing: Uint8Array;
}

const grounds = new WeakMap<WorldMapDefinition, Map<string, StakeGround | null>>();

interface TileLike {
  readonly x: number;
  readonly y: number;
}

/**
 * The ground as this raid has it, worked out once for a map, landing and set of
 * exits and watches, because `runGeneration.test.ts` deals a raid a great many
 * times and only the seat in here differs. Undefined where there is nowhere fit
 * to lay a stake, in which case the raid is laid as it always was.
 */
export function stakeGround(
  map: WorldMapDefinition,
  landing: GridPosition,
  openExits: readonly TileLike[],
  watches: readonly TrainerWatch[],
  standing: readonly (TileLike & { readonly index: number })[],
): StakeGround | undefined {
  const key = JSON.stringify([landing, openExits.map(({ x, y }) => [x, y]), watches.map(({ position }) => [position.x, position.y])]);
  const known = grounds.get(map) ?? new Map<string, StakeGround | null>();
  grounds.set(map, known);
  const remembered = known.get(key);
  if (remembered !== undefined) {
    return remembered ?? undefined;
  }
  const blocked = new Set<string>();
  for (const entity of map.entities) {
    blocked.add(`${entity.position.x},${entity.position.y}`);
    for (const tile of entity.idle?.roam ?? []) {
      blocked.add(`${tile.x},${tile.y}`);
    }
  }
  const isWall = (tile: GridPosition): boolean => map.collision[tile.y]?.[tile.x] !== false;
  for (const watch of watches) {
    blocked.add(`${watch.position.x},${watch.position.y}`);
    for (const tile of trainerSightTiles(watch, isWall)) {
      blocked.add(`${tile.x},${tile.y}`);
    }
  }
  // Twice over: with every figure and watch a wall, which is the walk that is sure,
  // and on the ground alone, which is the shortest a player who pays a toll can make it.
  const steps = stepDistances(map.collision, landing, blocked);
  const bareSteps = stepDistances(map.collision, landing);
  const nearestBareOut = new Int32Array(map.width * map.height).fill(-1);
  const nearestOut = new Int32Array(map.width * map.height).fill(-1);
  const takeNearest = (into: Int32Array, field: readonly Int32Array[]): void =>
    field.forEach((row, y) =>
      row.forEach((walk, x) => {
        const index = y * map.width + x;
        if (walk >= 0 && (into[index] < 0 || walk < into[index])) {
          into[index] = walk;
        }
      }),
    );
  for (const exit of openExits) {
    if ((bareSteps[exit.y]?.[exit.x] ?? -1) >= 0) {
      takeNearest(nearestBareOut, stepDistances(map.collision, exit));
    }
    if ((steps[exit.y]?.[exit.x] ?? -1) >= 0) {
      takeNearest(nearestOut, stepDistances(map.collision, exit, blocked));
    }
  }
  const standingMask = new Uint8Array(map.width * map.height);
  for (const tile of standing) {
    standingMask[tile.index] = 1;
  }
  const walkOut = new Uint8Array(map.width * map.height);
  const seats: GridPosition[] = [];
  bareSteps.forEach((row, y) =>
    row.forEach((bareWalk, x) => {
      const index = y * map.width + x;
      const bareOut = nearestBareOut[index];
      if (bareWalk < 0 || bareOut < 0) {
        return;
      }
      if (bareWalk + bareOut < WALK_OUT_TRIP_STEPS) {
        walkOut[index] = 1;
      }
      const sureWalk = steps[y][x];
      if (
        bareWalk >= STAKE_LEAST_WALK &&
        sureWalk >= 0 &&
        sureWalk <= STAKE_MOST_WALK &&
        bareOut >= STAKE_LEAST_WALK_OUT &&
        nearestOut[index] >= 0 &&
        standingMask[index] === 1 &&
        !blocked.has(`${x},${y}`)
      ) {
        seats.push({ x, y });
      }
    }),
  );
  const ground = seats.length > 0 ? { walkOut, seats, steps, standing: standingMask } : undefined;
  known.set(key, ground ?? null);
  return ground;
}

/** What this raid's stake holds. */
function stakeContents(rng: SeededRng, firstRaid: boolean): { readonly itemId: ItemId; readonly quantity: number } {
  if (firstRaid) {
    return { itemId: 'money', quantity: FIRST_RAID_STAKE_MONEY };
  }
  const roll = rng.int(1, 10);
  if (roll <= 5) {
    return { itemId: 'money', quantity: rng.pick(STAKE_MONEY) };
  }
  // Two squares to four of them each: a stake that may not go in the pack as it is.
  return roll <= 8 ? { itemId: rng.pick(MATERIAL_IDS), quantity: 2 } : rng.pick(STAKE_SUPPLIES);
}

/** The walk from the landing to `to`, landing first, a tile for each step. */
function walkTo(steps: readonly Int32Array[], to: GridPosition): readonly GridPosition[] {
  const route: GridPosition[] = [to];
  let at = to;
  while ((steps[at.y]?.[at.x] ?? 0) > 0) {
    const walk = steps[at.y][at.x];
    const next = [
      { x: at.x, y: at.y - 1 },
      { x: at.x + 1, y: at.y },
      { x: at.x, y: at.y + 1 },
      { x: at.x - 1, y: at.y },
    ].find((tile) => steps[tile.y]?.[tile.x] === walk - 1);
    if (!next) {
      break;
    }
    route.unshift(next);
    at = next;
  }
  return route;
}

/**
 * The three pieces of one raid, each on a tile nothing else holds. `reserved` is
 * read and added to, as every piece laid does. Each is a prize (`chance: 1`): it
 * is certain, and it is what the light and the chip are for.
 */
export function layStakeTrail(
  mapId: WorldMapId,
  width: number,
  ground: StakeGround,
  reserved: Set<string>,
  rng: SeededRng,
  firstRaid: boolean,
): readonly WorldLoot[] {
  const contents = stakeContents(rng, firstRaid);
  const free = ground.seats.filter((tile) => !reserved.has(`${tile.x},${tile.y}`));
  if (free.length === 0) {
    return [];
  }
  const stake = free[rng.int(0, free.length - 1)];
  const route = walkTo(ground.steps, stake);
  const seat = (tile: GridPosition): boolean =>
    ground.standing[tile.y * width + tile.x] === 1 && !reserved.has(`${tile.x},${tile.y}`);
  const landing = route[0];
  const first = FIRST_MONEY_WALKS.map((walk) => route[walk]).find(
    (tile) =>
      tile !== undefined &&
      seat(tile) &&
      Math.abs(tile.x - landing.x) <= IN_SIGHT.across &&
      Math.abs(tile.y - landing.y) <= IN_SIGHT.down,
  );
  const middle = Math.round(route.length * SECOND_MONEY_SHARE);
  let second: GridPosition | undefined;
  for (let slack = 0; slack <= SECOND_MONEY_SLACK && second === undefined; slack += 1) {
    second = [route[middle - slack], route[middle + slack]].find((tile) => tile !== undefined && seat(tile));
  }
  const piece = (id: string, position: GridPosition, itemId: ItemId, quantity: number): WorldLoot => {
    reserved.add(`${position.x},${position.y}`);
    return { id: `${mapId}/${id}`, position, itemId, quantity, chance: 1 };
  };
  return [
    ...(first ? [piece('stake-money-1', first, 'money', FIRST_MONEY)] : []),
    ...(second ? [piece('stake-money-2', second, 'money', SECOND_MONEY)] : []),
    piece('stake', stake, contents.itemId, contents.quantity),
  ];
}

/** How far along a walk the way mark looks, in steps, to say which way the walk sets off. */
const WAY_AHEAD_STEPS = 8;

/**
 * Where a walk to a tile has got to `WAY_AHEAD_STEPS` from here, down a field of
 * steps to that tile: a straight line at it can point into a wall. The tile itself
 * from anywhere the field does not reach.
 */
export function aheadOnWalk(field: readonly Int32Array[], from: GridPosition, target: GridPosition): GridPosition {
  let at = from;
  if ((field[at.y]?.[at.x] ?? -1) < 0) {
    return target;
  }
  for (let step = 0; step < WAY_AHEAD_STEPS; step += 1) {
    const walk = field[at.y][at.x];
    const next = [
      { x: at.x, y: at.y - 1 },
      { x: at.x + 1, y: at.y },
      { x: at.x, y: at.y + 1 },
      { x: at.x - 1, y: at.y },
    ].find((tile) => (field[tile.y]?.[tile.x] ?? -1) >= 0 && field[tile.y][tile.x] === walk - 1);
    if (!next) {
      return at;
    }
    at = next;
  }
  return at;
}
