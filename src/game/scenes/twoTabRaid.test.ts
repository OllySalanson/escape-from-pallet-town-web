import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
  },
}));

import { Bag } from '../items';
import { CHARMANDER, PIDGEY, Pokemon, PokemonParty } from '../pokemon';
import { activeRunManager, RunPhase } from '../run';
import { RAID_PULSE_KEY, RaidHeartbeat } from '../run/raidInFlight';
import { createStartingStash, type RaidCondition } from '../stash';
import type { DeploymentFlow } from '../hub';
import { SaveManager, spareAtBase, type StorageLike } from '../save/SaveManager';
import { HubScene } from './HubScene';

/**
 * Two tabs share one save (the battles, saves, raids, harbour and vale hunts
 * of 9 November). Tab A deploys a raid; tab B opens the base on the same save,
 * because the raid is live elsewhere and is rightly not settled as abandoned.
 * The raid's ending writes its own copy of every Pokemon it took back over the
 * vault and charges what it spent against the vault's supplies, so whatever
 * tab B did to those Pokemon or to the packed supplies was undone or doubled:
 * a Pidgey left at the Day-Care dodged the wipe that took it on screen, a
 * Leftovers taken off came home a second time, a Focus Band given was deleted.
 *
 * Each case plays the tabs in the order the reports did, on one storage: tab A
 * deploys through the hub's own `startRun`, tab B is a second hub opened after
 * it, and tab A's ending is the save's own ending, handed the raid's id as the
 * world hands it.
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
  leaveAtDayCare(pokemonId: string): void;
  takeGear(pokemonId: string): void;
  giveGear(pokemonId: string, itemId: string): void;
  recover(ids: readonly string[]): void;
  treat(pokemonId: string, itemId: string): void;
  readonly flow: DeploymentFlow;
  readonly status: string | undefined;
}

/**
 * Charmander holding Leftovers, a Pidgey Lv 12, the starter Bulbasaur, a Focus
 * Band in storage and medicine to pack.
 */
function seedSave(storage: MemoryStorage): void {
  const stash = createStartingStash();
  const charmander = new Pokemon(CHARMANDER, 9);
  charmander.giveHeldItem('leftovers');
  charmander.takeDamage(6);
  stash.addPokemon(charmander, 'charmander-1');
  stash.addPokemon(new Pokemon(PIDGEY, 12), 'pidgey-1');
  stash.listPokemon().find((stored) => stored.id === 'bulbasaur-1')!.pokemon.takeDamage(4);
  stash.addItem('focus-band', 1);
  stash.addItem('potion', 5);
  new SaveManager(storage).save({
    party: new PokemonParty(),
    mapId: 'pallet-town',
    position: { x: 6, y: 8 },
    bag: new Bag(),
    stash,
  });
}

