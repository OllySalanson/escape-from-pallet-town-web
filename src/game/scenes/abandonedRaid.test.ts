import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
  },
}));

import { Bag } from '../items';
import { CHARMANDER, Pokemon, PokemonParty } from '../pokemon';
import { activeRunManager, RunPhase } from '../run';
import { setActiveSaveSlot } from '../dev/playtestMode';
import {
  ABANDONED_LINE_LETTERS,
  abandonedRaidLines,
  RAID_PULSE_STALE_MS,
  RaidHeartbeat,
  type AbandonedRaid,
} from '../run/raidInFlight';
import { createStartingStash } from '../stash';
import type { DeploymentFlow } from '../hub';
import { SaveManager, type StorageLike } from '../save/SaveManager';
import { HubScene } from './HubScene';
import { calendarLines, pcLines } from '../base/homeLines';

/**
 * What abandoning a raid costs (the captain's ruling on playtest 11's B1): a
 * raid that never reaches an ending - the tab closed, a reload, a crash - loses
 * the pack and everything in it, and the team comes home.
 *
 * Each case deploys through the hub's own `startRun`, which is the only way
 * into a raid, and then plays a page going away: the save the next page loads
 * is the only thing that survives it, so that is what each case reads.
 */

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

interface HubInternals {
  init(): void;
  startRun(): void;
  readonly flow: DeploymentFlow;
  readonly status: string;
}

/** A save worth abandoning: a hurt Charmander and more medicine than the kit restocks. */
function seedSave(storage: MemoryStorage): void {
  const stash = createStartingStash();
  const charmander = new Pokemon(CHARMANDER, 9);
  charmander.takeDamage(6);
  stash.addPokemon(charmander, 'charmander-1');
  stash.addItem('potion', 5);
  stash.addItem('super-potion', 2);
  new SaveManager(storage).save({
    party: new PokemonParty(),
    mapId: 'pallet-town',
    position: { x: 6, y: 8 },
    bag: new Bag(),
    stash,
  });
}

function openLab(storage: MemoryStorage): { hub: HubInternals; start: ReturnType<typeof vi.fn> } {
  const start = vi.fn();
  const hub = Object.create(HubScene.prototype) as HubInternals;
  Object.assign(hub as unknown as Record<string, unknown>, {
    cameras: { main: { fadeIn: vi.fn(), fadeOut: vi.fn(), once: vi.fn() } },
    scene: { start },
    saveManager: new SaveManager(storage),
    counterCounts: new Map<string, number>(),
    time: { delayedCall: vi.fn() },
    overlay: {
      root: { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] },
      focus: vi.fn(),
      refocus: vi.fn(),
    },
  });
  hub.init();
  return { hub, start };
}

/** Packs the Charmander, four Potions and both Super Potions, and drops in. */
function deployFrom(storage: MemoryStorage): HubInternals {
  const { hub } = openLab(storage);
  hub.flow.togglePokemon('charmander-1');
  hub.flow.setItemQuantity('potion', 4);
  hub.flow.setItemQuantity('super-potion', 2);
  for (let step = 0; step < 8 && hub.flow.step !== 'confirm'; step += 1) {
    if (hub.flow.advance() !== undefined) {
      break;
    }
  }
  hub.startRun();
  return hub;
}

/** The raid's own page, as the next page would see its pulse. */
function tabs(local: MemoryStorage, clock: { now: number }): {
  playing: RaidHeartbeat;
  reloaded: RaidHeartbeat;
  another: RaidHeartbeat;
} {
  const playingSession = new MemoryStorage();
  const now = () => clock.now;
  return {
    playing: new RaidHeartbeat(() => local, () => playingSession, now),
    // A reload keeps its tab's session storage, and so its name.
    reloaded: new RaidHeartbeat(() => local, () => playingSession, now),
    another: new RaidHeartbeat(() => local, () => new MemoryStorage(), now),
  };
}

function raidId(storage: MemoryStorage): string {
  const raid = new SaveManager(storage).load()?.raidInFlight;
  expect(raid).toBeTruthy();
  return raid!.id;
}

