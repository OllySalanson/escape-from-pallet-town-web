import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The bug this suite exists for was only ever visible in a browser, because it
 * was not in any one layer: `WorldScene` captures O, P, B, K, SPACE and ENTER on
 * Phaser's *game-level* KeyboardManager, that manager `preventDefault()`s every
 * captured key for the life of the game, and the overlay's own window listener
 * ran after it and dropped the event as already handled. The player was told
 * "[O] FIELD GUIDE" on the first frame of the first raid, pressed O, and then
 * could only get out with the mouse.
 *
 * So these tests reproduce the layering rather than a rendered pane: a window
 * that dispatches capture-phase listeners before bubble-phase ones, a stand-in
 * for Phaser's KeyboardManager registered first and in the bubble phase exactly
 * as Phaser registers it, and the real `MenuOverlay` on top of both.
 */

vi.mock('phaser', () => ({
  default: {
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
  },
}));

type Listener = (event: KeyboardEvent) => void;

interface FakeKeyInit {
  readonly key: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
  readonly target?: unknown;
}

class FakeKeyEvent {
  public readonly key: string;
  public readonly ctrlKey: boolean;
  public readonly metaKey: boolean;
  public readonly altKey: boolean;
  public readonly target: unknown;
  public defaultPrevented = false;
  public propagationStopped = false;

  public constructor(init: FakeKeyInit) {
    this.key = init.key;
    this.ctrlKey = init.ctrlKey ?? false;
    this.metaKey = init.metaKey ?? false;
    this.altKey = init.altKey ?? false;
    this.target = init.target ?? { tagName: 'BODY' };
  }

  public preventDefault(): void {
    this.defaultPrevented = true;
  }

  public stopPropagation(): void {
    this.propagationStopped = true;
  }
}

/**
 * A window is two stops on an event's path - once on the way down, once on the
 * way back up - so stopping propagation from a capture-phase listener is what
 * keeps a bubble-phase listener on the same window from ever running. That is
 * the whole mechanism the fix relies on, so the fake models it rather than
 * treating every listener as a flat list.
 */
class FakeWindow {
  private readonly capturing: Listener[] = [];
  private readonly bubbling: Listener[] = [];

  public addEventListener(type: string, listener: Listener, useCapture?: boolean): void {
    if (type !== 'keydown') {
      return;
    }
    (useCapture ? this.capturing : this.bubbling).push(listener);
  }

  public removeEventListener(type: string, listener: Listener, useCapture?: boolean): void {
    if (type !== 'keydown') {
      return;
    }
    const listeners = useCapture ? this.capturing : this.bubbling;
    const index = listeners.indexOf(listener);
    if (index >= 0) {
      listeners.splice(index, 1);
    }
  }

  public press(init: FakeKeyInit | string): FakeKeyEvent {
    const event = new FakeKeyEvent(typeof init === 'string' ? { key: init } : init);
    for (const listener of [...this.capturing]) {
      listener(event as unknown as KeyboardEvent);
    }
    if (!event.propagationStopped) {
      for (const listener of [...this.bubbling]) {
        listener(event as unknown as KeyboardEvent);
      }
    }
    return event;
  }
}

/** Enough element for `MenuOverlay` to build and tear down its root. */
class FakeElement {
  public className = '';
  public readonly attributes = new Map<string, string>();
  public removed = false;
  public setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  public addEventListener(): void {}
  public removeEventListener(): void {}
  public append(): void {}
  public remove(): void {
    this.removed = true;
  }
}

/**
 * Stands in for Phaser's game-level KeyboardManager: it listens on the window in
 * the bubble phase, it is registered at boot so it is registered first, and it
 * calls `preventDefault()` on every key some scene has captured - whether or not
 * that scene is the one on screen. `Escape` is in the set because `BattleScene`
 * does `addKey(ESC)`, and `addKey` captures by default.
 */
class FakePhaserKeyboard {
  public readonly seen: string[] = [];
  private readonly captures = new Set(['o', 'p', 'b', 'k', ' ', 'Enter', 'Escape']);

  public attach(target: FakeWindow): void {
    target.addEventListener('keydown', (event) => {
      if (event.defaultPrevented) {
        return;
      }
      if (this.captures.has(event.key)) {
        event.preventDefault();
      }
      this.seen.push(event.key);
    });
  }
}

let fakeWindow: FakeWindow;
let phaser: FakePhaserKeyboard;

beforeEach(() => {
  fakeWindow = new FakeWindow();
  phaser = new FakePhaserKeyboard();
  // Registered before any overlay exists, as Phaser's is registered at boot.
  phaser.attach(fakeWindow);
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: () => new FakeElement(),
      getElementById: () => null,
    },
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window');
  Reflect.deleteProperty(globalThis, 'document');
});