function openBase(storage: MemoryStorage): HubInternals {
  const hub = Object.create(HubScene.prototype) as HubInternals;
  Object.assign(hub as unknown as Record<string, unknown>, {
    cameras: { main: { fadeIn: vi.fn(), fadeOut: vi.fn(), once: vi.fn() } },
    scene: { start: vi.fn() },
    saveManager: new SaveManager(storage),
    counterCounts: new Map<string, number>(),
    time: { delayedCall: vi.fn(), removeEvent: vi.fn() },
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
  return hub;
}

/** Tab A: Charmander and Pidgey on the bench, four Potions packed, and over the rim. */
function deployFrom(storage: MemoryStorage): string {
  const hub = openBase(storage);
  hub.flow.togglePokemon('charmander-1');
  hub.flow.togglePokemon('pidgey-1');
  hub.flow.setItemQuantity('poke-ball', 0);
  hub.flow.setItemQuantity('potion', 4);
  for (let step = 0; step < 8 && hub.flow.step !== 'confirm'; step += 1) {
    if (hub.flow.advance() !== undefined) {
      break;
    }
  }
  hub.startRun();
  const raid = new SaveManager(storage).load()?.raidInFlight;
  expect(raid?.pokemonIds).toEqual(['charmander-1', 'pidgey-1']);
  return raid!.id;
}

/** How each deployed Pokemon came home, as the world hands it to an ending. */
function cameHome(storage: MemoryStorage, changes: Partial<Record<string, Partial<RaidCondition>>> = {}): RaidCondition[] {
  const stash = new SaveManager(storage).load()!.stash;
  return ['charmander-1', 'pidgey-1'].map((id) => {
    const pokemon = stash.listPokemon().find((stored) => stored.id === id)!.pokemon;
    return {
      id,
      currentHp: pokemon.currentHp,
      primaryStatus: pokemon.primaryStatus,
      experience: pokemon.experience,
      speciesId: pokemon.base.id,
      heldItemId: pokemon.heldItemId,
      moves: pokemon.moves.map((move) => move.base.name),
      pendingMoves: [],
      ...changes[id],
    };
  });
}

function stashOf(storage: MemoryStorage) {
  return new SaveManager(storage).load()!.stash;
}

describe('a raid out in one tab, and the base open in another', () => {
  beforeEach(() => {
    if (activeRunManager.phase === RunPhase.InRun) {
      activeRunManager.resolveEscape();
    }
  });

  afterEach(() => {
    if (activeRunManager.phase === RunPhase.InRun) {
      activeRunManager.resolveEscape();
    }
  });

  it('the Day-Care Man will not take a Pokémon that is out, so the wipe takes it', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    const raidId = deployFrom(storage);

    // Tab B opens after the deploy, so its copy of the save is current.
    const tabB = openBase(storage);
    tabB.leaveAtDayCare('pidgey-1');
    expect(tabB.status).toBe('Your Pidgey is out on a raid in your other window. Bring it to me once it’s home.');
    expect(stashOf(storage).dayCare()).toBeNull();

    // Nor can any screen get round him: the save itself refuses the write.
    const game = new SaveManager(storage).load()!;
    game.stash.leaveAtDayCare('pidgey-1', 0);
    expect(new SaveManager(storage).save(game)).toBe(false);
    expect(new SaveManager(storage).raidHold(game)).toEqual({ kind: 'pokemon', pokemonId: 'pidgey-1' });

    // Tab A loses both; the wipe takes the Pidgey it said it took.
    expect(new SaveManager(storage).applyWipeLoss(['charmander-1', 'pidgey-1'], [{ itemId: 'potion', quantity: 4 }], {}, [], 'raid-pack', raidId)).toBe(true);
    const after = stashOf(storage);
    expect(after.dayCare()).toBeNull();
    expect(after.listPokemon().map((stored) => stored.id)).not.toContain('pidgey-1');
    expect(new SaveManager(storage).load()?.raidInFlight).toBeNull();
  });

  it('gear on a Pokémon that is out stays put, so an extraction brings one Leftovers home, not two', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    const raidId = deployFrom(storage);

    const tabB = openBase(storage);
    tabB.takeGear('charmander-1');
    expect(tabB.status).toBe('Charmander is out on a raid in your other window. Finish it there first.');
    tabB.giveGear('pidgey-1', 'focus-band');
    expect(tabB.status).toBe('Pidgey is out on a raid in your other window. Finish it there first.');
    const game = new SaveManager(storage).load()!;
    game.stash.takeHeldItem('charmander-1');
    expect(new SaveManager(storage).save(game)).toBe(false);

    // Tab A walks out with everyone as they went.
    expect(new SaveManager(storage).bankRun({ pokemon: [], items: [] }, { condition: cameHome(storage), supplies: [] }, 120_000, raidId)).toBe(true);
    const after = stashOf(storage);
    expect(after.holdingCount('leftovers')).toBe(1);
    expect(after.holdingCount('focus-band')).toBe(1);
    expect(after.listPokemon().find((stored) => stored.id === 'charmander-1')?.pokemon.heldItemId).toBe('leftovers');
  });

  it('an extraction banks what a Pokémon did out there, because nothing at base moved it', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    const raidId = deployFrom(storage);
    const pidgey = stashOf(storage).listPokemon().find((stored) => stored.id === 'pidgey-1')!.pokemon;
    const grown = pidgey.experience + 2_000;

    openBase(storage).leaveAtDayCare('pidgey-1');
    expect(new SaveManager(storage).bankRun({ pokemon: [], items: [] }, { condition: cameHome(storage, { 'pidgey-1': { experience: grown } }), supplies: [] }, 120_000, raidId)).toBe(true);

    const home = stashOf(storage).listPokemon().find((stored) => stored.id === 'pidgey-1')?.pokemon;
    expect(home?.experience).toBe(grown);
    expect(home!.level).toBeGreaterThan(12);
  });

  it('Nurse Joy heals only who is at base, and the heal she books is still owed after the raid ends', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    const raidId = deployFrom(storage);

    const outcome = new SaveManager(storage).healAtCenter();
    expect(outcome?.recoveredIds).toEqual(['bulbasaur-1']);
    const booked = new SaveManager(storage).load()!.pendingRecoveryMs;
    expect(booked).toBeGreaterThan(0);
    const charmander = stashOf(storage).listPokemon().find((stored) => stored.id === 'charmander-1')!.pokemon;
    expect(charmander.currentHp).toBe(charmander.maxHp - 6);

    // Tab B's own screen refuses the one that is out, and says why.
    const tabB = openBase(storage);
    tabB.recover(['charmander-1']);
    expect(tabB.status).toBe('Charmander is out on a raid in your other window. Finish it there first.');

    // Tab A's raid deployed owing nothing, so its ending pays off nothing:
    // the heal booked in tab B is owed by the next raid.
    expect(new SaveManager(storage).bankRun({ pokemon: [], items: [] }, { condition: cameHome(storage), supplies: [] }, 120_000, raidId)).toBe(true);
    expect(new SaveManager(storage).load()!.pendingRecoveryMs).toBe(booked);
  });

  it('a packed Potion cannot be spent at base as well as in the field', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    deployFrom(storage);

    const game = new SaveManager(storage).load()!;
    const held = game.stash.itemCount('potion');
    expect(spareAtBase(game, 'potion')).toBe(held - 4);

    // What was left at base can be spent there; what was packed cannot.
    game.stash.removeItem('potion', held - 4);
    expect(new SaveManager(storage).save(game)).toBe(true);
    const again = new SaveManager(storage).load()!;
    again.stash.removeItem('potion', 1);
    expect(new SaveManager(storage).raidHold(again)).toEqual({ kind: 'item', itemId: 'potion' });
    expect(new SaveManager(storage).save(again)).toBe(false);

    const tabB = openBase(storage);
    tabB.treat('bulbasaur-1', 'potion');
    expect(tabB.status).toBe('That is packed for the raid in your other window. Finish it there first.');
  });

  it('everything is back to normal once the raid has ended', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    const raidId = deployFrom(storage);
    new SaveManager(storage).bankRun({ pokemon: [], items: [] }, { condition: cameHome(storage), supplies: [] }, 120_000, raidId);

    const game = new SaveManager(storage).load()!;
    game.stash.leaveAtDayCare('pidgey-1', 0);
    game.stash.takeHeldItem('charmander-1');
    expect(new SaveManager(storage).save(game)).toBe(true);
  });
});

