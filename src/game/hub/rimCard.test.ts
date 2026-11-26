import { describe, expect, it } from 'vitest';
import { cycleChoice, rimArrowDirection, rimChoiceRow, rimLandingOrder, rimLandingToward, rimTabStep } from './rimCard';

const way = (id: string, x: number, y: number, mapId = 'vale') => ({ id, mapId, position: { x, y } });
// Five lights as the vale's lie in the pit: two up top, one left, the middle, one down right.
const WAYS = [way('moor', 40, 10), way('quarry', 80, 12), way('mill', 20, 40), way('square', 50, 45), way('dam', 85, 80)];

describe('the jump-in card keys: the arrows move between the drop-ins, and only that (the captain, 26 Nov 2026)', () => {
  it('goes to the nearest light that lies the way the arrow points', () => {
    expect(rimLandingToward(WAYS, 'square', 'up')).toBe('moor');
    expect(rimLandingToward(WAYS, 'square', 'left')).toBe('mill');
    expect(rimLandingToward(WAYS, 'square', 'down')).toBe('dam');
    expect(rimLandingToward(WAYS, 'moor', 'right')).toBe('quarry');
    expect(rimLandingToward(WAYS, 'mill', 'right')).toBe('square');
  });

  it('counts a step to the side as twice a step straight on, so Right goes to the light beside, not one a little nearer but further off the line', () => {
    const ways = [way('here', 0, 0), way('beside', 10, 4), way('up-a-bit', 8, -7)];
    expect(rimLandingToward(ways, 'here', 'right')).toBe('beside');
  });

  it('is a bump when nothing lies that way, and never leaves the map the light is on', () => {
    expect(rimLandingToward(WAYS, 'moor', 'up')).toBeNull();
    expect(rimLandingToward(WAYS, 'dam', 'right')).toBeNull();
    // MILL SQUARE's case on the vale: the moor is a little left of it but far above, so it is Up's, not Left's.
    expect(rimLandingToward([way('mill', 20, 40), way('moor', 18, 10)], 'mill', 'left')).toBeNull();
    expect(rimLandingToward([way('mill', 20, 40), way('moor', 18, 10)], 'mill', 'up')).toBe('moor');
    expect(rimLandingToward([...WAYS, way('elsewhere', 99, 45, 'other')], 'dam', 'right')).toBeNull();
  });

  it('takes W, A, S and D as the arrows, and nothing else as one', () => {
    expect(['w', 'a', 's', 'd'].map(rimArrowDirection)).toEqual(['up', 'left', 'down', 'right']);
    expect(rimArrowDirection('ArrowRight')).toBe('right');
    expect(rimArrowDirection('Enter')).toBeNull();
    expect(rimArrowDirection('Tab')).toBeNull();
  });

  it('takes Tab round the rows and JUMP IN, and Shift+Tab back, round from either end', () => {
    expect(rimTabStep(4, -1, false)).toBe(0);
    expect(rimTabStep(4, -1, true)).toBe(3);
    expect(rimTabStep(4, 3, false)).toBe(0);
    expect(rimTabStep(4, 0, true)).toBe(3);
    expect(rimTabStep(0, 0, false)).toBe(-1);
  });
});

describe('the card values', () => {
  it('cycles round both ends', () => {
    expect(cycleChoice(['a', 'b', 'c'], 'c', 1)).toBe('a');
    expect(cycleChoice(['a', 'b', 'c'], 'a', -1)).toBe('c');
    expect(cycleChoice([undefined, 'dusk'], undefined, 1)).toBe('dusk');
  });

  it('orders the landings map by map and west to east, as the pit lies', () => {
    const order = rimLandingOrder([way('mill', 96, 0), way('moor', 86, 0), way('dam', 286, 0), way('quay', 1, 0, 'other')]);
    expect(order.map((each) => each.id)).toEqual(['moor', 'mill', 'dam', 'quay']);
  });

  it('draws a row as one control, its arrows dim with only one value', () => {
    const row = rimChoiceRow({ id: 'sky', label: 'Sky', value: 'Night', choices: 1, help: 'night, by your own clock' });
    expect(row.match(/<button/g)).toHaveLength(1);
    expect(row).toContain('is-fixed');
    expect(row).toContain('data-rim-row="sky"');
  });
});