describe('a raid abandoned by closing the game', () => {
  const pulses = new MemoryStorage();
  const clock = { now: 1_000_000 };

  beforeEach(() => {
    if (activeRunManager.phase === RunPhase.InRun) {
      activeRunManager.resolveEscape();
    }
    clock.now = 1_000_000;
  });

  afterEach(() => {
    setActiveSaveSlot('normal');
  });

  it('is recorded as under way the moment it deploys, with the pack and what was packed', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    deployFrom(storage);

    const raid = new SaveManager(storage).load()?.raidInFlight;
    expect(raid).toMatchObject({
      mapId: 'floodplain-relay',
      packItemId: 'raid-pack',
      items: { potion: 4, 'super-potion': 2 },
    });
  });

  it('a reload mid-raid loses the pack and everything in it, and brings the team home', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    deployFrom(storage);
    const { playing, reloaded } = tabs(pulses, clock);
    playing.start(raidId(storage));

    // The page reloads: same tab, a moment later, its pulse still fresh.
    clock.now += 1_000;
    const settled = new SaveManager(storage).settleAbandonedRaid((id) => reloaded.liveElsewhere(id));
    playing.stop();

    expect(settled).toEqual<AbandonedRaid>({
      mapId: 'floodplain-relay',
      packItemId: 'raid-pack',
      lost: [
        { itemId: 'potion', quantity: 4 },
        { itemId: 'super-potion', quantity: 2 },
      ],
      kept: [],
    });
    const game = new SaveManager(storage).load()!;
    expect(game.raidInFlight).toBeNull();
    // The pack is gone; what is left is what was never packed, and the
    // Satchel the kit hands to anybody left without a pack.
    expect(game.stash.itemCount('raid-pack')).toBe(0);
    expect(game.stash.itemCount('satchel')).toBe(1);
    expect(game.stash.itemCount('super-potion')).toBe(0);
    expect(game.stash.itemCount('potion')).toBe(4);
    // The team is home, as the vault held it: nobody lost, nobody healed.
    const charmander = game.stash.listPokemon().find((stored) => stored.id === 'charmander-1');
    expect(charmander?.pokemon.currentHp).toBe(charmander!.pokemon.maxHp - 6);
    expect(game.stash.listPokemon().map((stored) => stored.id)).toContain('bulbasaur-1');
  });

  /**
   * THE BOLTHOLE's raid log is read off the same save: a raid the player
   * walked away from is a raid that did not come home, so the PC counts it
   * as lost rather than leaving it out of both columns.
   */
  it('is counted as lost on the raid log at home', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    deployFrom(storage);
    new SaveManager(storage).settleAbandonedRaid();

    const game = new SaveManager(storage).load()!;
    expect(pcLines(game)[0]).toBe('RAID LOG. 1 raid: 0 came home, 1 lost.');
    expect(calendarLines(game)[1]).toBe('It has no tick for coming home.');
  });

  it('closing the tab and opening the game in a new one settles it at once', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    deployFrom(storage);
    const { playing, another } = tabs(pulses, clock);
    playing.start(raidId(storage));

    // Closing the tab takes its pulse with it (`pagehide`).
    playing.stop();
    clock.now += 2_000;

    const settled = new SaveManager(storage).settleAbandonedRaid((id) => another.liveElsewhere(id));
    expect(settled?.lost).toEqual([
      { itemId: 'potion', quantity: 4 },
      { itemId: 'super-potion', quantity: 2 },
    ]);
    expect(new SaveManager(storage).load()?.stash.itemCount('raid-pack')).toBe(0);
  });

  it('a crash leaves a pulse that is believed only until it goes stale', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    deployFrom(storage);
    const { playing, another } = tabs(pulses, clock);
    // The browser dies: its timers never fire again and no `pagehide` runs,
    // so the last pulse is left where it was.
    vi.useFakeTimers();
    playing.start(raidId(storage));
    vi.useRealTimers();

    clock.now += 10_000;
    const settles = () =>
      new SaveManager(storage).settleAbandonedRaid((id) => another.liveElsewhere(id));
    expect(settles()).toBeNull();
    expect(new SaveManager(storage).load()?.stash.itemCount('raid-pack')).toBe(1);

    clock.now += RAID_PULSE_STALE_MS;
    expect(settles()?.packItemId).toBe('raid-pack');
    expect(new SaveManager(storage).load()?.stash.itemCount('raid-pack')).toBe(0);
    // Settled once, never twice.
    expect(settles()).toBeNull();
  });

  it('leaves alone a raid still being played in another tab, and will not deploy a second', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    deployFrom(storage);
    const { playing, another } = tabs(pulses, clock);
    playing.start(raidId(storage));
    clock.now += 3_000;

    expect(
      new SaveManager(storage).settleAbandonedRaid((id) => another.liveElsewhere(id)),
    ).toBeNull();
    expect(new SaveManager(storage).load()?.raidInFlight).toBeTruthy();
    playing.stop();
  });

  it('the secure container brings home what was packed into it, and invents nothing found', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    const saves = new SaveManager(storage);
    const game = saves.load()!;
    saves.save({
      ...game,
      raidInFlight: {
        id: 'secured',
        mapId: 'route-1',
        packItemId: 'raid-pack',
        items: { potion: 4, 'super-potion': 2 },
        // A Potion in the container, and room it kept for a material nobody
        // can say was ever found.
        secured: { potion: 1, 'radio-valve': 1 },
      },
    });

    const settled = saves.settleAbandonedRaid();
    expect(settled?.kept).toEqual([{ itemId: 'potion', quantity: 1 }]);
    expect(settled?.lost).toEqual([
      { itemId: 'potion', quantity: 3 },
      { itemId: 'super-potion', quantity: 2 },
    ]);
    expect(saves.load()?.stash.itemCount('radio-valve')).toBe(0);
  });

  it('costs nothing once the raid has ended, whichever way it ended', () => {
    for (const ending of ['extracted', 'wiped'] as const) {
      const storage = new MemoryStorage();
      seedSave(storage);
      deployFrom(storage);
      const saves = new SaveManager(storage);
      if (ending === 'extracted') {
        saves.bankRun({ pokemon: [], items: [] });
      } else {
        saves.applyWipeLoss([], []);
      }
      if (activeRunManager.phase === RunPhase.InRun) {
        activeRunManager.resolveEscape();
      }
      const before = storage.getItem('escape-from-pallet-town.save.v1');

      expect(saves.load()?.raidInFlight).toBeNull();
      expect(saves.settleAbandonedRaid()).toBeNull();
      expect(storage.getItem('escape-from-pallet-town.save.v1')).toBe(before);
    }
  });

  it('a reload outside a raid costs nothing at all', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    const before = storage.getItem('escape-from-pallet-town.save.v1');

    expect(new SaveManager(storage).settleAbandonedRaid()).toBeNull();
    expect(storage.getItem('escape-from-pallet-town.save.v1')).toBe(before);
  });

  it('is never recorded on the explorer run', () => {
    const storage = new MemoryStorage();
    setActiveSaveSlot('playtest');
    seedSave(storage);
    deployFrom(storage);

    expect(new SaveManager(storage).load()?.raidInFlight ?? null).toBeNull();
  });

  it('sends the lab back to the base rather than deploy over an abandoned raid', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    deployFrom(storage);
    if (activeRunManager.phase === RunPhase.InRun) {
      activeRunManager.resolveEscape();
    }

    const { hub, start } = openLab(storage);
    hub.startRun();
    expect(start).toHaveBeenCalledWith('base', expect.anything());
  });

  it('is told plainly, in the order it happened', () => {
    expect(
      abandonedRaidLines({
        mapId: 'floodplain-relay',
        packItemId: 'raid-pack',
        lost: [
          { itemId: 'potion', quantity: 4 },
          { itemId: 'super-potion', quantity: 1 },
          { itemId: 'poke-ball', quantity: 5 },
        ],
        kept: [{ itemId: 'potion', quantity: 1 }],
      }),
    ).toEqual([
      'The game closed before your raid at Floodplain Relay was over.',
      'Your team made it home, but your Raid pack was left out there.',
      'Lost with it: 4 Potions, 1 Super Potion and 5 Poké Balls.',
      'The secure container kept 1 Potion.',
    ]);
  });

  it('shares a long list over as many boxes as it takes, never one too long to show', () => {
    const lines = abandonedRaidLines({
      mapId: 'viridian-forest',
      packItemId: 'hauler-frame',
      lost: [
        { itemId: 'potion', quantity: 12 },
        { itemId: 'super-potion', quantity: 10 },
        { itemId: 'antidote', quantity: 9 },
        { itemId: 'poke-ball', quantity: 20 },
        { itemId: 'great-ball', quantity: 11 },
        { itemId: 'tm40-aerial-ace', quantity: 1 },
      ],
      kept: [],
    });
    expect(lines.slice(2).every((line) => line.length <= ABANDONED_LINE_LETTERS)).toBe(true);
    expect(lines.slice(2).join(' ')).toMatch(/^Lost with it: 12 Potions, .*Also lost: /);
    for (const word of ['12 Potions', '10 Super Potions', '9 Antidotes', '20 Poké Balls', '11 Great Balls', 'Aerial Ace']) {
      expect(lines.join(' ')).toContain(word);
    }
  });
});
