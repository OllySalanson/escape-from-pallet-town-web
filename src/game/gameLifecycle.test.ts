import { describe, expect, it, vi } from 'vitest';
import { mountGame, unmountGame } from './gameLifecycle';

describe('game lifecycle', () => {
  it('destroys the previous game before mounting a replacement', () => {
    const previous = { destroy: vi.fn() };
    const next = { destroy: vi.fn() };
    const host = { __escapeFromPalletTownGame__: previous };

    expect(mountGame(() => next as never, host)).toBe(next);
    expect(previous.destroy).toHaveBeenCalledWith(true);
    expect(host.__escapeFromPalletTownGame__).toBe(next);
  });

  it('destroys and clears the mounted game during unload', () => {
    const game = { destroy: vi.fn() };
    const host = { __escapeFromPalletTownGame__: game };

    unmountGame(host);

    expect(game.destroy).toHaveBeenCalledWith(true);
    expect(host).not.toHaveProperty('__escapeFromPalletTownGame__');
  });

  it('leaves exactly one game canvas after a replacement mount', () => {
    const elements: { readonly kind: string; removed: boolean; remove(): void }[] = [];
    const app = {
      querySelectorAll: vi.fn(() => elements.filter((element) => !element.removed)),
    };
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { getElementById: vi.fn(() => app) },
    });
    const host = {};
    const createGame = () => {
      const canvas = {
        kind: 'canvas',
        removed: false,
        remove() {
          this.removed = true;
        },
      };
      elements.push(canvas);
      return { destroy: vi.fn() };
    };

    try {
      mountGame(createGame, host);
      mountGame(createGame, host);

      expect(elements.filter((element) => !element.removed && element.kind === 'canvas')).toHaveLength(1);
      expect(app.querySelectorAll).toHaveBeenCalledWith('canvas, .menu-overlay');
    } finally {
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: originalDocument,
      });
    }
  });
});
