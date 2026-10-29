import { describe, expect, it } from 'vitest';
import { STEP_DURATION_MS } from '../movement/stepClock';
import { HarbourCrowd, JUMP_AFTER_STEPS } from './harbourCrowd';
import type { HarbourMove } from './harbourProtocol';

const AMY = '0b6c2f4e-1d2a-4c3b-9e8f-7a6b5c4d3e2f';

const walk = (path: [number, number][], facing: HarbourMove['facing'] = 'right', place: HarbourMove['place'] = 'yard'): HarbourMove => ({
  from: AMY,
  place,
  path: path.map(([x, y]) => ({ x, y })),
  facing,
});

const amy = (crowd: HarbourCrowd, place: HarbourMove['place'] = 'yard') => crowd.figuresIn(place)[0];

describe('everybody else in the harbour', () => {
  it('stands a newcomer where they first said they were', () => {
    const crowd = new HarbourCrowd();
    crowd.hear(walk([[10, 10]], 'down'));
    expect(amy(crowd)).toMatchObject({ tile: { x: 10, y: 10 }, toward: null, facing: 'down' });
  });

  it("walks their steps at the game's own pace, one tile a step", () => {
    const crowd = new HarbourCrowd();
    crowd.hear(walk([[10, 10]]));
    crowd.hear(walk([[11, 10], [12, 10]]));
    crowd.advance(STEP_DURATION_MS / 2);
    expect(amy(crowd)).toMatchObject({ tile: { x: 10, y: 10 }, toward: { x: 11, y: 10 }, progress: 0.5, facing: 'right' });
    crowd.advance(STEP_DURATION_MS);
    expect(amy(crowd)).toMatchObject({ tile: { x: 11, y: 10 }, toward: { x: 12, y: 10 } });
    crowd.advance(STEP_DURATION_MS);
    expect(amy(crowd)).toMatchObject({ tile: { x: 12, y: 10 }, toward: null });
  });

  it('walks faster while it is more than a couple of steps behind', () => {
    const crowd = new HarbourCrowd();
    crowd.hear(walk([[10, 10]]));
    crowd.hear(walk([[11, 10], [12, 10], [13, 10], [14, 10]]));
    crowd.advance(STEP_DURATION_MS);
    expect(amy(crowd)?.tile).toEqual({ x: 12, y: 10 });
  });

  it('puts them straight there when what is said is not a step from where they were', () => {
    const crowd = new HarbourCrowd();
    crowd.hear(walk([[10, 10]]));
    crowd.hear(walk([[20, 4]], 'up'));
    expect(amy(crowd)).toMatchObject({ tile: { x: 20, y: 4 }, toward: null, facing: 'up' });
  });

  it('puts them straight there once they are too far behind to walk it', () => {
    const crowd = new HarbourCrowd();
    crowd.hear(walk([[0, 1]]));
    for (let x = 1; x <= JUMP_AFTER_STEPS + 1; x += 1) {
      crowd.hear(walk([[x, 1]]));
    }
    expect(amy(crowd)?.tile).toEqual({ x: JUMP_AFTER_STEPS + 1, y: 1 });
  });

  it('draws them only in the place they are in', () => {
    const crowd = new HarbourCrowd();
    crowd.hear(walk([[10, 10]]));
    crowd.hear(walk([[7, 8]], 'up', 'oaks-lab'));
    expect(crowd.figuresIn('yard')).toEqual([]);
    expect(amy(crowd, 'oaks-lab')?.tile).toEqual({ x: 7, y: 8 });
    // Somewhere else by presence: off the screen until they say where they stand.
    crowd.at(AMY, 'pokemon-centre');
    expect(crowd.figuresIn('oaks-lab')).toEqual([]);
  });

  it('forgets whoever leaves', () => {
    const crowd = new HarbourCrowd();
    crowd.hear(walk([[10, 10]]));
    crowd.forget(AMY);
    expect(crowd.ids()).toEqual([]);
  });
});

describe('the tile somebody last walked off, where their partner stands', () => {
  it('is nowhere until they have taken a step', () => {
    const crowd = new HarbourCrowd();
    crowd.hear(walk([[10, 10]]));
    expect(amy(crowd)?.behind).toBeNull();
  });

  it('is the tile each step left, step by step', () => {
    const crowd = new HarbourCrowd();
    crowd.hear(walk([[10, 10]]));
    crowd.hear(walk([[11, 10], [12, 10]]));
    crowd.advance(STEP_DURATION_MS / 2);
    // Still on the way off the first tile: nothing has been left yet.
    expect(amy(crowd)?.behind).toBeNull();
    crowd.advance(STEP_DURATION_MS / 2);
    expect(amy(crowd)?.behind).toEqual({ x: 10, y: 10 });
    crowd.advance(STEP_DURATION_MS);
    expect(amy(crowd)?.behind).toEqual({ x: 11, y: 10 });
  });

  it('is forgotten when they are put somewhere rather than walk there', () => {
    const crowd = new HarbourCrowd();
    crowd.hear(walk([[10, 10]]));
    crowd.hear(walk([[11, 10]]));
    crowd.advance(STEP_DURATION_MS);
    crowd.hear(walk([[20, 4]], 'up'));
    expect(amy(crowd)?.behind).toBeNull();
  });

  it('is the tile before the last when they are too far behind to walk it', () => {
    const crowd = new HarbourCrowd();
    crowd.hear(walk([[0, 1]]));
    for (let x = 1; x <= JUMP_AFTER_STEPS + 1; x += 1) {
      crowd.hear(walk([[x, 1]]));
    }
    expect(amy(crowd)?.behind).toEqual({ x: JUMP_AFTER_STEPS, y: 1 });
  });

  it('carries the partner they last said they walk with', () => {
    const crowd = new HarbourCrowd();
    crowd.hear({ ...walk([[10, 10]]), partner: 'squirtle' });
    expect(amy(crowd)?.partner).toBe('squirtle');
    crowd.hear({ ...walk([[11, 10]]), partner: 'wartortle' });
    expect(amy(crowd)?.partner).toBe('wartortle');
    crowd.hear(walk([[12, 10]]));
    expect(amy(crowd)?.partner).toBeUndefined();
  });
});

describe('somebody stopping', () => {
  it('finishes the step they are on, drops the rest, and turns as asked', () => {
    const crowd = new HarbourCrowd();
    crowd.hear({ from: AMY, place: 'yard', path: [{ x: 1, y: 1 }], facing: 'right' });
    crowd.hear({ from: AMY, place: 'yard', path: [{ x: 2, y: 1 }, { x: 3, y: 1 }, { x: 4, y: 1 }], facing: 'right' });
    // A quarter of a step: three queued is walked at twice the pace, so this is halfway into the first.
    crowd.advance(STEP_DURATION_MS / 4);
    crowd.halt(AMY, 'down');
    crowd.advance(STEP_DURATION_MS * 4);
    const [figure] = crowd.figuresIn('yard');
    expect(figure).toMatchObject({ tile: { x: 2, y: 1 }, toward: null, facing: 'down' });
  });
});
