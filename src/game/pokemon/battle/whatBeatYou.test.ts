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

  it('never blames Speed for turns the player spent on something other than a move', () => {
    // Veteran playtest of 22 Nov 2026: 'Speed: RATTATA moved first 3 times'
    // when it had once - the turns spent on Potions were the foe's alone.
    const potion: BattleEvent = { type: 'item-used', user: 'player', name: 'Squirtle', item: 'Potion' } as unknown as BattleEvent;
    const turns: BattleEvent[][] = [
      [foeMoves('Rattata', 'Tail Whip'), mine('Squirtle', 'Tackle')],
      [potion, foeMoves('Rattata', 'Tackle')],
      [potion, foeMoves('Rattata', 'Tackle')],
      [mine('Squirtle', 'Tackle'), foeMoves('Rattata', 'Tackle')],
    ];
    expect(whatBeatYou(turns)).toBeNull();
  });

  it('names poison wearing yours down, and its cure, rather than who moved first', () => {
    // 'Speed: WEEDLE moved first 4 times' over a Charmander poisoned at 13/22
    // told the friend nothing to do (AI playtest, 23 Nov 2026).
    const tick: BattleEvent = { type: 'status-damage', user: 'player', name: 'Charmander', status: 'poison', damage: 2 };
    const turns: BattleEvent[][] = [
      [foeMoves('Weedle', 'Poison Sting'), mine('Charmander', 'Scratch')],
      [foeMoves('Weedle', 'Poison Sting'), mine('Charmander', 'Scratch'), tick],
      [foeMoves('Weedle', 'Poison Sting'), mine('Charmander', 'Scratch'), tick],
      [foeMoves('Weedle', 'Poison Sting'), mine('Charmander', 'Scratch'), tick],
    ];
    expect(whatBeatYou(turns)).toBe('Poison: it took 6 HP off yours over 3 turns. An Antidote or a Pecha Berry cures it.');
  });

  it('counts only what a status took off your side, and once is not a reason', () => {
    const foeTick: BattleEvent = { type: 'status-damage', user: 'enemy', name: 'Weedle', status: 'burn', damage: 3 };
    const mineTick: BattleEvent = { type: 'status-damage', user: 'player', name: 'Pidgey', status: 'burn', damage: 3 };
    expect(whatBeatYou([[foeTick], [foeTick], [foeTick]])).toBeNull();
    expect(whatBeatYou([[mineTick]])).toBeNull();
    expect(whatBeatYou([[mineTick], [mineTick]])).toBe('Burn: it took 6 HP off yours over 2 turns. A Rawst Berry cures it.');
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

  it('names a foe that healed itself over and over', () => {
    // Starmie's Recover undid the fight while the line blamed a Smokescreen
    // missing once or twice (AI playtest, 22 Nov 2026).
    const recover = (): BattleEvent[] => [
      mine('Bulbasaur', 'Vine Whip'),
      foeMoves('Starmie', 'Recover'),
      { type: 'healed', user: 'enemy', name: 'Starmie', amount: 19 },
    ];
    expect(whatBeatYou([recover(), recover(), recover()])).toBe('Recover: STARMIE healed itself 3 times.');
  });

  it('says the other side simply hit much harder, rather than who moved first', () => {
    // 'Speed: STARYU moved first 8 times' on a fight lost to a four-level gap
    // sent newcomers looking for speed (AI playtest, 22 Nov 2026).
    const hit = (user: 'player' | 'enemy', name: string, damage: number): BattleEvent => ({ type: 'used-move', user, name, move: 'Tackle', damage });
    const turns: BattleEvent[][] = Array.from({ length: 4 }, () => [hit('enemy', 'Staryu', 9), hit('player', 'Squirtle', 2)]);
    expect(whatBeatYou(turns)).toBe('Damage: STARYU hit for about 9 a turn, you for about 2.');
    // An even trade is not lopsided, and Speed is still the line for a race.
    const even: BattleEvent[][] = Array.from({ length: 4 }, () => [hit('enemy', 'Staryu', 5), hit('player', 'Squirtle', 4)]);
    expect(whatBeatYou(even)).toBe('Speed: STARYU moved first 4 times.');
  });

  it('says a lopsided trade over a swimmer that raced only twice', () => {
    // 'Rain and Swift Swim: HORSEA moved first twice' over a fight Staryu's
    // Tackles won 8 to 2 (AI playtest, 22 Nov 2026).
    const hit = (user: 'player' | 'enemy', name: string, damage: number): BattleEvent => ({ type: 'used-move', user, name, move: 'Tackle', damage });
    const turns: BattleEvent[][] = [
      [{ type: 'ability', user: 'enemy', name: 'Horsea', ability: 'SWIFT SWIM', effect: 'quickened' }],
      [foeMoves('Staryu', 'Rain Dance'), { type: 'weather-set', weather: 'rain', byMove: true }, hit('player', 'Bulbasaur', 2)],
      [hit('enemy', 'Horsea', 3), hit('player', 'Bulbasaur', 2)],
      [hit('enemy', 'Horsea', 3), hit('player', 'Bulbasaur', 2)],
      ...Array.from({ length: 4 }, () => [hit('player', 'Bulbasaur', 2), hit('enemy', 'Staryu', 8)]),
    ];
    expect(whatBeatYou(turns)).toMatch(/^Damage: they hit for about \d+ a turn, you for about 2\.$/);
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

  it('names the hit that knocked you out when another foe did the moving first', () => {
    // 'Speed: STARYU moved first 6 times' over a fight whose Staryu the player
    // had beaten, lost to a Horsea's super-effective Bubble (the overnight
    // retest, 23 Nov 2026).
    const turns: BattleEvent[][] = [
      ...Array.from({ length: 5 }, () => [foeMoves('Staryu', 'Tackle'), mine('Charmander', 'Scratch')]),
      [{ type: 'fainted', user: 'enemy', name: 'Staryu' }],
      [
        { type: 'used-move', user: 'enemy', name: 'Horsea', move: 'Bubble', damage: 15 },
        { type: 'effectiveness', multiplier: 2 },
        { type: 'fainted', user: 'player', name: 'Charmander' },
      ],
    ];
    expect(whatBeatYou(turns)).toBe("Knocked out by HORSEA's BUBBLE, super effective.");
    // The one who kept moving first and finished it is still the Speed line.
    const same: BattleEvent[][] = [
      ...Array.from({ length: 4 }, () => [foeMoves('Staryu', 'Tackle'), mine('Charmander', 'Scratch')]),
      [{ type: 'used-move', user: 'enemy', name: 'Staryu', move: 'Tackle', damage: 5 }, { type: 'fainted', user: 'player', name: 'Charmander' }],
    ];
    expect(whatBeatYou(same)).toMatch(/^Speed: STARYU moved first/);
  });

  it('does not blame a swimmer racing in the rain for a fight another foe finished', () => {
    // 'Rain and Swift Swim: HORSEA moved first twice' over a fight whose Horsea
    // fell first, lost to Starmie's Swift (the overnight retest, 23 Nov 2026).
    const turns: BattleEvent[][] = [
      [{ type: 'ability', user: 'enemy', slot: 1, name: 'Horsea', ability: 'SWIFT SWIM', effect: 'quickened' }],
      [foeMoves('Staryu', 'Rain Dance'), { type: 'weather-set', weather: 'rain', byMove: true }, mine('Squirtle', 'Tackle')],
      [foeMoves('Horsea', 'Bubble'), mine('Squirtle', 'Tackle')],
      [foeMoves('Horsea', 'Bubble'), mine('Squirtle', 'Tackle'), { type: 'fainted', user: 'enemy', name: 'Horsea' }],
      [
        { type: 'used-move', user: 'enemy', name: 'Starmie', move: 'Swift', damage: 9 },
        { type: 'fainted', user: 'player', name: 'Squirtle' },
      ],
    ];
    expect(whatBeatYou(turns)).toBe("Knocked out by STARMIE's SWIFT.");
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
