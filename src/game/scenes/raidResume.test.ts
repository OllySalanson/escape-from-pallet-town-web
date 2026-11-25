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
import type { RaidCarriage } from '../run/raidCarriage';
import { raidHeartbeat } from '../run/raidInFlight';
import { RAID_RESUME_VERSION, takeUpRaid, writeRaidResume } from '../run/raidResume';
import { createStartingStash } from '../stash';
import type { DeploymentFlow } from '../hub';
import { RAID_RESUME_SUFFIX, SAVE_KEY, SaveManager, type StorageLike } from '../save/SaveManager';
import { HubScene } from './HubScene';

/**
 * A raid survives the page it is played in (`run/raidResume.ts`): written down
 * as it is played, taken up where it stood, and never a way back to before
 * anything. Each case deploys through the hub's own `startRun` and reads only
 * what the next page could - the storage.
 */

class MemoryStorage implements StorageLike {
  public readonly values = new Map<string, string>();
  public refuse: ((key: string) => boolean) | null = null;

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    if (this.refuse?.(key)) {
      throw new Error('QuotaExceededError');
    }
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
}

function seedSave(storage: MemoryStorage): void {
  const stash = createStartingStash();
  const charmander = new Pokemon(CHARMANDER, 9);
  charmander.takeDamage(6);
  stash.addPokemon(charmander, 'charmander-1');
  stash.addItem('potion', 5);
  new SaveManager(storage).save({
    party: new PokemonParty(),
    mapId: 'pallet-town',
    position: { x: 6, y: 8 },
    bag: new Bag(),
    stash,
  });
}

/** Deploys a Charmander with four Potions, and hands back the world the jump starts. */
function deploy(storage: MemoryStorage): RaidCarriage {
  const start = vi.fn();
  const hub = Object.create(HubScene.prototype) as HubInternals;
  Object.assign(hub as unknown as Record<string, unknown>, {
    cameras: { main: { fadeIn: vi.fn(), fadeOut: vi.fn(), once: (_event: string, then: () => void) => then() } },
    scene: { start },
    saveManager: new SaveManager(storage),
    counterCounts: new Map<string, number>(),
    time: { delayedCall: vi.fn() },
    overlay: {
      root: { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] },
      focus: vi.fn(),
      refocus: vi.fn(),
      redraw(markup: string) {
        this.root.innerHTML = markup;
      },
    },
  });
  hub.init();
  hub.flow.togglePokemon('charmander-1');
  hub.flow.setItemQuantity('poke-ball', 0);
  hub.flow.setItemQuantity('potion', 4);
  for (let step = 0; step < 8 && hub.flow.step !== 'confirm'; step += 1) {
    if (hub.flow.advance() !== undefined) {
      break;
    }
  }
  hub.startRun();
  const world = start.mock.calls.find(([key]) => key === 'world')?.[1] as Partial<RaidCarriage> | undefined;
  expect(world?.runSession?.raidId).toBeTruthy();
  // The world packs the rest of the carriage as it is built.
  return {
    party: world!.party!,
    bag: world!.bag!,
    caughtPokemonStash: [],
    runSession: world!.runSession,
    defeatedTrainerIds: [],
    unclaimedBossGear: [],
    collectedLootIds: [],
    seenPrizeIds: [],
    activatedPoiIds: [],
    hunterState: { spawned: false, defeated: false },
    returnLocation: { mapId: 'floodplain-relay', position: { x: 4, y: 5 }, facing: 'up' },
  };
}

const nobodyElse = (): boolean => false;
const recordKey = `${SAVE_KEY}${RAID_RESUME_SUFFIX}`;

