import { afterEach, describe, expect, it } from 'vitest';
import { windowLight } from '../base/homeClock';
import { payJump } from '../minigames/tickets';
import { Pokemon } from '../pokemon';
import { CHARIZARD } from '../pokemon/species';
import { createStartingStash } from '../stash';
import { setActiveSaveSlot } from './playtestMode';
import { setPlaytestHour } from './playtestClock';
import {
  addPlaytestKit,
  PLAYTEST_GAMES,
  PLAYTEST_KIT_BOXES,
  PLAYTEST_TICKETS,
  withNewDay,
  withPlaytestTickets,
} from './playtestKit';
import { createPlaytestGame, withPlaytestCurrent } from './playtestSave';
import { getSpeciesById } from '../pokemon/species';
import { DEFAULT_RAID_PROGRESS } from '../save/SaveManager';

afterEach(() => {
  setActiveSaveSlot('normal');
  setPlaytestHour(null);
});

const NOON = new Date(2026, 10, 7, 12, 0);
const vaultKinds = (): readonly string[] =>
  createPlaytestGame().stash!.listPokemon().map((stored) => stored.pokemon.base.id);

describe('the playtest kit', () => {
  it('names only the 151, and each kind once', () => {
    const named = PLAYTEST_KIT_BOXES.flatMap((row) => row.species);
    for (const id of named) {
      expect(getSpeciesById(id), id).toBeDefined();
    }
    expect(new Set(named).size).toBe(named.length);
  });

  it('gives every harbour game a Pokémon that suits it and one that does not', () => {
    // A game is only tested when it is played both ways: POKéMON JUMP with a
    // Rattata, and with the Charizard that cannot jump at all.
    const kinds = vaultKinds();
    for (const game of PLAYTEST_GAMES) {
      if (!game.suits) continue;
      expect(kinds.some((kind) => game.suits!(kind)), `${game.name}: nobody suits it`).toBe(true);
      expect(kinds.some((kind) => !game.suits!(kind)), `${game.name}: nobody is unsuited`).toBe(true);
    }
  });

  it('puts each row in a box of its own name', () => {
    const stash = createPlaytestGame().stash!;
    for (const row of PLAYTEST_KIT_BOXES) {
      const index = stash.listBoxes().findIndex((box) => box.name === row.box);
      expect(index, row.box).toBeGreaterThanOrEqual(0);
      const inBox = stash.listBoxPokemon(index).map((stored) => stored.pokemon.base.id);
      expect(inBox).toEqual(expect.arrayContaining([...row.species]));
    }
  });

  it('holds three of each jump type for POKéMON JUMP', () => {
    const jump = PLAYTEST_GAMES.find((game) => game.id === 'pokemon-jump')!;
    expect(vaultKinds().filter((kind) => jump.suits!(kind)).length).toBeGreaterThanOrEqual(9);
  });

  it('only adds, and adds nothing the second time', () => {
    const stash = createStartingStash();
    stash.addPokemon(new Pokemon(CHARIZARD, 50));
    const before = stash.listPokemon().length;
    expect(addPlaytestKit(stash)).toBe(true);
    const after = stash.listPokemon().length;
    expect(after).toBeGreaterThan(before);
    expect(addPlaytestKit(stash)).toBe(false);
    expect(stash.listPokemon().length).toBe(after);
  });

  it('brings a run kept from before the kit up to date, and leaves a current one alone', () => {
    const old = createPlaytestGame();
    const bare = {
      ...old,
      stash: createStartingStash(),
      raidProgress: { ...old.raidProgress!, gameCorner: { tickets: 12, day: null, best: { 'pokemon-jump': 900 } } },
    };
    const restored = { ...bare, items: [], bag: bare.bag!, starterSpeciesId: 'charmander' as const, pendingRecoveryMs: 0, wardTreatmentsUsed: 0, traderRationUsed: 0, traderBerthPaid: false, raidInFlight: null, raidProgress: bare.raidProgress };
    const current = withPlaytestCurrent(restored);
    expect(current).not.toBe(restored);
    expect(current.raidProgress.gameCorner?.tickets).toBe(PLAYTEST_TICKETS);
    // The best ever is the player's own, kept.
    expect(current.raidProgress.gameCorner?.best['pokemon-jump']).toBe(900);
    expect(current.stash.listPokemon().some((stored) => stored.pokemon.base.id === 'rattata')).toBe(true);
    expect(withPlaytestCurrent(current)).toBe(current);
  });

  it('starts a run with tickets enough for the prize window, and never takes any away', () => {
    expect(createPlaytestGame().raidProgress?.gameCorner?.tickets).toBe(PLAYTEST_TICKETS);
    const rich = { ...DEFAULT_RAID_PROGRESS, gameCorner: { tickets: PLAYTEST_TICKETS + 7, day: null, best: {} } };
    expect(withPlaytestTickets(rich)).toBe(rich);
  });
});

describe("the board's NEW DAY", () => {
  it('lets a cabinet that has paid today pay again, keeping the tickets and the best ever', () => {
    const played = payJump({ tickets: 0, day: null, best: {} }, 3000, NOON);
    expect(played.tickets).toBeGreaterThan(0);
    expect(payJump(played.record, 3000, NOON).tickets).toBe(0);

    const progress = withNewDay({ ...DEFAULT_RAID_PROGRESS, gameCorner: played.record });
    expect(progress.gameCorner?.tickets).toBe(played.record.tickets);
    expect(progress.gameCorner?.best).toEqual(played.record.best);
    expect(payJump(progress.gameCorner!, 3000, NOON).tickets).toBe(played.tickets);
  });
});

describe("the board's hour", () => {
  it('sets the light in the explorer run only', () => {
    setPlaytestHour('night');
    // The ordinary game keeps the player's own clock whatever the board said.
    expect(windowLight(NOON)).toBe('day');
    setActiveSaveSlot('playtest');
    expect(windowLight(NOON)).toBe('night');
    setPlaytestHour('dusk');
    expect(windowLight(NOON)).toBe('dusk');
    setPlaytestHour(null);
    expect(windowLight(NOON)).toBe('day');
  });
});
