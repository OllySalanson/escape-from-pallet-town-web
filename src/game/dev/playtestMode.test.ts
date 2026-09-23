import { afterEach, describe, expect, it } from 'vitest';
import { Pokemon } from '../pokemon';
import { CHARIZARD, PIDGEY } from '../pokemon/species';
import { createBattleState, resolveEnemyTurn } from '../pokemon/battle/battleEngine';
import { SaveManager, type StorageLike } from '../save/SaveManager';
import { Bag } from '../items';
import { PokemonParty } from '../pokemon';
import { createStartingStash } from '../stash';
import { RUN_INSERTIONS } from '../run/runGeneration';
import { gateKey, WORLD_GATES } from '../world/gates';
import { raidClockView } from '../scenes/raidHud';
import {
  isPlaytestRun,
  PLAYTEST_CLOCK_LABEL,
  PLAYTEST_RAID_DURATION_MS,
  PLAYTEST_SAVE_KEY,
  setActiveSaveSlot,
} from './playtestMode';
import { createPlaytestGame, playtestRaidProgress } from './playtestSave';
import { SAVE_KEY } from '../save/SaveManager';
import { RAID_DURATION_MS } from '../run/raidClock';
import { traderStanding } from '../hub/trader';

class MemoryStorage implements StorageLike {
  public readonly entries = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }

  public removeItem(key: string): void {
    this.entries.delete(key);
  }
}

const ordinaryGame = () => ({
  party: new PokemonParty([]),
  mapId: 'pallet-town' as const,
  position: { x: 6, y: 8 },
  bag: new Bag(),
  stash: createStartingStash(),
});

afterEach(() => {
  setActiveSaveSlot('normal');
});

describe('the explorer run', () => {
  it('is off unless something asks for it', () => {
    expect(isPlaytestRun()).toBe(false);
  });

  it('is kept in its own file, and never reads or writes the ordinary one', () => {
    const storage = new MemoryStorage();
    new SaveManager(storage).save(ordinaryGame());
    const ordinary = storage.getItem(SAVE_KEY);
    expect(ordinary).not.toBeNull();

    setActiveSaveSlot('playtest');
    const manager = new SaveManager(storage);
    manager.save(createPlaytestGame());

    // Two files, and the ordinary one byte for byte what it was.
    expect(storage.getItem(PLAYTEST_SAVE_KEY)).not.toBeNull();
    expect(storage.getItem(SAVE_KEY)).toBe(ordinary);
    expect(manager.load()?.stash.listPokemon()[0].pokemon.level).toBe(99);

    // And erasing the explorer run leaves the ordinary game standing.
    manager.clear();
    expect(storage.getItem(PLAYTEST_SAVE_KEY)).toBeNull();
    expect(storage.getItem(SAVE_KEY)).toBe(ordinary);
    setActiveSaveSlot('normal');
    expect(new SaveManager(storage).load()).not.toBeNull();
  });

  it('describes the other game without switching into it', () => {
    const storage = new MemoryStorage();
    new SaveManager(storage).save(ordinaryGame());
    new SaveManager(storage, 'playtest').save(createPlaytestGame());

    expect(new SaveManager(storage, 'playtest').describe()).toMatchObject({ kind: 'game' });
    // Naming a slot must not move the live one.
    expect(isPlaytestRun()).toBe(false);
  });

  it('cannot knock the player out, and leaves the other side alone', () => {
    const player = new Pokemon(CHARIZARD, 5);
    player.currentHp = 3;
    const state = createBattleState(player, new Pokemon(PIDGEY, 40));

    const hurt = resolveEnemyTurn(state, () => 0);
    expect(hurt.state.player.currentHp).toBe(0);

    setActiveSaveSlot('playtest');
    const spared = resolveEnemyTurn(state, () => 0);
    expect(spared.state.player.currentHp).toBe(1);
    expect(spared.events.some((event) => event.type === 'fainted')).toBe(false);
  });

  it('gives a clock long enough that it never ends a wander', () => {
    expect(PLAYTEST_RAID_DURATION_MS).toBeGreaterThan(RAID_DURATION_MS * 50);
    expect(raidClockView(1_000, false, 0, true)).toEqual({
      label: PLAYTEST_CLOCK_LABEL,
      tone: 'calm',
      pulses: false,
    });
    // And the ordinary raid's clock is the clock it always was.
    expect(raidClockView(1_000, false, 0).label).toMatch(/RAID/);
  });
});

describe('the explorer run it deals', () => {
  const progress = playtestRaidProgress();

  it('opens every door and leaves every keeper standing', () => {
    for (const gate of WORLD_GATES) {
      expect(progress.openedGates).toContain(gateKey(gate));
    }
    // A beaten boss is taken off the map, and the point is to be able to fight them.
    expect(progress.defeatedBosses).toEqual([]);
  });

  it('offers every way into every map', () => {
    expect([...progress.unlockedInsertions].sort()).toEqual(Object.keys(RUN_INSERTIONS).sort());
  });

  it('hands over a level-99 Charizard with a moveset it could have', () => {
    const [partner] = createPlaytestGame().stash!.listPokemon();

    expect(partner.pokemon.base.name).toBe('Charizard');
    expect(partner.pokemon.level).toBe(99);
    expect(partner.pokemon.moves).toHaveLength(4);
    for (const move of partner.pokemon.moves) {
      expect(CHARIZARD.learnset.some((entry) => entry.move.name === move.base.name)).toBe(true);
    }
    // Something to actually fight with, not four status moves.
    expect(partner.pokemon.moves.some((move) => move.base.power > 0)).toBe(true);
  });

  it('arrives as Bill\'s partner, so his whole boat can be looked at', () => {
    expect(
      traderStanding({
        ...progress,
        traderMoneySpent: progress.traderMoneySpent ?? 0,
        traderBarters: progress.traderBarters ?? [],
      }).id,
    ).toBe('partner');
  });

  it('lights every map, so the drop-in screen shows the country', () => {
    expect(Object.keys(progress.surveyed ?? {}).length).toBeGreaterThan(0);
  });
});
