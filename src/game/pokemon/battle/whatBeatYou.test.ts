import { describe, expect, it } from 'vitest';
import { practiceTrainer } from '../../base/gymPractice';
import { MISTY_BOSS_ID } from '../../world/valeQuarters';
import { getSpeciesById } from '../species';
import { Pokemon } from '../Pokemon';
import { createTrainerBattleState, resolveTurn, type BattleEvent } from './battleEngine';
import { createSeededRng } from '../../run/rng';
import { whatBeatYou } from './whatBeatYou';

const foeMoves = (name: string, move: string): BattleEvent => ({ type: 'used-move', user: 'enemy', name, move });
const mine = (name: string, move: string): BattleEvent => ({ type: 'used-move', user: 'player', name, move });

describe('what beat you', () => {
  it('names a swimmer racing in the weather, and how often', () => {
    const turns: BattleEvent[][] = [
      [{ type: 'ability', user: 'enemy', slot: 1, name: 'Horsea', ability: 'SWIFT SWIM', effect: 'quickened' }],
      [foeMoves('Staryu', 'Rain Dance'), { type: 'weather-set', weather: 'rain', byMove: true }, mine('Charmander', 'Ember')],
      ...Array.from({ length: 4 }, () => [foeMoves('Horsea', 'Bubble'), mine('Charmander', 'Ember')]),
    ];
    expect(whatBeatYou(turns)).toBe('Rain and Swift Swim: HORSEA moved first 4 times.');
  });

  it('counts the weather the fight began in, and stops when it ends', () => {
    const quick: BattleEvent = { type: 'ability', user: 'enemy', name: 'Goldeen', ability: 'SWIFT SWIM', effect: 'quickened' };
    const turns: BattleEvent[][] = [
      [quick],
      [foeMoves('Goldeen', 'Peck'), mine('Pidgey', 'Gust')],
      [foeMoves('Goldeen', 'Peck'), mine('Pidgey', 'Gust'), { type: 'weather-ended', weather: 'rain' }],
      [foeMoves('Goldeen', 'Peck'), mine('Pidgey', 'Gust')],
    ];
    expect(whatBeatYou(turns, 'rain')).toBe('Rain and Swift Swim: GOLDEEN moved first twice.');
  });

  it('names turns lost to sleep and paralysis', () => {
    const turns: BattleEvent[][] = [
      [foeMoves('Poliwag', 'Hypnosis'), { type: 'status-applied', user: 'player', name: 'Pikachu', status: 'sleep' }],
      [{ type: 'status-prevented', user: 'player', name: 'Pikachu', status: 'sleep' }, foeMoves('Poliwag', 'Bubble')],
      [{ type: 'status-prevented', user: 'player', name: 'Pikachu', status: 'sleep' }, foeMoves('Poliwag', 'Bubble')],
      [{ type: 'status-prevented', user: 'player', name: 'Pikachu', status: 'paralysis' }, foeMoves('Poliwag', 'Bubble')],
    ];
    expect(whatBeatYou(turns)).toBe('Asleep and paralysed: your Pokémon lost 3 turns.');
  });

  it('names a Smokescreen and the misses after it', () => {
    const turns: BattleEvent[][] = [
      [foeMoves('Horsea', 'Smokescreen'), { type: 'stat-stage-changed', user: 'player', name: 'Pikachu', stat: 'accuracy', stages: -1 }],
      [mine('Pikachu', 'Thunder Shock'), { type: 'missed', user: 'player', name: 'Pikachu' }, foeMoves('Horsea', 'Bubble')],
      [mine('Pikachu', 'Thunder Shock'), { type: 'missed', user: 'player', name: 'Pikachu' }, foeMoves('Horsea', 'Bubble')],
    ];
    expect(whatBeatYou(turns)).toBe('Smokescreen: your attacks missed twice.');
  });

  it('names hits that landed for double', () => {
    const turns: BattleEvent[][] = Array.from({ length: 3 }, () => [
      mine('Geodude', 'Tackle'),
      foeMoves('Staryu', 'Water Gun'),
      { type: 'effectiveness', multiplier: 4 },
    ]);
    expect(whatBeatYou(turns)).toBe('Super effective: WATER GUN hit you 3 times.');
  });

  it('says nothing when nothing stood out, and never counts what the player did', () => {
    expect(whatBeatYou([])).toBeNull();
    const even: BattleEvent[][] = [
      [mine('Pikachu', 'Thunder Shock'), { type: 'effectiveness', multiplier: 2 }, foeMoves('Rattata', 'Tackle')],
      [foeMoves('Rattata', 'Tackle'), mine('Pikachu', 'Thunder Shock'), { type: 'effectiveness', multiplier: 2 }],
    ];
    expect(whatBeatYou(even)).toBeNull();
  });

  it('names the one foe that kept moving first, and only says "most" of several', () => {
    const lone: BattleEvent[][] = Array.from({ length: 4 }, () => [foeMoves('Staryu', 'Tackle'), mine('Charmander', 'Scratch')]);
    expect(whatBeatYou(lone)).toBe('Speed: STARYU moved first 4 times.');
    const pair: BattleEvent[][] = [
      ...Array.from({ length: 3 }, () => [foeMoves('Staryu', 'Tackle'), mine('Charmander', 'Scratch')]),
      [foeMoves('Horsea', 'Bubble'), mine('Charmander', 'Scratch')],
    ];
    expect(whatBeatYou(pair)).toBe('Speed: they moved first 4 times, STARYU most.');
  });

  it('names the player\'s hits that were resisted, ahead of who moved first', () => {
    // A lone Charmander into a Water gym: every Ember resisted, and the foe
    // faster too. The matchup is the lesson, not the speed.
    const turns: BattleEvent[][] = Array.from({ length: 4 }, () => [
      foeMoves('Staryu', 'Tackle'),
      mine('Charmander', 'Ember'),
      { type: 'effectiveness', multiplier: 0.5 },
    ]);
    expect(whatBeatYou(turns)).toBe('Not very effective: your EMBER was resisted 4 times.');
  });

  it("is what Misty's real team does to a Fire team that walks into her gym", () => {
    const charmander = new Pokemon(getSpeciesById('charmander')!, 13);
    const sandshrew = new Pokemon(getSpeciesById('sandshrew')!, 13);
    let state = createTrainerBattleState(charmander, practiceTrainer(MISTY_BOSS_ID)!, null, sandshrew);
    state = { ...state, playerParty: [charmander, sandshrew] };
    const rng = createSeededRng(7);
    const turns: BattleEvent[][] = [];
    for (let turn = 0; turn < 30 && state.outcome === 'active'; turn += 1) {
      const result = resolveTurn(state, [{ slot: 0, moveIndex: 0 }, { slot: 1, moveIndex: 0 }], () => rng.next());
      turns.push([...result.events]);
      state = result.state;
    }
    expect(state.outcome).toBe('defeat');
    expect(whatBeatYou(turns)).toMatch(/^(Rain and Swift Swim: HORSEA moved first \d+ times|Super effective: BUBBLE hit you \d+ times)\.$/);
  });
});
