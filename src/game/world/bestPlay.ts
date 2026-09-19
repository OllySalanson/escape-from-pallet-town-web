import {
  engagedSlots,
  opposing,
  slotRef,
  unitAt,
  type BattleState,
  type SlotRef,
} from '../pokemon/battle/battleEngine';
import { SPREAD_DAMAGE_MULTIPLIER } from '../pokemon/battle/damage';
import { getTypeEffectiveness } from '../pokemon/battle/typeChart';
import { weatherDamageMultiplier } from '../pokemon/battle/weather';
import { MoveCategory, MoveTarget } from '../pokemon/MoveBase';

/**
 * The move a player who is paying attention would pick, which is the one thing
 * both measuring harnesses have to agree on.
 *
 * `encounterMeasure.ts` plays a place out and `trainerMeasure.ts` plays a
 * trainer out; each used to score moves as power times effectiveness, and that
 * is not what the damage roll does. The engine pays a **same-type bonus**, so
 * with equal power a Pokemon's own-typed move is half as strong again as a
 * Normal one - and the three starters' signature moves are all 40 power, the
 * same as Tackle and Scratch. Scored without the bonus they tie, the tie went
 * to the first slot, and every measured starter answered every fight with
 * Tackle. It is not a rounding error: a level-7 Charmander goes from losing the
 * Floodplain checkpoint every single time to winning about half of them the
 * moment it is allowed to throw the Ember it has known since level 7.
 *
 * Effectiveness is still read from the live chart, so a resisted signature move
 * loses to a neutral Tackle exactly as it should - a Bulbasaur answers a Pidgey
 * with Tackle, because Flying halves Vine Whip. The **weather over the field**
 * is read the same way and for the same reason: three districts are rain, one
 * of them the reeds the Floodplain checkpoint stands in, and a Charmander that
 * goes on throwing a halved Ember there when Scratch is stronger is a measured
 * player losing fights no real one would.
 */
export function bestDamagingMove(state: BattleState): number {
  return bestPlayFor(state, slotRef('player', 0)).moveIndex;
}

/**
 * The same question asked of one slot, with who to aim at as part of the
 * answer.
 *
 * A double battle makes the choice two-dimensional: a move that hits both foes
 * is worth what it does to *both* of them, at half strength each
 * (`SPREAD_DAMAGE_MULTIPLIER`), and a move that hits one is worth what it does
 * to the best of them. Scoring the spread move against one target is how a
 * measured player would throw a Razor Leaf at a single foe and call it weak.
 */
export function bestPlayFor(
  state: BattleState,
  ref: SlotRef,
): { readonly moveIndex: number; readonly target?: SlotRef } {
  const combatant = unitAt(state, ref);
  const foes = engagedSlots(state, opposing(ref.side));
  if (!combatant) {
    return { moveIndex: 0 };
  }
  const user = combatant.pokemon.base;
  const weather = state.weather?.id ?? null;
  const against = (foe: SlotRef, move: BattleState['player']['moves'][number]): number => {
    const defender = unitAt(state, foe);
    if (!defender) {
      return 0;
    }
    const types = [
      defender.pokemon.base.primaryType,
      ...(defender.pokemon.base.secondaryType ? [defender.pokemon.base.secondaryType] : []),
    ];
    const sameType =
      move.base.type === user.primaryType || move.base.type === user.secondaryType ? 1.5 : 1;
    return (
      move.base.power *
      sameType *
      getTypeEffectiveness(move.base.type, types) *
      weatherDamageMultiplier(weather, move.base.type)
    );
  };

  let best = 0;
  let bestTarget: SlotRef | undefined = foes[0];
  let bestScore = -1;
  combatant.moves.forEach((move, index) => {
    if (move.pp <= 0 || move.base.category === MoveCategory.Status || move.base.power <= 0) {
      return;
    }
    if (move.base.target === MoveTarget.BothFoes) {
      const spread = foes.length > 1 ? SPREAD_DAMAGE_MULTIPLIER : 1;
      const score = foes.reduce((total, foe) => total + against(foe, move) * spread, 0);
      if (score > bestScore) {
        bestScore = score;
        best = index;
        bestTarget = foes[0];
      }
      return;
    }
    for (const foe of foes) {
      const score = against(foe, move);
      if (score > bestScore) {
        bestScore = score;
        best = index;
        bestTarget = foe;
      }
    }
  });
  return { moveIndex: best, target: bestTarget };
}
