import { describe, expect, it } from 'vitest';
import { EMPTY_ARRANGEMENT, packContents } from '../items';
import { arrangeIntentFor, GridArranging } from './gridArranging';

const press = (key: string, modifiers: Partial<KeyboardEvent> = {}) =>
  ({ key, ctrlKey: false, metaKey: false, altKey: false, ...modifiers }) as KeyboardEvent;

describe('what a key means while a container is being arranged', () => {
  it('carries a held piece a square at a time', () => {
    expect(arrangeIntentFor(press('ArrowLeft'), true)).toEqual({ kind: 'move', dx: -1, dy: 0 });
    expect(arrangeIntentFor(press('ArrowRight'), true)).toEqual({ kind: 'move', dx: 1, dy: 0 });
    expect(arrangeIntentFor(press('ArrowUp'), true)).toEqual({ kind: 'move', dx: 0, dy: -1 });
    expect(arrangeIntentFor(press('ArrowDown'), true)).toEqual({ kind: 'move', dx: 0, dy: 1 });
  });

  it('leaves the arrow keys to the cursor when nothing is held', () => {
    expect(arrangeIntentFor(press('ArrowLeft'), false)).toBeNull();
  });

  it('turns a piece whether it is carried or only pointed at', () => {
    expect(arrangeIntentFor(press('r'), true)).toEqual({ kind: 'turn' });
    expect(arrangeIntentFor(press('R'), false)).toEqual({ kind: 'turn' });
  });

  it('puts a piece down with the key that picked it up, and back with Escape', () => {
    expect(arrangeIntentFor(press('Enter'), true)).toEqual({ kind: 'drop' });
    expect(arrangeIntentFor(press(' '), true)).toEqual({ kind: 'drop' });
    expect(arrangeIntentFor(press('Escape'), true)).toEqual({ kind: 'cancel' });
    // With nothing held those keys belong to the screen: ENTER activates the
    // control under the cursor and ESC goes back a step.
    expect(arrangeIntentFor(press('Enter'), false)).toBeNull();
    expect(arrangeIntentFor(press('Escape'), false)).toBeNull();
  });

  it('never reads a key a modifier makes the browser its own', () => {
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey'] as const) {
      expect(arrangeIntentFor(press('r', { [modifier]: true }), true)).toBeNull();
      expect(arrangeIntentFor(press('ArrowLeft', { [modifier]: true }), true)).toBeNull();
    }
  });

  it('takes the piece the cursor is on out with DEL or Backspace, the twin of a right-click (the captain, 2026-10-29)', () => {
    expect(arrangeIntentFor(press('Delete'), false)).toEqual({ kind: 'remove' });
    expect(arrangeIntentFor(press('Backspace'), false)).toEqual({ kind: 'remove' });
    // A piece in the hand is put down or put back first.
    expect(arrangeIntentFor(press('Delete'), true)).toBeNull();
  });
});

/**
 * THE CHEST's mouse (the captain, 28 Nov 2026): hovering is the look, press,
 * drag and release the only move, and a click nothing. Driven through the
 * controller's own listeners on stand-in elements, as a browser would call them.
 */
