import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MoveCategory, MoveTarget } from './MoveBase';
import { GENERATED_MOVES } from './generated/moveCatalogue';
import { statEffectOf } from '../../../tools/moves/fireRedRules.mjs';

/**
 * Every generated move against FireRed's own move table
 * (`tools/moves/frlg-battle-moves.json`, read out of pret/pokefirered's
 * `battle_moves.h` by `tools/moves/frlgBattleMoves.mjs`).
 *
 * PokeAPI keeps no history for a move's priority, its target, its stat changes
 * or its flinch, so the catalogue carried later generations' values for about a
 * dozen of them (playtest 22, W2): String Shot at -2 Speed, Growth raising
 * Attack, Acid and Crunch lowering the wrong Defence, Waterfall flinching,
 * Extreme Speed and Fake Out at the wrong priority, Poison Gas hitting both
 * foes. The generator now corrects every row from FireRed's table; this holds
 * the result to it, move by move, so a re-harvest cannot slip one back.
 */
interface FireRedMove {
  readonly name: string;
  readonly effect: string;
  readonly secondaryEffectChance: number;
  readonly target: string;
  readonly priority: number;
}

const FIRERED_TABLE = JSON.parse(readFileSync('tools/moves/frlg-battle-moves.json', 'utf8')) as {
  readonly moves: readonly FireRedMove[];
};
const FIRERED = new Map<string, FireRedMove>(FIRERED_TABLE.moves.map((row) => [row.name, row]));

const STAT_NAMES: Readonly<Record<string, string>> = {
  attack: 'attack',
  defense: 'defense',
  speed: 'speed',
  'special-attack': 'spAttack',
  'special-defense': 'spDefense',
  accuracy: 'accuracy',
  evasion: 'evasion',
};

const moves = Object.entries(GENERATED_MOVES);

describe("the generated moves against FireRed's own table", () => {
  it('has a FireRed row for every move', () => {
    expect(moves.filter(([id]) => !FIRERED.has(id)).map(([id]) => id)).toEqual([]);
  });

  it.each(moves)('%s strikes at FireRed priority and lands on as many foes', (id, move) => {
    const row = FIRERED.get(id)!;
    expect(move.priority).toBe(row.priority);
    expect(move.target === MoveTarget.BothFoes).toBe(row.target === 'MOVE_TARGET_BOTH');
  });

  it.each(moves)("%s changes FireRed's stats, on FireRed's side", (id, move) => {
    const row = FIRERED.get(id)!;
    const expected = statEffectOf(row.effect);
    if (expected === null) {
      return;
    }
    const changes = [...move.effects.boosts, ...move.secondaries.flatMap((secondary) => secondary.boosts)];
    expect(changes.map((boost) => `${boost.stat} ${boost.stages}`)).toEqual(
      expected.changes.map((change: { stat: string; change: number }) => `${STAT_NAMES[change.stat]} ${change.change}`),
    );
    if (changes.length > 0 && move.category !== MoveCategory.Status) {
      const secondary = move.secondaries.find((each) => each.boosts.length > 0)!;
      expect(secondary.target === MoveTarget.Self).toBe(expected.self);
      // A certain change (Superpower's) has no chance field in FireRed's table.
      expect(secondary.chance).toBe(row.secondaryEffectChance || 100);
    }
  });

  it.each(moves.filter(([, move]) => move.category !== MoveCategory.Status))(
    '%s flinches only where FireRed says it does',
    (id, move) => {
      const row = FIRERED.get(id)!;
      const flinch = move.secondaries.find((secondary) => secondary.flinch);
      const flinches = ['EFFECT_FLINCH_HIT', 'EFFECT_FLINCH_MINIMIZE_HIT', 'EFFECT_TWISTER', 'EFFECT_SNORE', 'EFFECT_FAKE_OUT', 'EFFECT_SKY_ATTACK'].includes(row.effect);
      expect(flinch !== undefined).toBe(flinches);
    },
  );
});
