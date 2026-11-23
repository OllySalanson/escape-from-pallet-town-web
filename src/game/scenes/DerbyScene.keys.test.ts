import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: { Scene: class {} } }));

const { arrowOf } = await import('./DerbyScene');

describe('the keys that choose a line in THE DERBY', () => {
  it('reads the arrows and W A S D', () => {
    expect(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].map(arrowOf)).toEqual(['up', 'down', 'left', 'right']);
    expect(['w', 's', 'a', 'd'].map(arrowOf)).toEqual(['up', 'down', 'left', 'right']);
  });

  // Break-it test, 23 Nov 2026: with Caps Lock on, W A S D chose nothing.
  it('reads W A S D with Caps Lock on', () => {
    expect(['W', 'S', 'A', 'D'].map(arrowOf)).toEqual(['up', 'down', 'left', 'right']);
  });

  it('reads nothing else as an arrow', () => {
    expect(['x', 'Enter', ' ', 'Shift', 'Arrow'].map(arrowOf)).toEqual([null, null, null, null, null]);
  });
});
