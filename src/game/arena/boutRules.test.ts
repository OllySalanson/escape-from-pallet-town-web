import { describe, expect, it } from 'vitest';
import { Pokemon } from '../pokemon';
import { SPECIES_BY_ID } from '../pokemon/species';
import { DOJO_LEVEL, dojoBag, dojoParty, dojoRefusal, flatLevelCopy, isDojoTeam } from './boutRules';
import { afterDojoBout, readDojoRecord } from './dojoRecord';
import {
  DOJO_COUNTER_TILES,
  DOJO_FIGHTER_SPOTS,
  DOJO_REGULARS,
  DOJO_ROOM,
  dojoOpponentParty,
  dojoRegularsToday,
  dojoTrainer,
} from './dojoCounter';
import { openingTeam } from './dojoCounterView';

const make = (id: string, level: number): Pokemon => new Pokemon(SPECIES_BY_ID[id], level);

describe('a bout in THE BATTLE ARENA', () => {
  it('fights a flat-level copy that keeps its own moves, item, name and colours and never touches the original', () => {
    const veteran = make('charizard', 70);
    veteran.giveHeldItem('charcoal');
    veteran.nickname = 'BLAZE';
    veteran.shiny = true;
    veteran.takeDamage(50);
    const moves = veteran.moves.map((move) => move.base.name);
    const copy = flatLevelCopy(veteran);
    expect(copy).not.toBe(veteran);
    expect(copy.level).toBe(DOJO_LEVEL);
    expect(copy.currentHp).toBe(copy.maxHp);
    expect(copy.moves.map((move) => move.base.name)).toEqual(moves);
    expect(copy.heldItemId).toBe(veteran.heldItemId);
    expect(copy.name).toBe('BLAZE');
    expect(copy.shiny).toBe(true);
    copy.takeDamage(999);
    copy.moves[0].setPp(0);
    expect(veteran.level).toBe(70);
    expect(veteran.isFainted).toBe(false);
    expect(veteran.moves[0].pp).toBeGreaterThan(0);
  });

  it('puts a Lv 70 and a Lv 12 of the same kind on equal terms', () => {
    expect(flatLevelCopy(make('charmander', 70)).stats).toEqual(flatLevelCopy(make('charmander', 12)).stats);
  });

  it('keeps the Battle Tower clauses: one of each kind, no shared item, no Mew or Mewtwo, three at most', () => {
    const pidgey = make('pidgey', 10);
    expect(dojoRefusal(make('pidgey', 20), [pidgey])).toMatch(/one of each kind/i);
    expect(dojoRefusal(make('mewtwo', 70), [])).toMatch(/stays home/);
    expect(dojoRefusal(make('mew', 30), [])).toMatch(/stays home/);
    const a = make('rattata', 5);
    const b = make('spearow', 5);
    a.giveHeldItem('charcoal');
    b.giveHeldItem('charcoal');
    expect(dojoRefusal(b, [a])).toMatch(/same item/);
    const three = [make('rattata', 5), make('spearow', 5), make('pidgey', 5)];
    expect(dojoRefusal(make('oddish', 5), three)).toMatch(/three/i);
    expect(isDojoTeam(three)).toBe(true);
    expect(isDojoTeam([])).toBe(false);
  });

  it('takes no bag onto the mat', () => {
    expect(dojoBag().toJSON()).toEqual({});
    expect(dojoParty([make('pikachu', 40)])[0].level).toBe(DOJO_LEVEL);
  });
});

describe('the dojo record', () => {
  it('counts wins and losses and remembers who has been beaten', () => {
    let record = afterDojoBout(undefined, 'bot:karpking', true);
    record = afterDojoBout(record, 'bot:karpking', true);
    record = afterDojoBout(record, 'bot:xkitx', false);
    expect(record).toEqual({ wins: 2, losses: 1, beaten: ['bot:karpking'] });
  });

  it('reads back only what a record can hold', () => {
    expect(readDojoRecord({ wins: 3, losses: -1, beaten: ['bot:xkitx', 'bot:xkitx', '<x>', 7] })).toEqual({
      wins: 3,
      losses: 0,
      beaten: ['bot:xkitx'],
    });
    expect(readDojoRecord('nonsense')).toBeUndefined();
  });
});

describe("the dojo's regulars", () => {
  it('are all twelve of the harbour regulars, each with three kinds that can hit something at Lv 30', () => {
    expect(DOJO_REGULARS).toHaveLength(12);
    for (const regular of DOJO_REGULARS) {
      expect(regular.team[0]).toBe(regular.bot.partner);
      const party = dojoOpponentParty(regular);
      expect(party).toHaveLength(3);
      expect(new Set(party.map((pokemon) => pokemon.base.id)).size).toBe(3);
      for (const pokemon of party) {
        expect(pokemon.level).toBe(DOJO_LEVEL);
        expect(pokemon.moves.some((move) => move.base.power > 0), `${regular.bot.name}'s ${pokemon.base.name}`).toBe(true);
      }
    }
  });

  it('fight on the gym AI and field as many as the player brings', () => {
    const trainer = dojoTrainer(DOJO_REGULARS[0], 2);
    expect(trainer.ai).toBe('gym');
    expect(trainer.party).toHaveLength(2);
  });

  it('are the same six on the same day, a spot each, and change with the day', () => {
    const day = new Date(2026, 10, 7, 9);
    const today = dojoRegularsToday(day);
    expect(today).toHaveLength(DOJO_FIGHTER_SPOTS.length);
    expect(new Set(today.map((regular) => regular.bot.id)).size).toBe(today.length);
    expect(dojoRegularsToday(new Date(2026, 10, 7, 23)).map((r) => r.bot.id)).toEqual(today.map((r) => r.bot.id));
    expect(dojoRegularsToday(new Date(2026, 10, 8)).map((r) => r.bot.id)).not.toEqual(today.map((r) => r.bot.id));
  });

  it('stand clear of the counter and the mat', () => {
    const taken = new Set([...DOJO_COUNTER_TILES, DOJO_ROOM.mat].map((tile) => `${tile.x},${tile.y}`));
    for (const spot of DOJO_FIGHTER_SPOTS) {
      expect(taken.has(`${spot.tile.x},${spot.tile.y}`)).toBe(false);
    }
  });
});

describe('the counter', () => {
  it('opens on the team last brought, keeping only what the clauses allow', () => {
    const entry = (id: string, species: string) => ({ id, pokemon: make(species, 10), box: 'Box 1', kept: 0 });
    const entries = [entry('a', 'pidgey'), entry('b', 'pidgey'), entry('c', 'rattata'), entry('d', 'mew'), entry('e', 'oddish'), entry('f', 'abra')];
    expect(openingTeam(entries, ['a', 'b', 'd', 'c', 'e', 'f'])).toEqual(['a', 'c', 'e']);
  });
});
