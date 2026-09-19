import { DIRECTION_DELTAS, type Direction, type GridPosition } from '../movement/gridMovement';
import type { WorldEntity } from './npcs';

/**
 * Townsfolk who shift and turn on their own small schedules.
 *
 * Four figures standing perfectly still is the clearest "this is a mock-up"
 * tell the overworld has left, and the fix is small - but it is the one kind of
 * small change that can quietly break a map, because a figure blocks its own
 * tile and a map is judged as a network of passages. So a beat is authored
 * rather than wandered: `NpcIdle.roam` is the whole set of tiles a person may
 * ever stand on besides the one they were placed on, `mapStructure.test.ts`
 * holds every map with **all** of them solid at once - which is stricter than
 * any single position the game can actually be in - and this module never
 * invents a tile that is not on that list.
 *
 * Trainers deliberately have no beat. A watch is authored from a trainer's
 * position and facing and is the price on a route; a trainer who turned would
 * move the ground the player is being charged for.
 *
 * Nothing here knows about Phaser or about time of day: it is handed a frame's
 * milliseconds and answers with the beats that fell inside it, so the rules are
 * held in `npcIdle.test.ts` rather than watched on a screen.
 */

export interface NpcIdle {
  /**
   * Tiles besides the authored one this person drifts onto. Each must be one
   * orthogonal step from another tile of the beat, because a beat is walked.
   */
  readonly roam?: readonly GridPosition[];
  /** The ways they look while standing. The authored facing is always one of them. */
  readonly glances?: readonly Direction[];
  /**
   * Milliseconds between beats. Authored per person, and never a round number
   * shared with a neighbour: two townsfolk on the same beat march in step, and
   * a street of people moving together reads as a machine rather than a place.
   */
  readonly beatMs: number;
}

export interface IdleFigure {
  readonly id: string;
  readonly position: GridPosition;
  readonly facing: Direction;
  readonly idle: NpcIdle;
  /** Every tile this figure may stand on, the authored one first. */
  readonly beat: readonly GridPosition[];
  /** Every way this figure may look, the authored one first. */
  readonly glances: readonly Direction[];
  /** Milliseconds left before the next beat. */
  readonly untilBeatMs: number;
}

/** One beat that fell inside a frame: where the figure went, and how it now looks. */
export interface IdleStep {
  readonly id: string;
  readonly from: GridPosition;
  readonly to: GridPosition;
  readonly facing: Direction;
  /** True when the figure stayed where it was and only turned. */
  readonly turnedOnly: boolean;
}

export interface AdvanceIdleOptions {
  readonly deltaMs: number;
  /**
   * True while nothing in the world may move: a dialogue box is open, a
   * question is being asked, the map is fading. A person who walked away
   * mid-sentence would leave their own words hanging in the air.
   */
  readonly frozen: boolean;
  /** Whether a tile is free for this figure to step onto, asked of the live world. */
  readonly isTileFree: (tile: GridPosition) => boolean;
  readonly random: () => number;
}

const sameTile = (left: GridPosition, right: GridPosition): boolean =>
  left.x === right.x && left.y === right.y;

/** Every tile an authored figure may stand on: where it was placed, plus its roam. */
export function idleBeatTiles(entity: WorldEntity): readonly GridPosition[] {
  const roam = entity.idle?.roam ?? [];
  return [entity.position, ...roam.filter((tile) => !sameTile(tile, entity.position))];
}

/** The orthogonal step from one tile to another, or null if they are not neighbours. */
export function stepDirection(from: GridPosition, to: GridPosition): Direction | null {
  const found = (Object.keys(DIRECTION_DELTAS) as Direction[]).find((direction) => {
    const delta = DIRECTION_DELTAS[direction];
    return from.x + delta.x === to.x && from.y + delta.y === to.y;
  });
  return found ?? null;
}

const pick = <T>(items: readonly T[], random: () => number): T | undefined =>
  items[Math.min(items.length - 1, Math.floor(Math.max(0, Math.min(0.999999, random())) * items.length))];

/**
 * The figures a map starts with.
 *
 * The first beat is a random fraction of each person's own interval, so a map
 * that has just been built does not fire every one of them on the same frame -
 * which is what a street of people all turning at once looks like.
 */
export function createIdleFigures(
  entities: readonly WorldEntity[],
  random: () => number,
): IdleFigure[] {
  return entities
    .filter((entity): entity is WorldEntity & { idle: NpcIdle } =>
      entity.kind === 'npc' && entity.idle !== undefined,
    )
    .map((entity) => ({
      id: entity.id,
      position: entity.position,
      facing: entity.facing,
      idle: entity.idle,
      beat: idleBeatTiles(entity),
      glances: [entity.facing, ...(entity.idle.glances ?? []).filter((way) => way !== entity.facing)],
      untilBeatMs: Math.max(1, Math.round(entity.idle.beatMs * (0.3 + random() * 0.7))),
    }));
}

/**
 * Advances every figure by one frame.
 *
 * A beat is a step onto a neighbouring tile of the beat, or - where there is
 * nowhere to go, or the way is taken - a turn on the spot. Nothing is ever
 * forced: a figure whose only roam tile has the player standing on it simply
 * looks somewhere else and tries again next time.
 */
export function advanceIdleFigures(
  figures: readonly IdleFigure[],
  options: AdvanceIdleOptions,
): { readonly figures: IdleFigure[]; readonly steps: readonly IdleStep[] } {
  if (options.frozen || options.deltaMs <= 0) {
    return { figures: [...figures], steps: [] };
  }
  const steps: IdleStep[] = [];
  const next = figures.map((figure) => {
    const untilBeatMs = figure.untilBeatMs - options.deltaMs;
    if (untilBeatMs > 0) {
      return { ...figure, untilBeatMs };
    }
    const beaten = beatFigure(figure, options);
    if (beaten.step) {
      steps.push(beaten.step);
    }
    return beaten.figure;
  });
  return { figures: next, steps };
}

function beatFigure(
  figure: IdleFigure,
  options: AdvanceIdleOptions,
): { readonly figure: IdleFigure; readonly step: IdleStep | null } {
  // The whole interval again, not the overflow: a frame that ran long must not
  // make the next beat arrive early, and test mode hands the world 100ms frames.
  const untilBeatMs = figure.idle.beatMs;
  const ways = figure.beat
    .filter((tile) => !sameTile(tile, figure.position))
    .map((tile) => ({ tile, direction: stepDirection(figure.position, tile) }))
    .filter(
      (way): way is { tile: GridPosition; direction: Direction } =>
        way.direction !== null && options.isTileFree(way.tile),
    );
  const way = pick(ways, options.random);
  if (way) {
    return {
      figure: { ...figure, position: way.tile, facing: way.direction, untilBeatMs },
      step: {
        id: figure.id,
        from: figure.position,
        to: way.tile,
        facing: way.direction,
        turnedOnly: false,
      },
    };
  }
  const elsewhere = figure.glances.filter((glance) => glance !== figure.facing);
  const facing = pick(elsewhere, options.random) ?? figure.facing;
  return {
    figure: { ...figure, facing, untilBeatMs },
    step: {
      id: figure.id,
      from: figure.position,
      to: figure.position,
      facing,
      turnedOnly: true,
    },
  };
}
