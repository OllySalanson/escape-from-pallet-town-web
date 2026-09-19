import type { BattleState } from '../pokemon/battle/battleEngine';
import { getTypeEffectiveness } from '../pokemon/battle/typeChart';
import { weatherDamageMultiplier } from '../pokemon/battle/weather';
import { MoveCategory } from '../pokemon/MoveBase';

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
  const user = state.player.pokemon.base;
  const types = [
    state.enemy.pokemon.base.primaryType,
    ...(state.enemy.pokemon.base.secondaryType ? [state.enemy.pokemon.base.secondaryType] : []),
  ];
  let best = 0;
  let bestScore = -1;
  state.player.moves.forEach((move, index) => {
    if (move.pp <= 0 || move.base.category === MoveCategory.Status || move.base.power <= 0) {
      return;
    }
    const sameType =
      move.base.type === user.primaryType || move.base.type === user.secondaryType ? 1.5 : 1;
    const score =
      move.base.power *
      sameType *
      getTypeEffectiveness(move.base.type, types) *
      weatherDamageMultiplier(state.weather?.id ?? null, move.base.type);
    if (score > bestScore) {
      bestScore = score;
      best = index;
    }
  });
  return best;
}
