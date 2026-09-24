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
 * ever stand on besides the one they were placed on, `mapStructure.testkit.ts`
 * holds every map with **all** of them solid at once - which is stricter than
 * any single position the game can actually be in - and this module never
 * invents a tile that is not on that list.
 *
 * Trainers deliberately have no beat. A watch is authored from a trainer's
 * position and facing and is the price on a route; a trainer who turned would
 * move the ground the player is being charged for.
 *
 * Nothing here knows about Phaser or about time of day: it is handed a frame's
 * milliseconds and answers with where everybody now stands, so the rules are
 * held in `npcIdle.test.ts` rather than watched on a screen. That is the same
 * shape `cutscene/cutscene.ts` has, and deliberately so - but it is not a
 * cutscene and could not be one. A cutscene is a finite authored list that owns
 * the frame, locks the player out and stops the raid clock until it is `done`,
 * and `checkCutscene` caps its self-running time at two seconds. A beat is
 * endless, runs *while* the player walks, and must never take the frame or a
 * millisecond of the clock. What the two do share is how a figure is put on the
 * map: `idleFrames()` answers in fractional tiles exactly as `CutsceneActorFrame`
 * does, and `WorldScene.placeFigure()` is the one place either of them is drawn.
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
  /**
   * The step being walked: the tile behind the figure, and how far through the
   * stride it is. A figure owns both ends of its step until it is over, which
   * is what stops the player being let through the tile it is crossing.
   */
  readonly walk: { readonly from: GridPosition; readonly elapsedMs: number } | null;
}

/**
 * One figure this instant, in fractional tiles - the same answer
 * `CutsceneActorFrame` gives, so the scene draws both the same way.
 */
export interface IdleFigureFrame {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly facing: Direction;
  /** True while the figure is between two tiles, so it is drawn mid-stride. */
  readonly striding: boolean;
}

/**
 * What a walked tile costs a townsperson, in game time.
 *
 * The player's own `STEP_DURATION_MS`, slowed by half: somebody drifting about
 * their own square should never look like they are going anywhere.
 */
export const IDLE_STEP_MS = 300;

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
      walk: null,
    }));
}

/** Where everybody stands this instant, for the scene to draw. */
export function idleFrames(figures: readonly IdleFigure[]): IdleFigureFrame[] {
  return figures.map((figure) => {
    if (!figure.walk) {
      return { id: figure.id, x: figure.position.x, y: figure.position.y, facing: figure.facing, striding: false };
    }
    const gone = Math.min(1, figure.walk.elapsedMs / IDLE_STEP_MS);
    return {
      id: figure.id,
      x: figure.walk.from.x + (figure.position.x - figure.walk.from.x) * gone,
      y: figure.walk.from.y + (figure.position.y - figure.walk.from.y) * gone,
      facing: figure.facing,
      striding: true,
    };
  });
}

/**
 * The tiles a figure is standing on as far as anything walking into it is
 * concerned: where it is, and where it is still leaving.
 */
export function idleHeldTiles(figure: IdleFigure): readonly GridPosition[] {
  return figure.walk ? [figure.position, figure.walk.from] : [figure.position];
}

/**
 * Advances every figure by one frame.
 *
 * A beat is a step onto a neighbouring tile of the beat or a turn on the spot,
 * drawn from the two together: a person who steps on every beat is a
 * metronome, and one who turns as often as they walk reads as somebody waiting.
 * Nothing is ever forced - a figure whose only roam tile has the player
 * standing on it simply looks somewhere else and tries again next time.
 */
export function advanceIdleFigures(
  figures: readonly IdleFigure[],
  options: AdvanceIdleOptions,
): IdleFigure[] {
  if (options.frozen || options.deltaMs <= 0) {
    return [...figures];
  }
  return figures.map((figure) => {
    // A stride finishes whatever else is due: it is already under way, and a
    // beat that landed on top of it would take the figure off two tiles at once.
    if (figure.walk) {
      const elapsedMs = figure.walk.elapsedMs + options.deltaMs;
      return elapsedMs >= IDLE_STEP_MS
        ? { ...figure, walk: null, untilBeatMs: figure.idle.beatMs }
        : { ...figure, walk: { ...figure.walk, elapsedMs } };
    }
    const untilBeatMs = figure.untilBeatMs - options.deltaMs;
    return untilBeatMs > 0 ? { ...figure, untilBeatMs } : beatFigure(figure, options);
  });
}

function beatFigure(figure: IdleFigure, options: AdvanceIdleOptions): IdleFigure {
  // The whole interval again, not the overflow: a frame that ran long must not
  // make the next beat arrive early, and test mode hands the world 100ms frames.
  const untilBeatMs = figure.idle.beatMs;
  const steps = figure.beat
    .filter((tile) => !sameTile(tile, figure.position))
    .map((tile) => ({ tile, direction: stepDirection(figure.position, tile) }))
    .filter(
      (way): way is { tile: GridPosition; direction: Direction } =>
        way.direction !== null && options.isTileFree(way.tile),
    )
    .map((way) => ({ to: way.tile, facing: way.direction }));
  const turns = figure.glances
    .filter((glance) => glance !== figure.facing)
    .map((facing) => ({ to: figure.position, facing }));
  const beat = pick([...steps, ...turns], options.random);
  if (!beat) {
    // Hemmed in and already looking the only way it looks: nothing happens.
    return { ...figure, untilBeatMs };
  }
  if (sameTile(beat.to, figure.position)) {
    return { ...figure, facing: beat.facing, untilBeatMs };
  }
  // The next beat is counted from the far side of the stride, not from here,
  // so a walk is never followed straight away by another one.
  return {
    ...figure,
    position: beat.to,
    facing: beat.facing,
    untilBeatMs,
    walk: { from: figure.position, elapsedMs: 0 },
  };
}