describe('a container a mouse only drags', () => {
  const SQUARE = 10;
  type Listener = (event: object) => void;
  const listening = () => {
    const on = new Map<string, Listener[]>();
    return {
      on,
      addEventListener: (type: string, listener: Listener) => on.set(type, [...(on.get(type) ?? []), listener]),
      fire: (type: string, event: object) => (on.get(type) ?? []).forEach((listener) => listener(event)),
    };
  };
  const setUp = (pointerType: string) => {
    let packing = packContents({}, { width: 4, height: 4 }, [
      { cargoId: 'a', name: 'A', width: 1, height: 1 },
      { cargoId: 'b', name: 'B', width: 1, height: 1 },
    ], EMPTY_ARRANGEMENT);
    const commits: unknown[] = [];
    const focused: string[] = [];
    const squares = Array.from({ length: 16 }, (_square, index) => ({
      getBoundingClientRect: () => ({ left: (index % 4) * SQUARE, top: Math.floor(index / 4) * SQUARE, width: SQUARE, height: SQUARE }),
    }));
    const grid = {
      ...listening(),
      dataset: { grid: 'stash', gridCols: '4', gridRows: '4' },
      querySelectorAll: () => squares,
      querySelector: () => null,
      classList: { add: () => undefined, remove: () => undefined, contains: () => false },
    };
    const root = { ...listening(), querySelectorAll: () => [grid] };
    const arranging = new GridArranging({
      packing: () => packing,
      commit: (_name, arrangement) => {
        commits.push(arrangement);
        packing = packContents({}, packing.size, [
          { cargoId: 'a', name: 'A', width: 1, height: 1 },
          { cargoId: 'b', name: 'B', width: 1, height: 1 },
        ], arrangement);
      },
      redraw: () => undefined,
      say: () => undefined,
      sound: () => undefined,
      remove: () => true,
      mouseDragOnly: true,
    });
    arranging.attach(root as unknown as ParentNode);
    const at = (x: number, y: number) => ({
      button: 0,
      pointerType,
      clientX: x * SQUARE + 5,
      clientY: y * SQUARE + 5,
      detail: 1,
      target: { closest: () => ({ focus: () => focused.push('piece'), dataset: {} }) },
      preventDefault: () => undefined,
    });
    const placed = (id: string) => packing.cargo.find((piece) => piece.cargoId === id);
    return { arranging, grid, root, at, commits, focused, placed };
  };

  it('does nothing for a mouse click: nothing picked up, the cursor left where it was', () => {
    const { arranging, grid, root, at, commits, focused } = setUp('mouse');
    grid.fire('pointerdown', at(0, 0));
    grid.fire('pointerup', at(0, 0));
    root.fire('pointerup', at(0, 0));
    grid.fire('click', at(0, 0));
    expect(arranging.held).toBeUndefined();
    expect(commits).toEqual([]);
    expect(focused).toEqual([]);
  });

  it('moves a thing by press, drag and release, and leaves nothing carried', () => {
    const { arranging, grid, root, at, placed } = setUp('mouse');
    const from = placed('a')!;
    grid.fire('pointerdown', at(from.x, from.y));
    grid.fire('pointermove', at(2, 3));
    grid.fire('pointerup', at(2, 3));
    root.fire('pointerup', at(2, 3));
    grid.fire('click', at(2, 3));
    expect(arranging.held).toBeUndefined();
    expect(placed('a')).toMatchObject({ x: 2, y: 3 });
  });

  it('puts a thing back where it was when it is let go where nothing fits', () => {
    const { arranging, grid, at, commits, placed } = setUp('mouse');
    const a = placed('a')!;
    const b = placed('b')!;
    grid.fire('pointerdown', at(a.x, a.y));
    grid.fire('pointermove', at(b.x, b.y));
    grid.fire('pointerup', at(b.x, b.y));
    expect(arranging.held).toBeUndefined();
    expect(commits).toEqual([]);
    expect(placed('a')).toMatchObject({ x: a.x, y: a.y });
  });

  it('puts a thing back when the drag is let go off every container', () => {
    const { arranging, grid, root, at, commits } = setUp('mouse');
    grid.fire('pointerdown', at(0, 0));
    grid.fire('pointermove', at(2, 2));
    root.fire('pointerup', at(9, 9));
    expect(arranging.held).toBeUndefined();
    expect(commits).toEqual([]);
  });

  it('takes nothing out on a right-click', () => {
    let removed = 0;
    const { grid, at } = setUp('mouse');
    const arranging = new GridArranging({
      packing: () => null,
      commit: () => undefined,
      redraw: () => undefined,
      say: () => undefined,
      sound: () => undefined,
      remove: () => (removed += 1) > 0,
      mouseDragOnly: true,
    });
    arranging.attach({ addEventListener: () => undefined, querySelectorAll: () => [grid] } as unknown as ParentNode);
    grid.fire('contextmenu', at(0, 0));
    expect(removed).toBe(0);
  });

  it('keeps a touch tap as it was: the tap picks the thing up and moves the cursor to it', () => {
    const { arranging, grid, at, focused } = setUp('touch');
    grid.fire('pointerdown', at(0, 0));
    grid.fire('pointerup', at(0, 0));
    grid.fire('click', at(0, 0));
    expect(focused).toEqual(['piece']);
    expect(arranging.held).toBeDefined();
  });
});
