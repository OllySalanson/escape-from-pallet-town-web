import { MoveCategory, MoveTarget, type MoveBase } from '../MoveBase';
import { PokemonType } from '../PokemonType';
import { absorbs, blocksBoost, blocksCondition } from './abilityHooks';
import {
  abilityCarrier,
  effectiveWeather,
  engagedSlots,
  getCombatantTypes,
  opposing,
  unitAt,
  type BattleCombatant,
  type BattleState,
  type SlotRef,
} from './battleEngine';
import { calculateDamage, type RandomSource } from './damage';
import { typeRefusesStatus } from './status';
import { STAT_STAGE_LIMIT } from './statStages';
import { getTypeEffectiveness } from './typeChart';
import { WeatherId } from './weather';

/**
 * How a trainer chooses a move, when it is marked to choose one at all.
 *
 * Every enemy in this game picks a move at random from the ones it has PP for
 * (`chooseEnemyMove`), which is right for a wild Pokemon and for the hunters,
 * whom the captain ruled easy - and wrong for a gym, whose whole design is a
 * combo the leader plays on purpose. A Staryu that might use Rain Dance on any
 * turn, or never, and throws Water at a Water Absorb Poliwag, is not a puzzle
 * anybody can be asked to read.
 *
 * So `gym` is a port of the first three of FireRed's own trainer AI scripts,
 * read off pret/pokefirered's `data/battle_ai_scripts.s` and run the way
 * `BattleAI_ChooseMoveOrAction` runs them: every move it could use starts on
 * 100, each script adds to or takes from that, and the highest score is used,
 * a tie broken at random.
 *
 *  1. **`AI_CheckBadMove`: never a move that will fail.** A move the target's
 *     type is immune to (-10); one an ability on the target swallows - Water
 *     Absorb, Volt Absorb, Flash Fire, Levitate, Soundproof (-12, -10); a
 *     status on a target already carrying one or refusing it (-10, confusion on
 *     the confused -5); a stat already at its cap, or held by Keen Eye, Hyper
 *     Cutter or Clear Body (-10); Rain Dance in the rain and Sunny Day in the
 *     sun (-8); Leech Seed on a Grass type or the already seeded (-10). And
 *     from `AI_CheckViability`, Recover at full health (-3).
 *  2. **`AI_TryToFaint`: the knockout when it is there.** A move expected to
 *     knock the target out is +4 (+6 for a move with priority, as FireRed's
 *     Quick Attack; nothing for one that faints the user); any other damaging
 *     move that is not the hardest hitting against that target is -1.
 *  3. **`AI_SetupFirstTurn`: set up on the battle's first turn.** A move whose
 *     effect is on FireRed's list - a stat raised or lowered, poison,
 *     paralysis, confusion, Leech Seed - is +2 on turn one, unless a roll under
 *     80 of 256 says not this time. And from `AI_CheckViability`, the one rule
 *     the gym's own combo needs: Rain Dance is +1 when the user is faster than
 *     its target or swims in the rain (Swift Swim), -1 when it is under 40% of
 *     its HP. In a double battle a partner that swims counts as the user
 *     swimming - FireRed's AI never thought about a partner, and the setter
 *     beside a swimmer is the point of the fight.
 *
 * In a double battle each foe is scored as a target and the best (move, target)
 * pair is used, as FireRed scores a move against the battler it would hit.
 *
 * Only trainers marked `ai: 'gym'` choose this way (`TrainerBattle.ai`), so no
 * fight measured before this existed moves a single roll.
 */

export type TrainerAi = 'gym';

export interface TrainerMoveChoice {
  readonly moveIndex: number;
  readonly target?: SlotRef;
}

const BASE_SCORE = 100;

/** `if_random_less_than 80`: the roll that skips the turn-one bonus. */
const SETUP_SKIP_BELOW = 80 / 256;

/**
 * Whether this move, used on this target now, would do nothing at all - the
 * question `AI_CheckBadMove` asks, answered as the engine would answer it.
 * Exported because the measuring harness asks it too: a measured player who
 * opens with Thunder Wave does not throw it at a Ground type or at a foe that
 * is already paralysed (`trainerMeasure.ts`).
 */