describe('a raid taken up after the page it was in went', () => {
  beforeEach(() => {
    if (activeRunManager.phase === RunPhase.InRun) {
      activeRunManager.resolveEscape();
    }
  });

  afterEach(() => {
    raidHeartbeat.stop();
  });

  it('comes back as it stood, under a new id, with nothing settled', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    const raid = deploy(storage);
    const before = new SaveManager(storage).load()!;
    // A few things happen out there: a Potion drunk, the lead hurt, a minute gone.
    raid.bag.remove('potion', 1);
    raid.party.pokemon[0].takeDamage(3);
    raid.runSession!.manager.tick(60_000);
    const hpOut = raid.party.pokemon[0].currentHp;
    expect(writeRaidResume(new SaveManager(storage), 'world', raid)).toBe(true);

    const taken = takeUpRaid(new SaveManager(storage), nobodyElse);

    expect(taken?.scene).toBe('world');
    expect(taken?.data.returnLocation).toEqual(raid.returnLocation);
    expect(taken?.data.bag?.count('potion')).toBe(3);
    expect(taken?.data.party?.pokemon[0]?.currentHp).toBe(hpOut);
    expect(taken?.data.runSession.manager.snapshot().elapsedMs).toBe(60_000);
    const after = new SaveManager(storage).load()!;
    expect(after.raidInFlight?.id).toBe(taken?.data.runSession.raidId);
    expect(after.raidInFlight?.id).not.toBe(raid.runSession!.raidId);
    // Nothing was settled: the vault is the vault the raid left.
    expect(after.stash.listItems()).toEqual(before.stash.listItems());
    expect(after.raidInFlight?.pokemonIds).toEqual(['charmander-1']);
  });

  it('takes a raid up again and again, never settling it', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    writeRaidResume(new SaveManager(storage), 'world', deploy(storage));
    const first = takeUpRaid(new SaveManager(storage), nobodyElse);
    const second = takeUpRaid(new SaveManager(storage), nobodyElse);
    expect(second?.data.returnLocation).toEqual(first?.data.returnLocation);
    expect(new SaveManager(storage).load()?.raidInFlight?.id).toBe(second?.data.runSession.raidId);
  });

  it('leaves the page it was taken from holding nothing: no write, no ending', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    const raid = deploy(storage);
    const oldId = raid.runSession!.raidId!;
    writeRaidResume(new SaveManager(storage), 'world', raid);
    const taken = takeUpRaid(new SaveManager(storage), nobodyElse)!;
    const record = storage.getItem(recordKey);

    // The old page wakes - it was only frozen - and plays on: it writes for its
    // own id, which the save no longer holds, and its ending is not the raid's.
    expect(raid.runSession!.raidId).toBe(oldId);
    expect(writeRaidResume(new SaveManager(storage), 'world', raid)).toBe(false);
    expect(storage.getItem(recordKey)).toBe(record);
    expect(new SaveManager(storage).ownsRaid(oldId)).toBe(false);
    expect(new SaveManager(storage).ownsRaid(taken.data.runSession.raidId)).toBe(true);
  });

  it('is not taken up while another window is playing it', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    const raid = deploy(storage);
    writeRaidResume(new SaveManager(storage), 'world', raid);
    expect(takeUpRaid(new SaveManager(storage), () => true)).toBeNull();
    expect(new SaveManager(storage).load()?.raidInFlight?.id).toBe(raid.runSession!.raidId);
  });

  it('writes a fight down as its own, the other side as the last turn left it', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    const raid = deploy(storage);
    const foes = [{ hp: 4, status: 'poison' as const, sleepTurns: 0, pp: [30, 20] }];
    writeRaidResume(new SaveManager(storage), 'battle', { ...raid, wild: { speciesId: 'pidgey', level: 3, shiny: false } } as RaidCarriage, foes);
    const taken = takeUpRaid(new SaveManager(storage), nobodyElse);
    expect(taken?.scene).toBe('battle');
    expect((taken?.data as { wild?: unknown }).wild).toEqual({ speciesId: 'pidgey', level: 3, shiny: false });
    expect(taken?.foes).toEqual(foes);
  });

  it('is not taken up from a record it cannot trust, which is taken away', () => {
    const cases: Record<string, (storage: MemoryStorage) => void> = {
      garbled: (storage) => storage.setItem(recordKey, '{"v":1,"raidId":'),
      'another version': (storage) => {
        const record = JSON.parse(storage.getItem(recordKey)!) as Record<string, unknown>;
        storage.setItem(recordKey, JSON.stringify({ ...record, v: RAID_RESUME_VERSION + 1 }));
      },
      'another raid': (storage) => {
        const record = JSON.parse(storage.getItem(recordKey)!) as Record<string, unknown>;
        storage.setItem(recordKey, JSON.stringify({ ...record, raidId: 'an-earlier-raid' }));
      },
    };
    for (const [what, spoil] of Object.entries(cases)) {
      if (activeRunManager.phase === RunPhase.InRun) {
        activeRunManager.resolveEscape();
      }
      const storage = new MemoryStorage();
      seedSave(storage);
      const raid = deploy(storage);
      writeRaidResume(new SaveManager(storage), 'world', raid);
      spoil(storage);
      expect(takeUpRaid(new SaveManager(storage), nobodyElse), what).toBeNull();
      expect(storage.getItem(recordKey), what).toBeNull();
      // And so it is the base's to settle as abandoned, as before.
      expect(new SaveManager(storage).load()?.raidInFlight?.id, what).toBe(raid.runSession!.raidId);
    }
  });

  it('takes a record that could not be brought up to date away, rather than leave an old one', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    const raid = deploy(storage);
    expect(writeRaidResume(new SaveManager(storage), 'world', raid)).toBe(true);
    // Later, storage refuses the next write - after a fight went badly, say.
    storage.refuse = (key) => key === recordKey;
    raid.party.pokemon[0].takeDamage(5);
    expect(writeRaidResume(new SaveManager(storage), 'world', raid)).toBe(false);
    storage.refuse = null;
    expect(storage.getItem(recordKey)).toBeNull();
    expect(takeUpRaid(new SaveManager(storage), nobodyElse)).toBeNull();
  });

  it('writes nothing for a raid with no mark, and nothing once the raid is over', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    const raid = deploy(storage);
    const unmarked = { ...raid, runSession: { ...raid.runSession!, raidId: undefined } };
    expect(writeRaidResume(new SaveManager(storage), 'world', unmarked)).toBe(false);
    new SaveManager(storage).settleAbandonedRaid();
    expect(writeRaidResume(new SaveManager(storage), 'world', raid)).toBe(false);
    expect(takeUpRaid(new SaveManager(storage), nobodyElse)).toBeNull();
  });
});
