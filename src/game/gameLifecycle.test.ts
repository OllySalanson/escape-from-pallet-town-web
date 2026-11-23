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

  it("takes away index.html's loading line when the game mounts, so it never sits over the canvas", () => {
    const asked: string[] = [];
    const removed = vi.fn();
    vi.stubGlobal('document', {
      querySelectorAll: (selector: string) => {
        asked.push(selector);
        return selector.split(',').some((part) => part.trim() === '#app > .boot-wait') ? [{ remove: removed }] : [];
      },
    });
    try {
      mountGame(() => ({ destroy: vi.fn() }) as never, {});
    } finally {
      vi.unstubAllGlobals();
    }

    expect(asked).toHaveLength(1);
    expect(removed).toHaveBeenCalledTimes(1);
  });
});