export function isUselessMove(
  state: BattleState,
  user: SlotRef,
  move: MoveBase,
  target: SlotRef | undefined,
): boolean {
  return badMoveScore(state, user, move, target) < 0;
}

/** What `AI_CheckBadMove` takes off a move, zero when it has nothing against it. */
function badMoveScore(
  state: BattleState,
  user: SlotRef,
  move: MoveBase,
  target: SlotRef | undefined,
): number {
  const self = unitAt(state, user);
  if (!self) {
    return 0;
  }
  // The field's own effects first: they land on nobody.
  const weather = state.weather?.id ?? null;
  if (move.effects.weather !== undefined && weather === move.effects.weather) {
    return -8;
  }
  // Recover at full health heals nothing (`AI_CV_Heal`, at full HP).
  if (move.healing > 0 && self.currentHp >= self.pokemon.maxHp) {
    return -3;
  }
  if (move.target === MoveTarget.Self) {
    for (const boost of move.effects.boosts) {
      const stage = self.statStages[boost.stat];
      if ((boost.stages > 0 && stage >= STAT_STAGE_LIMIT) || (boost.stages < 0 && stage <= -STAT_STAGE_LIMIT)) {
        return -10;
      }
    }
    return 0;
  }
  const foe = target ? unitAt(state, target) : null;
  if (!foe || foe.currentHp <= 0) {
    return 0;
  }
  const types = getCombatantTypes(foe);
  const carrier = abilityCarrier(foe);
  const damaging = move.category !== MoveCategory.Status && move.power > 0;
  // A move that cannot touch the target at all, as the chart has it. A status
  // move is asked too where it carries a status, which is FireRed's Thunder
  // Wave on a Ground type; a stat change from Growl reaches a Ghost.
  if ((damaging || move.effects.status !== undefined) && !move.typeless && getTypeEffectiveness(move.type, types) === 0) {
    return -10;
  }
  const absorbed = absorbs(carrier, move);
  if (absorbed) {
    return absorbed.blocks ? -10 : -12;
  }
  if (damaging) {
    return 0;
  }
  const { status } = move.effects;
  if (status === 'confusion') {
    if (foe.confusionTurns > 0) {
      return -5;
    }
    if (blocksCondition(carrier, 'confusion')) {
      return -10;
    }
  } else if (status !== undefined) {
    if (foe.primaryStatus !== null || typeRefusesStatus(status, types) || blocksCondition(carrier, status)) {
      return -10;
    }
  }
  for (const boost of move.effects.boosts) {
    const stage = foe.statStages[boost.stat];
    if (boost.stages < 0 && (stage <= -STAT_STAGE_LIMIT || blocksBoost(carrier, boost.stat))) {
      return -10;
    }
    if (boost.stages > 0 && stage >= STAT_STAGE_LIMIT) {
      return -10;
    }
  }
  if (move.effects.seed) {
    if (foe.seededBy !== null || types.includes(PokemonType.Grass)) {
      return -10;
    }
  }
  return 0;
}

/** What one swing is expected to take off this target: a middling roll, no critical hit. */
function expectedDamage(state: BattleState, attacker: BattleCombatant, defender: BattleCombatant, move: MoveBase): number {
  if (move.category === MoveCategory.Status || move.power <= 0) {
    return 0;
  }
  if (absorbs(abilityCarrier(defender), move)) {
    return 0;
  }
  const hits = move.hits ? (move.hits.min + move.hits.max) / 2 : 1;
  return (
    calculateDamage(
      attacker.pokemon,
      defender.pokemon,
      move,
      () => 0.5,
      attacker.statStages,
      defender.statStages,
      effectiveWeather(state),
      { attacker: abilityCarrier(attacker), defender: abilityCarrier(defender) },
    ).damage * hits
  );
}

