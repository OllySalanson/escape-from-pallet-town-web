import { PLAYER_ACTOR, type Cutscene, type CutsceneAction } from '../cutscene/cutscene';
import type { ItemId } from '../items';
import type { Direction, GridPosition } from '../movement/gridMovement';
import { markWouldCoverThePlayer } from './cutscenes';
import { withArticle } from '../ui/article';
import { spaceHint } from '../ui/hintLine';
import { pokemonCry, pokemonName, type FigureSpeciesId } from './pokemonFigures';

/**
 * A guard: a wild Pokemon sat in front of something worth having, which comes
 * at the player the moment they step beside it.
 *
 * Every other Pokemon standing in a raid waits to be spoken to. A guard is the
 * one that does not, and it is authored, never rolled, because what makes it a
 * guard is what is behind it: a cache in a dead end, a way through a fence. It
 * stands its ground (no beat), so where it is is where it will be, and it is
 * read three ways before it fights - from across the ground it is a Pokemon
 * parked on a cache; within `GUARD_WATCH_RANGE` it turns to face the player,
 * bobs and the hint line names it, its level and what it guards (as the
 * landmark's own caption does, from further off); and the step that
 * puts the player within `GUARD_REACH` is met with the trainer's own mark, a
 * lunge and its line, and then the fight.
 *
 * Beaten or caught, it is gone for the raid and what it guarded is open - with
 * its hoard, a stone (`GUARD_HOARDS`), on top. Fled from, it is still there:
 * every step the player takes within its reach, and the interact key pressed
 * there at anything at all, brings it on again, so the way past it is through
 * it, and the way back is the way they came: the step that first brought them
 * in came from outside its reach, so a step back that way is always free (a
 * step along the inside of its square is another charge).
 */

/** How near the player may come, in tiles either way, diagonals included. */
export const GUARD_REACH = 1;

/** How near the player is before it turns to watch them, in tiles either way. */
export const GUARD_WATCH_RANGE = 3;

/**
 * A watching guard hops on the spot once every this long, which is what reads in
 * a still picture as well as a moving one: it is ready to go.
 */
export const GUARD_WATCH_HOP_MS = 700;
const GUARD_HOP_MS = 180;
const GUARD_HOP_PIXELS = 3;

/** How far off the ground a watching guard is, `elapsedMs` into its hop cycle, in pixels. */
export function guardHopLift(elapsedMs: number): number {
  const into = elapsedMs % GUARD_WATCH_HOP_MS;
  return into < GUARD_HOP_MS ? Math.round(Math.sin((Math.PI * into) / GUARD_HOP_MS) * GUARD_HOP_PIXELS) : 0;
}

/**
 * What a guard may have been sitting on, had once a save when it is taken and
 * a raid gets home: one of the five stones, which a raid otherwise pays only as
 * a race's purse (`races.ts`), so a guarded landmark is worth the fight it
 * costs - or, for a gentle guard that
 * teaches the rule before any stone is at stake, a Great Ball, so even the
 * first one pays for the fight (`guardsPlaced.test.ts`).
 */
export const GUARD_HOARDS = [
  'thunder-stone',
  'fire-stone',
  'water-stone',
  'leaf-stone',
  'moon-stone',
  'great-ball',
] as const satisfies readonly ItemId[];

export interface Guard {
  /** The standing Pokemon's entity id, which `pokemonMet` records once it is beaten. */
  readonly id: string;
  readonly position: GridPosition;
  readonly species: FigureSpeciesId;
  readonly level: number;
  /** The landmark it guards: its id, its name as the charge says it, and the stone it sits on. */
  readonly guards: {
    readonly poiId: string;
    /** What a save banks its hoard under (`raidProgress.guardHoardsBanked`): stable as the map grows. */
    readonly key: string;
    readonly name: string;
    readonly hoard?: ItemId;
  };
}

/**
 * Whether a guard standing at `guard` reaches the player on `tile`. Beside it,
 * either way or corner to corner - but not round a corner of a wall: a
 * diagonal neighbour with both tiles between them solid is on the other side
 * of something, and nothing about the ground says it is near.
 */
export function guardReaches(
  guard: GridPosition,
  tile: GridPosition,
  isBlocked: (tile: GridPosition) => boolean,
): boolean {
  const dx = tile.x - guard.x;
  const dy = tile.y - guard.y;
  if ((dx === 0 && dy === 0) || Math.abs(dx) > GUARD_REACH || Math.abs(dy) > GUARD_REACH) {
    return false;
  }
  if (dx === 0 || dy === 0) {
    return true;
  }
  return !isBlocked({ x: guard.x + dx, y: guard.y }) || !isBlocked({ x: guard.x, y: guard.y + dy });
}