const { MenuOverlay } = await import('./MenuOverlay');
const { isOverlayDismissKey, overlayKeyboardDepth } = await import('./overlayKeyboard');

function openOverlay(): { keys: string[]; destroy: () => void } {
  const keys: string[] = [];
  const scene = { events: { once: () => {} } } as never;
  const overlay = new MenuOverlay(scene, 'test-menu', (event) => keys.push(event.key));
  return { keys, destroy: () => overlay.destroy() };
}

describe('an open overlay owns the keyboard', () => {
  it('receives the key that opened it and the Escape that should close it', () => {
    const overlay = openOverlay();

    fakeWindow.press('o');
    fakeWindow.press('Escape');

    expect(overlay.keys).toEqual(['o', 'Escape']);
    overlay.destroy();
  });

  it('keeps the world underneath from acting on those keys', () => {
    const overlay = openOverlay();

    for (const key of ['o', 'p', 'b', 'ArrowUp', ' ']) {
      fakeWindow.press(key);
    }

    expect(phaser.seen).toEqual([]);
    overlay.destroy();
  });

  it('leaves the browser default intact so the mouse Close button still works from the keyboard', () => {
    const overlay = openOverlay();

    // Nothing underneath preventDefaults SPACE any more, so a focused button is
    // still activated by the browser itself.
    expect(fakeWindow.press(' ').defaultPrevented).toBe(false);
    overlay.destroy();
  });

  it('hands the keyboard back to the game once every overlay is gone', () => {
    const overlay = openOverlay();
    overlay.destroy();

    fakeWindow.press('o');

    expect(overlay.keys).toEqual([]);
    expect(phaser.seen).toEqual(['o']);
    expect(overlayKeyboardDepth()).toBe(0);
  });

  it('gives the key to the topmost overlay only, and to the one below it once that closes', () => {
    const lower = openOverlay();
    const upper = openOverlay();

    fakeWindow.press('o');
    upper.destroy();
    fakeWindow.press('Escape');

    expect(upper.keys).toEqual(['o']);
    expect(lower.keys).toEqual(['Escape']);
    lower.destroy();
  });

  it('leaves a key typed into a text field to the field, and still to nothing below', () => {
    const overlay = openOverlay();

    fakeWindow.press({ key: 'b', target: { tagName: 'TEXTAREA' } });
    fakeWindow.press({ key: 'p', target: { tagName: 'INPUT' } });

    expect(overlay.keys).toEqual([]);
    expect(phaser.seen).toEqual([]);
    overlay.destroy();
  });

  it('releases once however many times a scene tears the overlay down', () => {
    const overlay = openOverlay();
    overlay.destroy();
    overlay.destroy();

    expect(overlayKeyboardDepth()).toBe(0);
  });
});

describe('what closes an overlay', () => {
  const press = (key: string, modifier?: 'ctrl' | 'meta' | 'alt'): KeyboardEvent =>
    new FakeKeyEvent({
      key,
      ctrlKey: modifier === 'ctrl',
      metaKey: modifier === 'meta',
      altKey: modifier === 'alt',
    }) as unknown as KeyboardEvent;

  it('accepts Escape and the key that opened it, in either case', () => {
    expect(isOverlayDismissKey(press('Escape'), 'o')).toBe(true);
    expect(isOverlayDismissKey(press('o'), 'o')).toBe(true);
    expect(isOverlayDismissKey(press('O'), 'o')).toBe(true);
    expect(isOverlayDismissKey(press('Backspace'), 'p', 'Backspace')).toBe(true);
  });

  it('leaves a modified key to the browser, and ignores every other key', () => {
    expect(isOverlayDismissKey(press('o', 'ctrl'), 'o')).toBe(false);
    expect(isOverlayDismissKey(press('b', 'meta'), 'b')).toBe(false);
    expect(isOverlayDismissKey(press('Escape', 'alt'), 'o')).toBe(false);
    expect(isOverlayDismissKey(press('x'), 'o')).toBe(false);
  });
});

describe('every mid-raid overlay closes on the key the HUD says opened it', () => {
  it.each([
    ['ObjectivesScene', "isOverlayDismissKey(event, 'o')"],
    ['PartyScene', "isOverlayDismissKey(event, 'p', 'Backspace')"],
    ['BagScene', "isOverlayDismissKey(event, 'b', 'Backspace')"],
  ])('%s', async (scene, expected) => {
    const source = await readFile(new URL(`../scenes/${scene}.ts`, import.meta.url), 'utf8');
    expect(source).toContain(expected);
  });

  it('routes the result screen through the same ownership rather than its own window listener', async () => {
    const source = await readFile(new URL('../scenes/ExtractionScene.ts', import.meta.url), 'utf8');
    expect(source).toContain("new MenuOverlay(this, 'extraction-menu', (event) => this.handleKey(event))");
    expect(source).not.toContain("window.addEventListener('keydown'");
  });
});
