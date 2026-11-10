import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
  },
}));

import { GameCornerScene } from './GameCornerScene';
import { Bag } from '../items';
import { CHARMANDER, Pokemon, PokemonParty } from '../pokemon';
import { DEFAULT_RAID_PROGRESS, SaveManager, type StorageLike } from '../save/SaveManager';
import { NO_GAME_CORNER } from '../minigames/tickets';
import { createStartingStash } from '../stash';
import { RELEASE_ARMING_MS } from '../ui/spatialFocus';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
  public removeItem(key: string): void {
    this.values.delete(key);
  }
}

interface WindowInternals {
  ask(id: string): void;
  buy(id: string): void;
  keepTickets(): void;
  onMenuKey(event: KeyboardEvent): void;
  showMenu(focusOn?: string): void;
}

/**
 * THE PRIZE WINDOW over a save holding a thousand tickets, on a clock the test
 * moves. `focused` is where the cursor was put last, which is what the next
 * ENTER presses.
 */
function prizeWindow() {
  const storage = new MemoryStorage();
  const stash = createStartingStash();
  stash.addPokemon(new Pokemon(CHARMANDER, 7), 'charmander-1');
  const saves = new SaveManager(storage);
  saves.save({
    party: new PokemonParty(),
    mapId: 'pallet-town',
    position: { x: 6, y: 8 },
    bag: new Bag(),
    stash,
    raidProgress: { ...DEFAULT_RAID_PROGRESS, gameCorner: { ...NO_GAME_CORNER, tickets: 1_000 } },
  });
  const clock = { now: 10_000 };
  let focused: readonly string[] = [];
  const close = vi.fn();
  const scene = Object.create(GameCornerScene.prototype) as WindowInternals;
  Object.assign(scene as unknown as Record<string, unknown>, {
    saveManager: saves,
    game_: saves.load(),
    mode: 'prizes',
    openedAt: 0,
    asking: undefined,
    askedAt: Number.NEGATIVE_INFINITY,
    time: { get now() { return clock.now; } },
    close,
    overlay: {
      root: { innerHTML: '', setAttribute: () => undefined, querySelector: () => null, querySelectorAll: () => [] },
      redraw(markup: string) {
        this.root.innerHTML = markup;
      },
      refocus: (...selectors: string[]) => {
        focused = selectors;
      },
      moveCursor: () => false,
    },
  });
  scene.showMenu();
  const markup = () => (scene as unknown as { overlay: { root: { innerHTML: string } } }).overlay.root.innerHTML;
  const tickets = () => saves.load()?.raidProgress.gameCorner?.tickets;
  const surfMats = () => saves.load()?.stash.itemCount('surf-mat');
  return { scene, clock, markup, tickets, surfMats, close, focused: () => focused[0] };
}

describe('THE PRIZE WINDOW asks before it spends tickets', () => {
  // A double ENTER on the Surf Mat bought two (the harbour bug hunt of 9 Nov
  // 2026, minor finding 2): every press after the window opened bought at once.
  it('a double ENTER on a prize buys nothing: the second press lands on KEEP THEM', () => {
    const { scene, clock, markup, tickets, surfMats, focused } = prizeWindow();
    scene.ask('surf-mat');
    expect(markup()).toMatch(/data-prize-cancel data-cursor-start[^>]*>Keep them</);
    expect(markup()).toContain('Spend 200 of your 1,000 tickets on Surf Mat?');
    expect(focused()).toBe('[data-prize-cancel]');
    clock.now += 80;
    // The second ENTER presses what the cursor is on.
    scene.keepTickets();
    expect(tickets()).toBe(1_000);
    expect(surfMats()).toBe(0);
    expect(markup()).not.toContain('data-prize-cancel');
  });

  it('buys one when BUY is pressed, and asks again for the next', () => {
    const { scene, clock, markup, tickets, surfMats } = prizeWindow();
    scene.ask('surf-mat');
    clock.now += RELEASE_ARMING_MS;
    scene.buy('surf-mat');
    expect(tickets()).toBe(800);
    expect(surfMats()).toBe(1);
    expect(markup()).not.toContain('data-prize-confirm');
    // BUY pressed again buys nothing: the question has gone.
    scene.buy('surf-mat');
    expect(tickets()).toBe(800);
  });

  it('the second half of a double-click on the row cannot press BUY', () => {
    const { scene, clock, tickets } = prizeWindow();
    scene.ask('surf-mat');
    clock.now += 120;
    scene.buy('surf-mat');
    expect(tickets()).toBe(1_000);
  });

  it('ESC takes the question down first, and only then leaves', () => {
    const { scene, markup, close } = prizeWindow();
    scene.ask('surf-mat');
    const escape = { key: 'Escape', preventDefault: () => undefined } as KeyboardEvent;
    scene.onMenuKey(escape);
    expect(markup()).not.toContain('data-prize-cancel');
    expect(close).not.toHaveBeenCalled();
    scene.onMenuKey(escape);
    expect(close).toHaveBeenCalledOnce();
  });

  it('says at once why a prize cannot be had, with nothing to answer', () => {
    const { scene, markup } = prizeWindow();
    scene.ask('porygon');
    expect(markup()).not.toContain('data-prize-cancel');
    expect(markup()).toContain('px-status');
  });
});