/** Every walkable tile a guard reaches: the ground a step onto starts its fight. */
export function guardReach(guard: GridPosition, isBlocked: (tile: GridPosition) => boolean): GridPosition[] {
  const tiles: GridPosition[] = [];
  for (let dy = -GUARD_REACH; dy <= GUARD_REACH; dy += 1) {
    for (let dx = -GUARD_REACH; dx <= GUARD_REACH; dx += 1) {
      const tile = { x: guard.x + dx, y: guard.y + dy };
      if (!isBlocked(tile) && guardReaches(guard, tile, isBlocked)) {
        tiles.push(tile);
      }
    }
  }
  return tiles;
}

/**
 * Every tile a map's guards hold: where each stands and all it reaches. Nothing
 * the game deals out - a job's stop, the raid's stake - is put there, because a
 * stop behind a guard would be a fight nobody priced.
 */
export function guardedTiles(
  entities: readonly { readonly position: GridPosition; readonly guards?: unknown }[],
  isBlocked: (tile: GridPosition) => boolean,
): GridPosition[] {
  return entities
    .filter((entity) => entity.guards !== undefined)
    .flatMap((guard) => [guard.position, ...guardReach(guard.position, isBlocked)]);
}

/**
 * Whether a guard is watching the player on `tile`: within `GUARD_WATCH_RANGE`
 * walked steps of a tile it reaches. Walked, not as the crow flies, so a guard
 * on a cliff top does not glare at a player below it who could never come near.
 */
export function guardWatches(
  guard: GridPosition,
  tile: GridPosition,
  isBlocked: (tile: GridPosition) => boolean,
): boolean {
  if (Math.max(Math.abs(tile.x - guard.x), Math.abs(tile.y - guard.y)) > GUARD_WATCH_RANGE + GUARD_REACH) {
    return false;
  }
  const reached = new Set(guardReach(guard, isBlocked).map(({ x, y }) => `${x},${y}`));
  const seen = new Set([`${tile.x},${tile.y}`]);
  let ring = [tile];
  for (let steps = 0; steps <= GUARD_WATCH_RANGE && ring.length > 0; steps += 1) {
    if (ring.some(({ x, y }) => reached.has(`${x},${y}`))) {
      return true;
    }
    const next: GridPosition[] = [];
    for (const { x, y } of ring) {
      for (const step of [
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 },
      ]) {
        const key = `${step.x},${step.y}`;
        if (!seen.has(key) && !isBlocked(step)) {
          seen.add(key);
          next.push(step);
        }
      }
    }
    ring = next;
  }
  return false;
}

/** The guard that comes at a player who has just stepped onto `tile`, if one does. */
export function chargingGuard(
  guards: readonly Guard[],
  tile: GridPosition,
  isBlocked: (tile: GridPosition) => boolean,
): Guard | undefined {
  // Only from ground a player can stand on, as the shading is drawn
  // (`guardReach`): a tile beside it that is solid is not a step anybody takes.
  if (guards.length === 0 || isBlocked(tile)) {
    return undefined;
  }
  return guards.find((guard) => guardReaches(guard.position, tile, isBlocked));
}

/** The nearest guard watching a player on `tile`, if any is. */
export function watchingGuard(
  guards: readonly Guard[],
  tile: GridPosition,
  isBlocked: (tile: GridPosition) => boolean,
): Guard | undefined {
  const distance = (guard: Guard) =>
    Math.max(Math.abs(tile.x - guard.position.x), Math.abs(tile.y - guard.position.y));
  if (guards.length === 0) {
    return undefined;
  }
  return guards
    .filter((guard) => guardWatches(guard.position, tile, isBlocked))
    .sort((a, b) => distance(a) - distance(b))[0];
}

/** Which way to look from one tile at another: along the longer of the two gaps, sideways on a tie. */
export function facingToward(from: GridPosition, to: GridPosition): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) {
    return dx > 0 ? 'right' : 'left';
  }
  return dy > 0 ? 'down' : 'up';
}

/**
 * What a guard says as it comes: its cry, then what it is guarding - or, come
 * at again after a fight the player ran from, only that it is not letting them by.
 */
export function guardChargeLines(guard: Pick<Guard, 'species' | 'guards'>, again = false): readonly string[] {
  const name = pokemonName(guard.species).toUpperCase();
  // The landmark's name as its caption says it, in capitals and with no article,
  // as FireRed names a place: 'the Hive Row' read wrong.
  const place = guard.guards.name.toUpperCase();
  return again
    ? [`The ${name} will not let you near ${place}!`]
    : [pokemonCry(guard.species), `The wild ${name} is guarding ${place}. It will not let you near!`];
}

/** Who and how strong, as the hint line and the landmark's caption say it, in the battle plate's words: GASTLY Lv 12. */
export function guardBadge(guard: Pick<Guard, 'species' | 'level'>): string {
  return `${pokemonName(guard.species).toUpperCase()} Lv ${guard.level}`;
}

