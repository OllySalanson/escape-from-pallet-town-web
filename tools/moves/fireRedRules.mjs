// What FireRed's own move table corrects in a PokeAPI move row.
//
// PokeAPI keeps no history for a move's priority, target, stat changes or
// flinch, so each of those is read from `frlg-battle-moves.json` (FireRed's
// `battle_moves.h`, see `frlgBattleMoves.mjs`) and written over the row before
// anything classifies or renders it. Power, accuracy, PP and type are already
// generation III's in the snapshot (its harvest reads `past_values`), and every
// field this does not name is left exactly as PokeAPI has it.
//
// The effect id is the rule. FireRed names a stat move's whole behaviour in it -
// `EFFECT_SPEED_DOWN` is one stage off the target's Speed, `EFFECT_ATTACK_UP_HIT`
// a chance to raise the *user's* Attack after a hit - so the stat changes, and
// whose they are, are derived from it rather than copied.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIRERED = new Map(
  JSON.parse(readFileSync(join(HERE, 'frlg-battle-moves.json'), 'utf8')).moves.map((row) => [row.name, row]),
);

const STAT = {
  ATTACK: 'attack',
  DEFENSE: 'defense',
  SPEED: 'speed',
  SPECIAL_ATTACK: 'special-attack',
  SPECIAL_DEFENSE: 'special-defense',
  ACCURACY: 'accuracy',
  EVASION: 'evasion',
};

/** Stat effects that are not one stat up or down: the stages each changes. */
const COMPOUND = {
  EFFECT_ALL_STATS_UP_HIT: { self: true, changes: [['ATTACK', 1], ['DEFENSE', 1], ['SPECIAL_ATTACK', 1], ['SPECIAL_DEFENSE', 1], ['SPEED', 1]] },
  EFFECT_SUPERPOWER: { self: true, changes: [['ATTACK', -1], ['DEFENSE', -1]] },
  EFFECT_MINIMIZE: { self: true, changes: [['EVASION', 1]] },
  EFFECT_DEFENSE_CURL: { self: true, changes: [['DEFENSE', 1]] },
  EFFECT_BULK_UP: { self: true, changes: [['ATTACK', 1], ['DEFENSE', 1]] },
  EFFECT_CALM_MIND: { self: true, changes: [['SPECIAL_ATTACK', 1], ['SPECIAL_DEFENSE', 1]] },
  EFFECT_DRAGON_DANCE: { self: true, changes: [['ATTACK', 1], ['SPEED', 1]] },
  EFFECT_COSMIC_POWER: { self: true, changes: [['DEFENSE', 1], ['SPECIAL_DEFENSE', 1]] },
  EFFECT_TICKLE: { self: false, changes: [['ATTACK', -1], ['DEFENSE', -1]] },
};

/**
 * Effects that change no stat in generation III, though PokeAPI's row for the
 * move now does: Charge only powers the next Electric move, Rapid Spin only
 * frees the user, and a plain hit is a plain hit (Waterfall's flinch and any
 * other later addition included).
 */
const NO_STAT = new Set(['EFFECT_HIT', 'EFFECT_CHARGE', 'EFFECT_RAPID_SPIN']);

/** The effects that make a target flinch, with `secondaryEffectChance` as the odds. */
const FLINCH = new Set([
  'EFFECT_FLINCH_HIT',
  'EFFECT_FLINCH_MINIMIZE_HIT',
  'EFFECT_TWISTER',
  'EFFECT_SNORE',
  'EFFECT_FAKE_OUT',
  // Its second turn sets MOVE_EFFECT_FLINCH (`BattleScript_TwoTurnMovesSecondTurn`).
  'EFFECT_SKY_ATTACK',
]);

/** The stat changes an effect names, and whether they are the user's; null if it names none. */
export const statEffectOf = (effect) => {
  const single = effect.match(/^EFFECT_(ATTACK|DEFENSE|SPEED|SPECIAL_ATTACK|SPECIAL_DEFENSE|ACCURACY|EVASION)_(UP|DOWN)(_2)?(_HIT)?$/);
  if (single) {
    const stages = (single[2] === 'UP' ? 1 : -1) * (single[3] ? 2 : 1);
    // Up is the user's own and down is the target's, hit or not: FireRed has no
    // move that raises its target or lowers itself through these effects.
    return { self: single[2] === 'UP', changes: [{ stat: STAT[single[1]], change: stages }] };
  }
  const compound = COMPOUND[effect];
  if (compound) {
    return {
      self: compound.self,
      changes: compound.changes.map(([stat, change]) => ({ stat: STAT[stat], change })),
    };
  }
  return NO_STAT.has(effect) ? { self: false, changes: [] } : null;
};

/** FireRed's own row for a move, or undefined for one it does not have. */
export const fireRedRow = (name) => FIRERED.get(name);

/** A PokeAPI move row, corrected to what FireRed's own table says. */
export const withFireRedRules = (move) => {
  const row = FIRERED.get(move.name);
  if (!row) return move;
  const corrected = { ...move, priority: row.priority };
  // Both foes in FireRed is `MOVE_TARGET_BOTH`; anything aimed at one of them
  // is not, whatever the move hits today (Poison Gas is single in FireRed).
  if (row.target === 'MOVE_TARGET_BOTH') corrected.target = 'all-opponents';
  else if (move.target === 'all-opponents') corrected.target = 'selected-pokemon';

  const stats = statEffectOf(row.effect);
  if (stats) {
    corrected.stat_changes = stats.changes;
    if (move.category !== 'Status') {
      corrected.meta = stats.changes.length === 0 ? 'damage' : stats.self ? 'damage-raise' : 'damage-lower';
      corrected.stat_chance = stats.changes.length === 0 ? 0 : row.secondaryEffectChance;
    }
  }
  if (move.category !== 'Status') {
    // Fake Out's flinch is its whole effect, so FireRed gives it no chance field:
    // it is certain (on the first turn, which this engine does not track).
    corrected.flinch_chance = FLINCH.has(row.effect) ? row.secondaryEffectChance || 100 : 0;
    // A status a hit can leave rolls at FireRed's own odds - Poison Fang is 30
    // there, 50 now.
    if (move.ailment !== 'none' && row.secondaryEffectChance > 0) {
      corrected.ailment_chance = row.secondaryEffectChance;
    }
  }
  return corrected;
};
