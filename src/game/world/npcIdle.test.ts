import { describe, expect, it } from 'vitest';
import type { GridPosition } from '../movement/gridMovement';
import {
  IDLE_STEP_MS,
  advanceIdleFigures,
  createIdleFigures,
  idleBeatTiles,
  idleFrames,
  idleHeldTiles,
  stepDirection,
  type IdleFigure,
} from './npcIdle';
import { WORLD_ENTITIES, type WorldEntity } from './npcs';

const townsperson = (overrides: Partial<WorldEntity> = {}): WorldEntity => ({
  id: 'walker',
  mapId: 'pallet-town',
  kind: 'npc',
  position: { x: 4, y: 4 },
  facing: 'down',
  dialogLines: ['Morning.'],
  idle: { roam: [{ x: 5, y: 4 }], glances: ['left'], beatMs: 1000 },
  ...overrides,
});

/** A figure standing exactly on its mark, with its next beat due now. */
const due = (entity: WorldEntity): IdleFigure[] =>
  createIdleFigures([entity], () => 0).map((figure) => ({ ...figure, untilBeatMs: 0 }));

const anywhere = () => true;

describe('an authored beat', () => {
  it('is the tile a person was placed on plus wherever they drift', () => {
    expect(idleBeatTiles(townsperson())).toEqual([
      { x: 4, y: 4 },
      { x: 5, y: 4 },
    ]);
  });

  it('is only the placed tile for anyone with no schedule', () => {
    expect(idleBeatTiles(townsperson({ idle: undefined }))).toEqual([{ x: 4, y: 4 }]);
  });

  it('names the single step between two tiles, and nothing further apart', () => {
    expect(stepDirection({ x: 4, y: 4 }, { x: 5, y: 4 })).toBe('right');
    expect(stepDirection({ x: 4, y: 4 }, { x: 4, y: 3 })).toBe('up');
    expect(stepDirection({ x: 4, y: 4 }, { x: 6, y: 4 })).toBeNull();
    expect(stepDirection({ x: 4, y: 4 }, { x: 5, y: 5 })).toBeNull();
  });
});

