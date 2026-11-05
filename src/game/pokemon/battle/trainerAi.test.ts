import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../../run/rng';
import { createRunTrainerEncounters } from '../../world/trainers';
import { MISTY_BOSS_ID } from '../../world/valeQuarters';
import { Move } from '../Move';
import { MOVE_CATALOGUE } from '../moveCatalogue';
import { Pokemon } from '../Pokemon';
import { getSpeciesById } from '../species';
import { PrimaryStatus } from './status';
import { WeatherId } from './weather';
import {
  createTrainerBattleState,
  resolveTurn,
  slotRef,
  unitAt,
  type BattleState,
  type TrainerBattle,
} from './battleEngine';
import { chooseTrainerMove, isUselessMove } from './trainerAi';

/** A Pokemon knowing exactly these moves. */
const mon = (speciesId: string, level: number, moves: readonly string[]): Pokemon => {
  const pokemon = new Pokemon(getSpeciesById(speciesId)!, level);
  pokemon.moves = moves.map((name) => new Move(Object.values(MOVE_CATALOGUE).find((move) => move.name === name)!));
  return pokemon;
};

const trainer = (party: readonly Pokemon[], ai: TrainerBattle['ai'] | null = 'gym', unitCount = 1): TrainerBattle => ({
  id: 'test-trainer',
  name: 'TEST',
  party,
  unitCount,
  ...(ai ? { ai } : {}),
});

/** The move the trainer's lead picks, over many seeds. */
const picks = (state: BattleState, seeds = 60): readonly string[] =>
  Array.from({ length: seeds }, (_, seed) => {
    const rng = createSeededRng(seed + 1);
    const choice = chooseTrainerMove(state, slotRef('enemy', 0), () => rng.next())!;
    return unitAt(state, slotRef('enemy', 0))!.moves[choice.moveIndex].base.name;
  });

describe("a gym trainer's AI (FireRed's own, ported)", () => {
  it('never throws Water at a Water Absorb', () => {
    const state = createTrainerBattleState(
      mon('poliwag', 15, ['Bubble']),
      trainer([mon('staryu', 15, ['Water Gun', 'Tackle'])]),
    );
    expect(new Set(picks(state))).toEqual(new Set(['Tackle']));
  });

  it('never paralyses a Ground type, or a foe already carrying a status', () => {
    const ground = createTrainerBattleState(
      mon('geodude', 15, ['Tackle']),
      trainer([mon('pikachu', 15, ['Thunder Wave', 'Quick Attack'])]),
    );
    expect(picks(ground)).not.toContain('Thunder Wave');
    const asleep = createTrainerBattleState(
      mon('bulbasaur', 15, ['Tackle']),
      trainer([mon('pikachu', 15, ['Thunder Wave', 'Quick Attack'])]),
    );
    const sleeping: BattleState = { ...asleep, player: { ...asleep.player, primaryStatus: PrimaryStatus.Sleep } };
    expect(isUselessMove(sleeping, slotRef('enemy', 0), MOVE_CATALOGUE['thunder-wave'], slotRef('player', 0))).toBe(true);
    expect(picks(sleeping)).not.toContain('Thunder Wave');
  });

  it('takes the knockout when it is there, and the strongest hit when it is not', () => {
    const fresh = createTrainerBattleState(
      mon('pidgey', 15, ['Tackle']),
      trainer([mon('pikachu', 15, ['Thunder Shock', 'Quick Attack'])]),
    );
    expect(new Set(picks(fresh))).toEqual(new Set(['Thunder Shock']));
    // On its last legs a Quick Attack knocks it out first, which FireRed's
    // `AI_TryToFaint` scores above a slower knockout.
    const hurt: BattleState = { ...fresh, player: { ...fresh.player, currentHp: 1 } };
    expect(new Set(picks(hurt))).toEqual(new Set(['Quick Attack']));
  });

  it("sets Misty's rain on the battle's first turn, and never again in the rain", () => {
    const misty = createRunTrainerEncounters().find((one) => one.bossId === MISTY_BOSS_ID)!.trainer;
    const state = createTrainerBattleState(
      new Pokemon(getSpeciesById('charmander')!, 15),
      misty,
      null,
      new Pokemon(getSpeciesById('pidgey')!, 15),
    );
    expect(state.unitCount).toBe(2);
    expect(new Set(picks(state))).toEqual(new Set(['Rain Dance']));
    const raining: BattleState = { ...state, weather: { id: WeatherId.Rain, turnsRemaining: 4 }, turnsPlayed: 1 };
    expect(picks(raining)).not.toContain('Rain Dance');
    // And the turn really plays it: rain over the field after turn one.
    const rng = createSeededRng(7);
    const after = resolveTurn(state, [{ slot: 0, moveIndex: 0 }, { slot: 1, moveIndex: 0 }], () => rng.next()).state;
    expect(after.weather?.id).toBe(WeatherId.Rain);
    expect(after.turnsPlayed).toBe(1);
  });

  it('leaves every trainer not marked for it choosing at random, as before', () => {
    const state = createTrainerBattleState(
      mon('poliwag', 15, ['Bubble']),
      trainer([mon('staryu', 15, ['Water Gun', 'Tackle'])], null),
    );
    // What the enemy spent PP on is what it chose, whatever the move then did.
    const used = new Set<string>();
    for (let seed = 1; seed <= 40; seed += 1) {
      const rng = createSeededRng(seed);
      const enemy = resolveTurn(state, 0, () => rng.next()).state.enemy;
      for (const move of enemy.moves) {
        if (move.pp < move.base.pp) {
          used.add(move.base.name);
        }
      }
    }
    expect(used).toEqual(new Set(['Water Gun', 'Tackle']));
  });
});