/** FireRed's list of effects `AI_SetupFirstTurn` encourages on turn one, read as this game's effects. */
function isSetupMove(move: MoveBase): boolean {
  if (move.category !== MoveCategory.Status) {
    return false;
  }
  const { boosts, status, seed } = move.effects;
  return boosts.length > 0 || status === 'poison' || status === 'paralysis' || status === 'confusion' || seed;
}

/** Whether anybody on this side swims in the rain. */
function sideSwims(state: BattleState, user: SlotRef): boolean {
  return engagedSlots(state, user.side).some((ref) => {
    const combatant = unitAt(state, ref);
    return combatant !== null && combatant.pokemon.base.abilityId === 'swift-swim';
  });
}

/** `AI_CV_RainDance` and `AI_CV_SunnyDay`, the part of them this game can say. */
function weatherViability(state: BattleState, user: SlotRef, move: MoveBase, target: SlotRef | undefined): number {
  const wanted = move.effects.weather;
  if (wanted === undefined) {
    return 0;
  }
  const self = unitAt(state, user)!;
  if (self.currentHp < self.pokemon.maxHp * 0.4) {
    return -1;
  }
  if (wanted !== WeatherId.Rain) {
    // Sunny Day's +1 is for clearing another weather, which no shipped fight has.
    const weather = state.weather?.id ?? null;
    return weather !== null && weather !== wanted ? 1 : 0;
  }
  const foe = target ? unitAt(state, target) : null;
  const faster = foe !== null && self.pokemon.stats.speed > foe.pokemon.stats.speed;
  return faster || sideSwims(state, user) ? 1 : 0;
}

/**
 * The move a trainer marked `gym` uses this turn, and who it is aimed at.
 * Null when it has nothing it can pay for, which the engine turns into
 * Struggle exactly as it does for a random chooser.
 */
export function chooseTrainerMove(
  state: BattleState,
  user: SlotRef,
  random: RandomSource,
): TrainerMoveChoice | null {
  const self = unitAt(state, user);
  if (!self) {
    return null;
  }
  const foes = engagedSlots(state, opposing(user.side));
  const targets: readonly (SlotRef | undefined)[] = foes.length > 0 ? foes : [undefined];
  const firstTurn = (state.turnsPlayed ?? 0) === 0;
  const scored: { readonly moveIndex: number; readonly target?: SlotRef; readonly score: number }[] = [];
  self.moves.forEach((move, moveIndex) => {
    if (move.pp <= 0) {
      return;
    }
    const base = move.base;
    // A move that lands on the user or the field is scored once; one aimed at a
    // foe is scored against each, and a spread move against the worst of them.
    const aims: readonly (SlotRef | undefined)[] =
      base.target === MoveTarget.Self || base.effects.weather !== undefined ? [targets[0]] : targets;
    for (const target of aims) {
      let score = BASE_SCORE + badMoveScore(state, user, base, target);
      const foe = target ? unitAt(state, target) : null;
      if (foe && base.category !== MoveCategory.Status && base.power > 0) {
        const damage = expectedDamage(state, self, foe, base);
        if (damage >= foe.currentHp && damage > 0) {
          score += base.userFaints ? 0 : base.priority > 0 ? 6 : 4;
        } else {
          const strongest = Math.max(
            ...self.moves
              .filter((other) => other.pp > 0)
              .map((other) => expectedDamage(state, self, foe, other.base)),
          );
          if (damage < strongest) {
            score -= 1;
          }
        }
      }
      if (firstTurn && isSetupMove(base) && random() >= SETUP_SKIP_BELOW) {
        score += 2;
      }
      score += weatherViability(state, user, base, target);
      scored.push({
        moveIndex,
        ...(base.target === MoveTarget.Self || base.effects.weather !== undefined || target === undefined
          ? {}
          : { target }),
        score,
      });
    }
  });
  if (scored.length === 0) {
    return null;
  }
  const top = Math.max(...scored.map((entry) => entry.score));
  const best = scored.filter((entry) => entry.score === top);
  const chosen = best.length === 1 ? best[0] : best[Math.floor(Math.min(0.999999, Math.max(0, random())) * best.length)];
  return { moveIndex: chosen.moveIndex, ...(chosen.target ? { target: chosen.target } : {}) };
}