describe('townsfolk keeping their own time', () => {
  it('takes only signs and people with a schedule, never a sign', () => {
    const figures = createIdleFigures(
      [townsperson(), townsperson({ id: 'post', kind: 'sign' }), townsperson({ id: 'still', idle: undefined })],
      () => 0.5,
    );

    expect(figures.map(({ id }) => id)).toEqual(['walker']);
  });

  /**
   * A map that has just been built must not fire every figure on the same
   * frame: a street of people all turning at once is a machine, not a place.
   */
  it('staggers the first beat across the people on the map', () => {
    const rolls = [0, 0.5, 1];
    let index = 0;
    const figures = createIdleFigures(
      [townsperson({ id: 'a' }), townsperson({ id: 'b' }), townsperson({ id: 'c' })],
      () => rolls[index++ % rolls.length],
    );

    expect(new Set(figures.map(({ untilBeatMs }) => untilBeatMs)).size).toBe(3);
    for (const figure of figures) {
      expect(figure.untilBeatMs).toBeGreaterThan(0);
      expect(figure.untilBeatMs).toBeLessThanOrEqual(1000);
    }
  });

  it('walks onto a beat tile and turns the way it went', () => {
    const figures = advanceIdleFigures(due(townsperson()), {
      deltaMs: 16,
      frozen: false,
      isTileFree: anywhere,
      random: () => 0,
    });

    expect(figures[0].position).toEqual({ x: 5, y: 4 });
    expect(figures[0].facing).toBe('right');
    expect(figures[0].walk).toEqual({ from: { x: 4, y: 4 }, elapsedMs: 0 });
  });

  /**
   * A stride is elapsed milliseconds, not a tween, so a 100ms test-mode frame
   * covers exactly as much of it as six 16ms ones - the rule `stepClock.ts`
   * holds the player's own walk to, and `cutscene.ts` its actors'.
   */
  it('walks a tile on elapsed time, at the same pace however the frames fall', () => {
    const step = (figures: IdleFigure[], deltaMs: number, ticks: number): IdleFigure[] => {
      let walked = figures;
      for (let tick = 0; tick < ticks; tick += 1) {
        walked = advanceIdleFigures(walked, { deltaMs, frozen: false, isTileFree: anywhere, random: () => 0 });
      }
      return walked;
    };
    const started = advanceIdleFigures(due(townsperson()), {
      deltaMs: 0.0001,
      frozen: false,
      isTileFree: anywhere,
      random: () => 0,
    });

    const coarse = idleFrames(step(started, 100, 1))[0];
    const fine = idleFrames(step(started, 100 / 6, 6))[0];
    expect(coarse.x).toBeCloseTo(fine.x, 6);
    expect(coarse.striding).toBe(true);
    // A third of the way across, so the figure is between its two tiles.
    expect(coarse.x).toBeCloseTo(4 + 100 / IDLE_STEP_MS, 6);

    // And it is over when the stride is, with the next beat counted from there.
    const landed = step(started, IDLE_STEP_MS, 1);
    expect(landed[0].walk).toBeNull();
    expect(landed[0].untilBeatMs).toBe(1000);
    expect(idleFrames(landed)[0]).toEqual({ id: 'walker', x: 5, y: 4, facing: 'right', striding: false });
  });

  /**
   * A figure owns both ends of its step until it is over: the player must never
   * be let through the tile it is crossing.
   */
  it('holds the tile it is leaving until the stride is done', () => {
    const walking = advanceIdleFigures(due(townsperson()), {
      deltaMs: 16,
      frozen: false,
      isTileFree: anywhere,
      random: () => 0,
    });

    expect(idleHeldTiles(walking[0])).toEqual([{ x: 5, y: 4 }, { x: 4, y: 4 }]);
    const landed = advanceIdleFigures(walking, {
      deltaMs: IDLE_STEP_MS,
      frozen: false,
      isTileFree: anywhere,
      random: () => 0,
    });
    expect(idleHeldTiles(landed[0])).toEqual([{ x: 5, y: 4 }]);
  });

  it('turns on the spot when the way is taken rather than forcing the step', () => {
    const figures = advanceIdleFigures(due(townsperson()), {
      deltaMs: 16,
      frozen: false,
      isTileFree: (tile: GridPosition) => !(tile.x === 5 && tile.y === 4),
      random: () => 0,
    });

    expect(figures[0].walk).toBeNull();
    expect(figures[0].position).toEqual({ x: 4, y: 4 });
    expect(figures[0].facing).toBe('left');
  });

  /**
   * A person who steps on every beat is a metronome. Steps and turns are drawn
   * from the same list, so a figure with one roam tile and two glances walks
   * one beat in three.
   */
  it('draws its walking and its looking about from the same list', () => {
    const rolls = [0, 0.5, 0.9];
    let index = 0;
    let figures = due(townsperson());
    const beats: string[] = [];
    for (let beat = 0; beat < rolls.length; beat += 1) {
      const advanced = advanceIdleFigures(figures, {
        deltaMs: 16,
        frozen: false,
        isTileFree: anywhere,
        random: () => rolls[index++ % rolls.length],
      });
      beats.push(advanced[0].walk ? 'stepped' : `turned ${advanced[0].facing}`);
      figures = advanced.map((figure) => ({ ...figure, walk: null, untilBeatMs: 0 }));
    }

    expect(beats.filter((beat) => beat === 'stepped').length).toBe(1);
    expect(beats.filter((beat) => beat.startsWith('turned')).length).toBe(2);
  });

  it('does nothing at all for a figure hemmed in with only one way to look', () => {
    const figures = advanceIdleFigures(
      due(townsperson({ idle: { roam: [{ x: 5, y: 4 }], beatMs: 1000 } })),
      { deltaMs: 16, frozen: false, isTileFree: () => false, random: () => 0 },
    );

    expect(figures[0].walk).toBeNull();
    expect(figures[0].position).toEqual({ x: 4, y: 4 });
    expect(figures[0].untilBeatMs).toBe(1000);
  });

  it('turns on the spot for anyone with nowhere to drift', () => {
    const figures = advanceIdleFigures(
      due(townsperson({ idle: { glances: ['up'], beatMs: 1000 } })),
      { deltaMs: 16, frozen: false, isTileFree: anywhere, random: () => 0 },
    );

    expect(figures[0].walk).toBeNull();
    expect(figures[0].facing).toBe('up');
  });

  /** A person who walked off mid-sentence leaves their own words in the air. */
  it('stops dead while there is something on screen to read', () => {
    const before = due(townsperson());

    const figures = advanceIdleFigures(before, {
      deltaMs: 5000,
      frozen: true,
      isTileFree: anywhere,
      random: () => 0,
    });

    expect(figures).toEqual(before);
  });

  it('counts a frame down rather than beating on every one of them', () => {
    const figures = advanceIdleFigures(createIdleFigures([townsperson()], () => 1), {
      deltaMs: 16,
      frozen: false,
      isTileFree: anywhere,
      random: () => 0,
    });

    expect(figures[0].walk).toBeNull();
    expect(figures[0].untilBeatMs).toBe(1000 - 16);
  });
});

describe('the townsfolk the game ships', () => {
  const beats = WORLD_ENTITIES.filter((entity) => entity.idle !== undefined);

  it('gives a beat only to townsfolk, never to a sign', () => {
    expect(beats.every((entity) => entity.kind === 'npc')).toBe(true);
    expect(beats.length).toBeGreaterThan(0);
  });

  /**
   * Two neighbours on the same interval march in step, and a street of people
   * moving together reads as a machine.
   */
  it('gives every person on a map an interval of their own', () => {
    const byMap = new Map<string, number[]>();
    for (const entity of beats) {
      byMap.set(entity.mapId, [...(byMap.get(entity.mapId) ?? []), entity.idle!.beatMs]);
    }
    for (const [mapId, intervals] of byMap) {
      expect(`${mapId}: ${new Set(intervals).size} of ${intervals.length}`).toBe(
        `${mapId}: ${intervals.length} of ${intervals.length}`,
      );
    }
  });
});
