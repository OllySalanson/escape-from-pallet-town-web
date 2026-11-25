import { describe, expect, it } from 'vitest';
import { cycleChoice, isRimArrow, rimChoiceRow, rimKeyMove, rimLandingOrder, type RimRowId } from './rimCard';

const ROWS: readonly { readonly id: RimRowId; readonly choices: number }[] = [
  { id: 'landing', choices: 5 },
  { id: 'job', choices: 3 },
  { id: 'sky', choices: 1 },
];

describe('the jump-in card keys: one key, one job (the captain, 25 Nov 2026)', () => {
  it('moves between the rows with Up and Down, and into the buttons below the last', () => {
    expect(rimKeyMove('ArrowDown', ROWS, { row: 'landing' }, 2, 1)).toEqual({ kind: 'row', row: 'job' });
    expect(rimKeyMove('ArrowDown', ROWS, { row: 'sky' }, 2, 1)).toEqual({ kind: 'button', index: 1 });
    expect(rimKeyMove('ArrowUp', ROWS, { button: 0 }, 2, 1)).toEqual({ kind: 'row', row: 'sky' });
    expect(rimKeyMove('ArrowUp', ROWS, { row: 'landing' }, 2, 1)).toEqual({ kind: 'bump' });
    expect(rimKeyMove('ArrowDown', ROWS, { button: 1 }, 2, 1)).toEqual({ kind: 'bump' });
  });

  it('changes the highlighted row with Left and Right, and never moves the highlight doing it', () => {
    expect(rimKeyMove('ArrowLeft', ROWS, { row: 'landing' }, 2, 1)).toEqual({ kind: 'step', row: 'landing', by: -1 });
    expect(rimKeyMove('ArrowRight', ROWS, { row: 'job' }, 2, 1)).toEqual({ kind: 'step', row: 'job', by: 1 });
    // A row with one value has nothing to change: a bump, never a move somewhere else.
    expect(rimKeyMove('ArrowRight', ROWS, { row: 'sky' }, 2, 1)).toEqual({ kind: 'bump' });
  });

  it('steps between the buttons on the buttons row, and never touches the landing there', () => {
    expect(rimKeyMove('ArrowLeft', ROWS, { button: 1 }, 2, 1)).toEqual({ kind: 'button', index: 0 });
    expect(rimKeyMove('ArrowRight', ROWS, { button: 0 }, 2, 1)).toEqual({ kind: 'button', index: 1 });
    expect(rimKeyMove('ArrowLeft', ROWS, { button: 0 }, 2, 1)).toEqual({ kind: 'bump' });
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
      for (const cursor of [{ button: 0 }, { button: 1 }, { row: 'job' as const }, { row: 'sky' as const }]) {
        const move = rimKeyMove(key, ROWS, cursor, 2, 1);
        expect(move.kind === 'step' && move.row === 'landing').toBe(false);
      }
    }
  });

  it('takes W, A, S and D as the arrows', () => {
    expect(['w', 'a', 's', 'd', 'ArrowUp'].every(isRimArrow)).toBe(true);
    expect(isRimArrow('Enter')).toBe(false);
    expect(rimKeyMove('d', ROWS, { row: 'landing' }, 2, 1)).toEqual({ kind: 'step', row: 'landing', by: 1 });
  });

  it('puts a lost highlight on the button the card opens on', () => {
    expect(rimKeyMove('ArrowUp', ROWS, null, 2, 0)).toEqual({ kind: 'button', index: 0 });
  });
});

describe('the card values', () => {
  it('cycles round both ends', () => {
    expect(cycleChoice(['a', 'b', 'c'], 'c', 1)).toBe('a');
    expect(cycleChoice(['a', 'b', 'c'], 'a', -1)).toBe('c');
    expect(cycleChoice([undefined, 'dusk'], undefined, 1)).toBe('dusk');
  });

  it('orders the landings map by map and west to east, as the pit lies', () => {
    const way = (id: string, mapId: string, x: number, y = 0) => ({ id, mapId, position: { x, y } });
    const order = rimLandingOrder([way('mill', 'vale', 96), way('moor', 'vale', 86), way('dam', 'vale', 286), way('quay', 'other', 1)]);
    expect(order.map((each) => each.id)).toEqual(['moor', 'mill', 'dam', 'quay']);
  });

  it('draws a row as one control, its arrows dim with only one value', () => {
    const row = rimChoiceRow({ id: 'sky', label: 'Sky', value: 'Night', choices: 1, help: 'night, by your own clock' });
    expect(row.match(/<button/g)).toHaveLength(1);
    expect(row).toContain('is-fixed');
    expect(row).toContain('data-rim-row="sky"');
  });
});
