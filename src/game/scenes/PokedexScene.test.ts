import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubGlobal('requestAnimationFrame', () => 0);

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
  },
}));

import { audioManager } from '../audio/AudioManager';
import type { Pokedex } from '../hub/pokedex';
import { retireMapsForTests, RETIRED_MAPS } from '../world/mapRoster';
import { PokedexScene } from './PokedexScene';

interface DexInternals {
  state: { dex: Pokedex; claimed: readonly number[] };
  cursor: number;
  openPage: number | null;
  pausedBase: boolean;
  readonly page: number | null;
  overlay: {
    root: { innerHTML: string; querySelector: ReturnType<typeof vi.fn>; querySelectorAll: () => never[] };
    focus: ReturnType<typeof vi.fn>;
    moveCursor: ReturnType<typeof vi.fn>;
    remeasure: ReturnType<typeof vi.fn>;
  };
  scene: { stop: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn>; isPaused: () => boolean };
  render(): void;
  onKey(event: Partial<KeyboardEvent>): void;
  openEntry(dexId: number): void;
}

/** Pikachu and Raichu owned, Pidgey and Snorlax only met, everything else an empty ball. */
const DEX: Pokedex = { owned: [25, 26], seen: [16, 25, 26, 143], shiny: [] };

/** THE POKéDEX over the paused harbour, drawn, with the cursor where it opens. */
function pokedex(): DexInternals {
  const scene = Object.create(PokedexScene.prototype) as DexInternals;
  Object.assign(scene as unknown as Record<string, unknown>, {
    state: { dex: DEX, claimed: [] },
    cursor: 16,
    openPage: null,
    pausedBase: true,
    overlay: {
      root: { innerHTML: '', querySelector: vi.fn(() => null), querySelectorAll: () => [] },
      focus: vi.fn(),
      moveCursor: vi.fn(() => true),
      remeasure: vi.fn(),
    },
    scene: { stop: vi.fn(), resume: vi.fn(), isPaused: () => true },
  });
  scene.render();
  return scene;
}

const key = (name: string, extra: Partial<KeyboardEvent> = {}): Partial<KeyboardEvent> => ({
  key: name,
  repeat: false,
  preventDefault: vi.fn(),
  ...extra,
});

describe('THE POKéDEX by keyboard', () => {
  beforeAll(() => retireMapsForTests(RETIRED_MAPS));
  afterAll(() => retireMapsForTests([]));
  let played: ReturnType<typeof vi.fn>;
  let criesAsked: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.restoreAllMocks();
    played = vi.spyOn(audioManager, 'play').mockReturnValue(true);
    criesAsked = vi.spyOn(audioManager, 'loadCries').mockResolvedValue(undefined);
  });

  it('opens on the grid with the cursor on the first kind met', () => {
    const dex = pokedex();
    expect(dex.page).toBeNull();
    expect(dex.overlay.root.innerHTML).toContain('dex-tiles');
    expect(dex.overlay.focus).toHaveBeenLastCalledWith('[data-dex="16"]', '[data-close]');
  });

  it('hands the arrow keys to the cursor on the grid, and keeps them from the page', () => {
    const dex = pokedex();
    for (const arrow of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
      const press = key(arrow);
      dex.onKey(press);
      expect(dex.overlay.moveCursor).toHaveBeenLastCalledWith(arrow);
      expect(press.preventDefault).toHaveBeenCalled();
    }
    expect(dex.page).toBeNull();
  });

  it('opens a kind’s page on ENTER, with the cursor on CRY', () => {
    const dex = pokedex();
    dex.openEntry(25);
    expect(dex.page).toBe(25);
    expect(dex.overlay.root.innerHTML).toContain('data-dex-page="25"');
    expect(dex.overlay.focus).toHaveBeenLastCalledWith('[data-cursor-start]', '[data-dex-list]');
    // Its cry is asked for ahead, so CRY sounds the sample.
    expect(criesAsked).toHaveBeenCalledWith([25]);
  });

  it('opens nothing for an empty ball, and says no', () => {
    const dex = pokedex();
    dex.openEntry(150);
    expect(dex.page).toBeNull();
    expect(played).toHaveBeenCalledWith('denied');
    expect(dex.overlay.root.innerHTML).toContain('dex-tiles');
  });

  it('turns a page to the next kind met with RIGHT and back with LEFT, never to an empty ball', () => {
    const dex = pokedex();
    dex.openEntry(25);
    dex.onKey(key('ArrowRight'));
    expect(dex.page).toBe(26);
    // The next kind met after Raichu is Snorlax, a hundred and seventeen on.
    dex.onKey(key('ArrowRight'));
    expect(dex.page).toBe(143);
    dex.onKey(key('ArrowRight'));
    expect(dex.page).toBe(143);
    expect(played).toHaveBeenLastCalledWith('denied');
    dex.onKey(key('ArrowLeft'));
    dex.onKey(key('ArrowLeft'));
    dex.onKey(key('ArrowLeft'));
    expect(dex.page).toBe(16);
    dex.onKey(key('ArrowLeft'));
    expect(dex.page).toBe(16);
    expect(dex.overlay.moveCursor).not.toHaveBeenCalled();
  });

  it('goes back from a page to the tile it left on ESC and on BACKSPACE', () => {
    for (const back of ['Escape', 'Backspace']) {
      const dex = pokedex();
      dex.openEntry(25);
      dex.onKey(key('ArrowRight'));
      dex.onKey(key(back));
      expect(dex.page).toBeNull();
      expect(dex.scene.stop).not.toHaveBeenCalled();
      expect(dex.overlay.focus).toHaveBeenLastCalledWith('[data-dex="26"]', '[data-close]');
    }
  });

  it('closes on X, ESC or BACKSPACE from the grid, and on X from a page, back to the harbour', () => {
    for (const close of ['x', 'X', 'Escape', 'Backspace']) {
      const dex = pokedex();
      dex.onKey(key(close));
      expect(dex.scene.stop, close).toHaveBeenCalledTimes(1);
      expect(dex.scene.resume, close).toHaveBeenCalledWith('base');
    }
    const dex = pokedex();
    dex.openEntry(25);
    dex.onKey(key('x'));
    expect(dex.scene.stop).toHaveBeenCalledTimes(1);
    expect(dex.scene.resume).toHaveBeenCalledWith('base');
  });

  it('does not close again on the X that opened it, still held', () => {
    const dex = pokedex();
    dex.onKey(key('x', { repeat: true }));
    expect(dex.scene.stop).not.toHaveBeenCalled();
  });

  it('leaves a key held with a modifier to the browser', () => {
    const dex = pokedex();
    dex.onKey(key('x', { ctrlKey: true }));
    expect(dex.scene.stop).not.toHaveBeenCalled();
  });
});
