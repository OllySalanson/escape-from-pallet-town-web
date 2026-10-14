import { describe, expect, it } from 'vitest';
import { carriedOn, slideReach, slideStops, slideTrail, slides, spinsOn } from './slidingFloor';
import type { Material } from './tileset/materials';

/**
 * FireRed's ice: a step onto it carries on the same way until the next tile
 * cannot be walked onto, or it lands on ground that does not carry.
 */

const LETTERS: Readonly<Record<string, Material>> = {
  '.': 'paving',
  i: 'ice',
  '#': 'wall',
  o: 'ice',
  '^': 'spin-up',
  v: 'spin-down',
  '<': 'spin-left',
  '>': 'spin-right',
  z: 'spin-stop',
};

/** A floor drawn as letters: `.` stone, `i` ice, `#` rock and `o` a boulder on the ice. */
function floor(rows: readonly string[]) {
  const terrain = rows.map((row) => [...row].map((letter) => LETTERS[letter]));
  const isBlocked = ({ x, y }: { x: number; y: number }) => {
    const letter = rows[y]?.[x];
    return letter === undefined || letter === '#' || letter === 'o';
  };
  return { terrain, isBlocked };
}

describe('the floor that carries you on', () => {
  it('is ice, and nothing else', () => {
    expect(slides('ice')).toBe(true);
    expect(slides('paving')).toBe(false);
    expect(slides(undefined)).toBe(false);
  });

  it('keeps the way a step came in on ice, and lets it stop anywhere else', () => {
    const { terrain } = floor(['.ii.']);
    expect(carriedOn(terrain, { x: 1, y: 0 }, 'right')).toBe('right');
    expect(carriedOn(terrain, { x: 3, y: 0 }, 'right')).toBeNull();
  });

  it('carries a step across the ice to the stone beyond it', () => {
    const { terrain, isBlocked } = floor(['.iiii.#']);
    expect(slideStops(terrain, isBlocked, { x: 0, y: 0 }, 'right')).toEqual({ x: 5, y: 0 });
  });

  it('stops against a boulder, on the ice in front of it', () => {
    const { terrain, isBlocked } = floor(['.iiio.']);
    expect(slideStops(terrain, isBlocked, { x: 0, y: 0 }, 'right')).toEqual({ x: 3, y: 0 });
  });

  it('takes no step at all into a wall', () => {
    const { terrain, isBlocked } = floor(['.#']);
    expect(slideStops(terrain, isBlocked, { x: 0, y: 0 }, 'right')).toBeNull();
  });

  it('only stops where something stops it: the tile beside a crossed one may never be reached', () => {
    const { terrain, isBlocked } = floor([
      '#######',
      '#.iii.#',
      '#iiiii#',
      '#######',
    ]);
    const reached = slideReach(terrain, isBlocked, { x: 1, y: 1 }, 7);
    expect(reached.has('5,1')).toBe(true);
    // The middle of the sheet is crossed and never stopped on.
    expect(reached.has('3,2')).toBe(false);
    expect(reached.get('5,1')).toBe(1);
  });
});

/**
 * FireRed's Rocket Hideout arrows (`TryUpdatePlayerSpinDirection`): an arrow
 * spins whoever lands on it on the way it points, whichever way they came; a
 * spin goes on over plain floor, turned by every arrow it crosses, until it
 * lands on a stop plate or something is in the way.
 */
describe('the spinner floor', () => {
  it('is the four arrows, and the plate stops a spin', () => {
    expect(spinsOn('spin-up')).toBe('up');
    expect(spinsOn('spin-left')).toBe('left');
    expect(spinsOn('paving')).toBeUndefined();
    expect(slides('spin-right')).toBe(false);
  });

  it('turns a step the way its arrow points, whichever way it came in', () => {
    const { terrain } = floor(['.^.']);
    expect(carriedOn(terrain, { x: 1, y: 0 }, 'right')).toBe('up');
  });

  it('carries a spin on over plain floor, but not a walk', () => {
    const { terrain } = floor(['...']);
    expect(carriedOn(terrain, { x: 1, y: 0 }, 'right', true)).toBe('right');
    expect(carriedOn(terrain, { x: 1, y: 0 }, 'right', false)).toBeNull();
  });

  it('spins on over the floor beyond an arrow and stops on the plate', () => {
    const { terrain, isBlocked } = floor(['.>..z..#']);
    expect(slideStops(terrain, isBlocked, { x: 0, y: 0 }, 'right')).toEqual({ x: 4, y: 0 });
  });

  it('is turned by every arrow it crosses', () => {
    const { terrain, isBlocked } = floor([
      '#######',
      '#.>..v#',
      '#.....#',
      '#..z.<#',
      '#######',
    ]);
    expect(slideTrail(terrain, isBlocked, { x: 1, y: 1 }, 'right')).toEqual([
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
      { x: 5, y: 2 },
      { x: 5, y: 3 },
      { x: 4, y: 3 },
      { x: 3, y: 3 },
    ]);
  });

  it('stops against whatever is in the way, on the floor in front of it', () => {
    const { terrain, isBlocked } = floor(['.>...#']);
    expect(slideStops(terrain, isBlocked, { x: 0, y: 0 }, 'right')).toEqual({ x: 4, y: 0 });
  });

  it('leaves a player who stood still on an arrow to walk off it', () => {
    const { terrain, isBlocked } = floor(['#^#', '...']);
    // Against the wall the arrow carries nobody: it is where they stopped.
    expect(slideStops(terrain, isBlocked, { x: 1, y: 1 }, 'up')).toEqual({ x: 1, y: 0 });
    expect(slideStops(terrain, isBlocked, { x: 1, y: 0 }, 'down')).toEqual({ x: 1, y: 1 });
  });
});