/** The hint line while a guard is watching: who, how strong, and what it is sat on. */
export function guardHint(guard: Pick<Guard, 'species' | 'level' | 'guards'>): string {
  return `${guardBadge(guard)} GUARDS ${guard.guards.name.toUpperCase()}`;
}

/** A cache's pay-out as a stack list, as a landmark carries it. */
type Reward = readonly { readonly itemId: string; readonly quantity: number }[];

/**
 * What a guarded landmark pays this raid: all of it, or - once this save has
 * banked its guard's hoard - all but the hoard, which is had once. The map file
 * refuses a hoard the landmark pays anyway (`MapFilePokemon.sitsOn`), so the
 * one stack of that item is the hoard.
 */
export function rewardThisRaid(reward: Reward, hoard: string | undefined, banked: boolean): Reward {
  if (hoard === undefined || !banked) {
    return reward;
  }
  return reward.filter((entry) => entry.itemId !== hoard);
}

/**
 * Whether a raid has had a guard's hoard: the search has handed that piece
 * over (`CacheSearchState.taken`, indices into `searchPieces`). Taken is had -
 * banked on any way home, whatever the pack holds by then, because a stone used
 * on the walk out or dropped to make room was the player's to spend; a raid
 * lost banks nothing, and the hoard is there to fight for again.
 */
export function hoardTaken(pieces: readonly { readonly itemId: string }[], taken: readonly number[], hoard: string): boolean {
  return taken.some((index) => pieces[index]?.itemId === hoard);
}

/** Said on the way back from beating or catching a guard: what is open now, and the stone, if it still sat on one. */
export function guardBeatenLine(species: FigureSpeciesId, place: string, hoardName: string | undefined): string {
  const name = pokemonName(species).toUpperCase();
  return hoardName
    ? `The ${name} has given up ${place.toUpperCase()}, and the ${hoardName.toUpperCase()} it was sitting on!`
    : `The ${name} has given up ${place.toUpperCase()}.`;
}

/** What the interact key does within a guard's reach, for the hint line: [SPACE] FIGHT GASTLY Lv 12. */
export function guardFightHint(guard: Pick<Guard, 'species' | 'level'>): string {
  return `${spaceHint('FIGHT')} ${guardBadge(guard)}`;
}

/**
 * The line a guarded landmark's caption gains while its guard stands: who
 * guards it, and - until this save has carried it home - what it sits on,
 * which is the reason to pick the fight and so is on the map from afar.
 */
export function guardedCaptionLine(guard: Pick<Guard, 'species' | 'level'>, hoardName: string | undefined): string {
  return hoardName ? `${guardBadge(guard)} HAS ${withArticle(hoardName).toUpperCase()}` : `GUARDED BY ${guardBadge(guard)}`;
}

/**
 * The beat timings. The mark is the trainer approach's own length less a
 * little, because the player is already beside it and there is no walk to
 * follow: long enough to find the mark, then the lunge, which is the whole of
 * the difference between being spotted and being gone for.
 */
export const GUARD_ALERT_MS = 450;
export const GUARD_LUNGE_MS = 240;
export const GUARD_SETTLE_MS = 100;

/**
 * A guard coming at the player: they turn to it, the sting and the mark go up
 * over it, it lunges, and it says its line - after which the fight queued
 * behind the line begins. Under a second of the world's own time, so the raid
 * clock does not pay for it, as it does not for a trainer's approach.
 */
export function guardChargeCutscene(
  guard: Guard,
  player: GridPosition,
  lines: readonly string[],
  /** Come at again after a fight the player ran from: no sting and no mark, only the lunge. */
  again = false,
): Cutscene {
  const playerFacing = facingToward(player, guard.position);
  const spotted: CutsceneAction[] = again
    ? []
    : [
        { kind: 'sound', effect: 'trainerSpotted' },
        markWouldCoverThePlayer(guard.position, player)
          ? { kind: 'wait', durationMs: GUARD_ALERT_MS }
          : { kind: 'emote', actor: guard.id, emote: 'spotted', durationMs: GUARD_ALERT_MS },
      ];
  return {
    id: `guard-charge:${guard.id}`,
    actors: {
      [PLAYER_ACTOR]: { ...player, facing: playerFacing },
      [guard.id]: { ...guard.position, facing: facingToward(guard.position, player) },
    },
    actions: [
      { kind: 'turn', actor: PLAYER_ACTOR, facing: playerFacing },
      ...spotted,
      { kind: 'lunge', actor: guard.id, toward: player, durationMs: GUARD_LUNGE_MS },
      { kind: 'wait', durationMs: GUARD_SETTLE_MS },
      { kind: 'say', lines, about: [guard.position] },
    ],
  };
}
