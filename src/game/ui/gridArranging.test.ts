import { describe, expect, it } from 'vitest';
import { arrangeIntentFor } from './gridArranging';

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
});