describe('a raid settled as abandoned while its tab was frozen', () => {
  beforeEach(() => {
    if (activeRunManager.phase === RunPhase.InRun) {
      activeRunManager.resolveEscape();
    }
  });

  it('comes home to nothing, and leaves the raid another tab has since deployed alone', () => {
    const storage = new MemoryStorage();
    seedSave(storage);
    const frozen = deployFrom(storage);

    // Tab A goes quiet past the pulse; tab B opens the base and settles it.
    expect(new SaveManager(storage).settleAbandonedRaid()?.packItemId).toBe('raid-pack');
    activeRunManager.resolveEscape();
    // And deploys the same team again.
    const live = deployFrom(storage);
    expect(live).not.toBe(frozen);
    const before = storage.getItem('escape-from-pallet-town.save.v1');

    // Tab A wakes up and walks out, or is caught. Every ending is refused.
    const saves = new SaveManager(storage);
    expect(saves.ownsRaid(frozen)).toBe(false);
    expect(saves.bankRun({ pokemon: [], items: [] }, { condition: cameHome(storage), supplies: [{ itemId: 'raid-pack', quantity: 0 }] }, 120_000, frozen)).toBe(false);
    expect(saves.bankContract('first-contract', { pokemon: [], items: [] }, undefined, 120_000, frozen)).toEqual({ saved: false, granted: false });
    expect(saves.applyWipeLoss(['charmander-1', 'pidgey-1'], [], {}, [], 'raid-pack', frozen)).toBe(false);
    expect(saves.recordRaidEnded('greystone-vale', 'extracted', undefined, undefined, 120_000, frozen)).toBe(false);

    // Nothing moved: tab B's raid is still the one in flight.
    expect(storage.getItem('escape-from-pallet-town.save.v1')).toBe(before);
    expect(saves.load()?.raidInFlight?.id).toBe(live);
    expect(saves.ownsRaid(live)).toBe(true);
  });

  it('stops vouching for its raid once the save holds another', () => {
    const pulses = new MemoryStorage();
    let ours = true;
    const heartbeat = new RaidHeartbeat(() => pulses, () => 1_000);
    vi.useFakeTimers();
    try {
      heartbeat.start('frozen', () => ours);
      expect(pulses.getItem(RAID_PULSE_KEY)).not.toBeNull();
      // The other tab settles it and deploys its own, with its own pulse.
      ours = false;
      pulses.setItem(RAID_PULSE_KEY, JSON.stringify({ raidId: 'live', tab: 'other', at: 1_000 }));
      vi.advanceTimersByTime(5_000);
      // The frozen tab's next beat writes nothing over the live raid's pulse.
      expect((JSON.parse(pulses.getItem(RAID_PULSE_KEY)!) as { raidId: string }).raidId).toBe('live');
      vi.advanceTimersByTime(60_000);
      expect((JSON.parse(pulses.getItem(RAID_PULSE_KEY)!) as { raidId: string }).raidId).toBe('live');
    } finally {
      heartbeat.stop();
      vi.useRealTimers();
    }
  });
});
