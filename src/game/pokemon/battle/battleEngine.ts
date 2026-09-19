import type { MoveBase, NormalizedMoveEffects, NormalizedSecondaryEffect } from '../MoveBase';
import { MoveCategory, MoveCharge, MoveTarget } from '../MoveBase';
import type { Pokemon } from '../Pokemon';
import type { PokemonType } from '../PokemonType';
import { calculateDamage, type RandomSource } from './damage';
import {
  endOfTurnHeal,
  gearLabel,
  rollsFirstStrike,
  survivesKnockout,
} from './heldItems';
import { PrimaryStatus, type PrimaryStatus as PrimaryStatusType, type StatusName } from './status';
import { getTypeEffectiveness } from './typeChart';
import {
  applyStatBoost,
  createStatStages,
  getStagedStat,
  stagedAccuracy,
  type StageStat,
  type StatBoost,
  type StatStages,
} from './statStages';

export interface BattleMove {
  readonly base: MoveBase;
  readonly pp: number;
}

export interface BattleCombatant {
  readonly pokemon: Pokemon;
  readonly currentHp: number;
  readonly moves: readonly BattleMove[];
  readonly primaryStatus: PrimaryStatusType | null;
  readonly sleepTurns: number;
  readonly confusionTurns: number;
  readonly statStages: StatStages;
  /**
   * Whether the gear this Pokemon carries has already done its one thing in this
   * battle - a Focus Band that has taken its blow.
   *
   * *Which* item is held is not copied here: it is read through to
   * `pokemon.heldItemId`, so the fight can never disagree with the party about
   * what is being carried, the way a copied move list used to disagree after a
   * level-up. What belongs to the fight is only this flag, and it resets when the
   * Pokemon is sent out, exactly as sleep turns and stat stages do.
   */
  readonly heldItemSpent: boolean;
  /**
   * Set by whoever moved first this turn, read and spent by whoever moves
   * second. It is cleared at the top of every turn for both sides, which is
   * what makes "a flinch only works if you were faster" true by construction
   * rather than by a check.
   */
  readonly flinching: boolean;
  /**
   * A move that has taken this combatant's next action away from it: a charge
   * turn that must land, or a recharge that must be sat out. It survives into
   * the next turn, which is the one thing `applyMove` could not do - an action
   * used to be resolved entirely inside one call.
   */
  readonly pendingMove: PendingMove | null;
}

export interface PendingMove {
  readonly moveIndex: number;
  /** `charge` will fire the move next turn; `recharge` will lose the turn. */
  readonly kind: MoveCharge;
}

export interface TrainerBattle {
  readonly id: string;
  readonly name: string;
  readonly party: readonly Pokemon[];
  readonly sprite?: string;
  readonly defeatText?: string;
  readonly prize?: string;
}

export interface BattleState {
  readonly player: BattleCombatant;
  readonly enemy: BattleCombatant;
  readonly playerStatStages: ReadonlyMap<Pokemon, StatStages>;
  readonly trainer?: TrainerBattle;
  readonly enemyPartyIndex: number;
  readonly outcome: 'active' | 'victory' | 'defeat' | 'caught';
}

export type BattleEvent =
  | {
      readonly type: 'used-move';
      readonly user: 'player' | 'enemy';
      readonly target?: 'player' | 'enemy';
      readonly name: string;
      readonly move: string;
      /**
       * The HP the hit actually took, which is what the battle log prints. A
       * hit that rolled 5 into a target on 2 HP cost it 2: reporting the roll
       * made the log claim more HP than the bar had ever shown.
       */
      readonly damage?: number;
      /** What kind of move it was, so the hit can sound like one. */
      readonly category?: MoveCategory;
      /** The web game's same-type bonus, reported so its 1.5x is not hidden. */
      readonly isStab?: boolean;
    }
  | { readonly type: 'missed'; readonly user: 'player' | 'enemy' }
  | { readonly type: 'critical-hit' }
  | { readonly type: 'effectiveness'; readonly multiplier: number }
  | { readonly type: 'fainted'; readonly user: 'player' | 'enemy'; readonly name: string }
  | { readonly type: 'no-pp'; readonly user: 'player' | 'enemy'; readonly move: string }
  | { readonly type: 'status-applied'; readonly user: 'player' | 'enemy'; readonly name: string; readonly status: StatusName }
  | { readonly type: 'status-already'; readonly user: 'player' | 'enemy'; readonly name: string; readonly status: StatusName }
  | { readonly type: 'status-prevented'; readonly user: 'player' | 'enemy'; readonly name: string; readonly status: PrimaryStatusType }
  | { readonly type: 'status-damage'; readonly user: 'player' | 'enemy'; readonly name: string; readonly status: PrimaryStatusType; readonly damage: number }
  | { readonly type: 'status-cured'; readonly user: 'player' | 'enemy'; readonly name: string; readonly status: 'sleep' | 'freeze' | 'confusion' }
  | { readonly type: 'confusion-self-hit'; readonly user: 'player' | 'enemy'; readonly name: string; readonly damage: number }
  | { readonly type: 'stat-stage-changed'; readonly user: 'player' | 'enemy'; readonly name: string; readonly stat: StageStat; readonly stages: number }
  // What a move does beyond its damage, each announced where it happens, so the
  // battle log explains a turn without the player having to read the HP bar.
  | { readonly type: 'flinched'; readonly user: 'player' | 'enemy'; readonly name: string }
  | { readonly type: 'multi-hit'; readonly hits: number }
  | { readonly type: 'drained'; readonly user: 'player' | 'enemy'; readonly name: string; readonly amount: number }
  | { readonly type: 'recoil'; readonly user: 'player' | 'enemy'; readonly name: string; readonly damage: number }
  | { readonly type: 'healed'; readonly user: 'player' | 'enemy'; readonly name: string; readonly amount: number }
  | { readonly type: 'heal-failed'; readonly user: 'player' | 'enemy'; readonly name: string }
  | { readonly type: 'charging'; readonly user: 'player' | 'enemy'; readonly name: string; readonly move: string }
  | { readonly type: 'recharging'; readonly user: 'player' | 'enemy'; readonly name: string }
  | { readonly type: 'ball-thrown'; readonly name: string }
  | { readonly type: 'catch-shake'; readonly count: number }
  | { readonly type: 'caught'; readonly name: string }
  | { readonly type: 'broke-free'; readonly name: string }
  | { readonly type: 'catch-disabled' }
  | { readonly type: 'enemy-sent-out'; readonly name: string }
  // Gear. Each one is announced the moment it acts, because an item whose effect
  // is only visible in the HP bar is an item the player has to be told about in
  // a menu - and the whole point of these four is that they explain themselves.
  | { readonly type: 'gear-first-strike'; readonly user: 'player' | 'enemy'; readonly name: string; readonly item: string }
  | { readonly type: 'gear-endured'; readonly user: 'player' | 'enemy'; readonly name: string; readonly item: string }
  | { readonly type: 'gear-recoil'; readonly user: 'player' | 'enemy'; readonly name: string; readonly item: string; readonly damage: number }
  | { readonly type: 'gear-heal'; readonly user: 'player' | 'enemy'; readonly name: string; readonly item: string; readonly amount: number };

export type { StatusName } from './status';

export interface TurnResult {
  readonly state: BattleState;
  readonly events: readonly BattleEvent[];
}

export interface CatchAttempt {
  readonly chance: number;
  readonly caught: boolean;
  readonly shakes: number;
}

/**
 * Catch chance is a deliberately simple, visible rule for the extraction loop:
 * 20% at full HP, rising linearly by up to 60% as HP falls, plus a 25% bonus
 * for sleep/freeze or 15% for paralysis/poison/burn, then the ball modifier.
 * The result is capped at 95%, so every throw retains a small amount of risk.
 */
export const getCatchChance = (
  currentHp: number,
  maxHp: number,
  primaryStatus: PrimaryStatusType | null,
  ballModifier = 1,
): number => {
  const hpFraction = maxHp > 0 ? Math.min(1, Math.max(0, currentHp / maxHp)) : 1;
  const statusBonus =
    primaryStatus === PrimaryStatus.Sleep || primaryStatus === PrimaryStatus.Freeze
      ? 0.25
      : primaryStatus
        ? 0.15
        : 0;
  return Math.min(0.95, Math.max(0, (0.2 + (1 - hpFraction) * 0.6 + statusBonus) * ballModifier));
};

export const attemptCatch = (
  combatant: BattleCombatant,
  random: RandomSource,
  ballModifier = 1,
): CatchAttempt => {
  const chance = getCatchChance(combatant.currentHp, combatant.pokemon.maxHp, combatant.primaryStatus, ballModifier);
  const roll = clampRandom(random());
  const caught = roll < chance;
  // Failed throws can still wobble up to twice. A successful throw always
  // shows the classic three shakes before the capture message.
  const shakes = caught ? 3 : Math.min(2, Math.floor((chance / Math.max(roll, 0.000001)) * 3));
  return { chance, caught, shakes };
};

const toCombatant = (pokemon: Pokemon): BattleCombatant => ({
  pokemon,
  currentHp: pokemon.currentHp,
  moves: pokemon.moves.map((move) => ({ base: move.base, pp: move.pp })),
  primaryStatus: pokemon.primaryStatus,
  sleepTurns: 0,
  confusionTurns: 0,
  statStages: createStatStages(),
  heldItemSpent: false,
  flinching: false,
  pendingMove: null,
});

export const createBattleState = (player: Pokemon, enemy: Pokemon): BattleState => {
  const playerCombatant = toCombatant(player);
  return {
    player: playerCombatant,
    enemy: toCombatant(enemy),
    playerStatStages: new Map([[player, playerCombatant.statStages]]),
    enemyPartyIndex: 0,
    outcome: player.isFainted ? 'defeat' : enemy.isFainted ? 'victory' : 'active',
  };
};

export const createTrainerBattleState = (player: Pokemon, trainer: TrainerBattle): BattleState => {
  const firstEnemy = trainer.party[0];
  if (!firstEnemy) {
    throw new Error('A trainer battle requires at least one Pokemon.');
  }
  return {
    ...createBattleState(player, firstEnemy),
    trainer,
  };
};

export const canCatchEnemy = (state: BattleState): boolean => state.trainer === undefined;

export const chooseEnemyMove = (combatant: BattleCombatant, random: RandomSource): number | null => {
  const usableMoves = combatant.moves
    .map((move, index) => ({ move, index }))
    .filter(({ move }) => move.pp > 0);
  if (usableMoves.length === 0) {
    return null;
  }

  return usableMoves[Math.floor(clampRandom(random()) * usableMoves.length)]?.index ?? null;
};

/**
 * The move this side is not free to choose this turn, if any: the second half of
 * a charge, or a recharge that will be sat out. `BattleScene` asks before it
 * opens the command menu, because a turn the player did not choose still has to
 * be narrated as a turn.
 */
export const lockedMove = (state: BattleState, user: 'player' | 'enemy'): number | null => {
  const pending = (user === 'player' ? state.player : state.enemy).pendingMove;
  return pending ? pending.moveIndex : null;
};

export const resolveTurn = (
  state: BattleState,
  playerMoveIndex: number,
  random: RandomSource,
): TurnResult => {
  if (state.outcome !== 'active') {
    return { state, events: [] };
  }

  // A pending charge or recharge overrides whatever was chosen: the move is no
  // longer the player's to pick until the two-turn action has finished.
  const forcedPlayerMove = lockedMove(state, 'player');
  if (forcedPlayerMove !== null) {
    playerMoveIndex = forcedPlayerMove;
  }

  const playerMove = state.player.moves[playerMoveIndex];
  if (!playerMove || (playerMove.pp <= 0 && forcedPlayerMove === null)) {
    return {
      state,
      events: playerMove
        ? [{ type: 'no-pp', user: 'player', move: playerMove.base.name }]
        : [],
    };
  }

  const enemyMoveIndex = lockedMove(state, 'enemy') ?? chooseEnemyMove(state.enemy, random);
  // Quick Claw is rolled before the order is decided, once for each side that
  // carries one, so the claw is the reason the turn came out the way it did
  // rather than an adjustment made afterwards. A claw that fires is announced
  // before the move it let through.
  const claws: BattleEvent[] = [];
  const firstStrike = (user: 'player' | 'enemy', combatant: BattleCombatant): 1 | 0 => {
    if (!rollsFirstStrike(combatant.pokemon, random)) {
      return 0;
    }
    claws.push({
      type: 'gear-first-strike',
      user,
      name: combatant.pokemon.base.name,
      item: gearLabel(combatant.pokemon.heldItemId),
    });
    return 1;
  };
  // Two orderings, and the move's own is the outer one. A priority move goes
  // first whatever the Speed, and Quick Claw breaks the tie *inside* that
  // bracket rather than outranking it - a claw has never let a Pokemon cut in
  // front of a Quick Attack.
  const movePriority = (combatant: BattleCombatant, moveIndex: number): number =>
    combatant.moves[moveIndex]?.base.priority ?? 0;
  const actions = [
    {
      user: 'player' as const,
      moveIndex: playerMoveIndex,
      speed: getStagedStat(state.player.pokemon.stats.speed, state.player.statStages.speed),
      priority: movePriority(state.player, playerMoveIndex),
      claw: firstStrike('player', state.player),
    },
    ...(enemyMoveIndex === null
      ? []
      : [{
        user: 'enemy' as const,
        moveIndex: enemyMoveIndex,
        speed: getStagedStat(state.enemy.pokemon.stats.speed, state.enemy.statStages.speed),
        priority: movePriority(state.enemy, enemyMoveIndex),
        claw: firstStrike('enemy', state.enemy),
      }]),
  ].sort(
    (left, right) =>
      right.priority - left.priority ||
      right.claw - left.claw ||
      right.speed - left.speed ||
      (left.user === 'player' ? -1 : 1),
  );

  // Flinch is cleared for both sides before anyone acts, so the only flinch a
  // combatant can be carrying when its turn comes is one the other side set
  // this turn - which is exactly the rule that a flinch needs you to be faster.
  let nextState = clearFlinching(state);
  const events: BattleEvent[] = [...claws];
  for (const action of actions) {
    if (nextState.outcome !== 'active') {
      break;
    }
    const result = applyMove(nextState, action.user, action.moveIndex, random);
    nextState = result.state;
    events.push(...result.events);
  }

  return { state: clearFlinching(nextState), events };
};

const clearFlinching = (state: BattleState): BattleState =>
  state.player.flinching || state.enemy.flinching
    ? {
        ...state,
        player: { ...state.player, flinching: false },
        enemy: { ...state.enemy, flinching: false },
      }
    : state;

export const replacePlayerPokemon = (state: BattleState, pokemon: Pokemon): BattleState => {
  const statStages = state.playerStatStages.get(pokemon) ?? createStatStages();
  const player = { ...toCombatant(pokemon), statStages };
  return {
    ...state,
    player,
    playerStatStages: new Map(state.playerStatStages).set(pokemon, statStages),
    outcome: pokemon.isFainted ? 'defeat' : state.enemy.currentHp === 0 ? 'victory' : 'active',
  };
};

/**
 * Re-reads the two things a level-up reached mid-battle changes on the Pokemon
 * underneath a combatant, so the fight that earned the level is the fight that
 * pays it out.
 *
 * A `BattleCombatant` is a snapshot taken when its Pokemon was sent out, which
 * is what lets the battle own PP, status, its counters and stat stages without
 * writing them to the party. Level and stats are read through `pokemon` and so
 * are already live; the move *list* and the HP that a raised maximum carries
 * are not, and both arrive with a level-up. Only a trainer battle with a second
 * Pokemon keeps a battle alive long enough to see it - a wild battle ends on the
 * knockout that awarded the experience.
 *
 * `previousMaxHp` is the maximum before the level-up, so the HP a higher maximum
 * grants is added exactly as `Pokemon.gainExperience` grants it. Everything the
 * battle owns is kept: PP on a move already known is carried across by move
 * identity rather than by position, and a fainted combatant is left fainted.
 */
export const refreshCombatantAfterLevelUp = (
  combatant: BattleCombatant,
  previousMaxHp: number,
): BattleCombatant => {
  const gainedHp = Math.max(0, combatant.pokemon.maxHp - previousMaxHp);
  return {
    ...combatant,
    currentHp:
      combatant.currentHp === 0
        ? 0
        : Math.min(combatant.pokemon.maxHp, combatant.currentHp + gainedHp),
    moves: combatant.pokemon.moves.map((move) => {
      const known = combatant.moves.find((candidate) => candidate.base === move.base);
      return known ?? { base: move.base, pp: move.pp };
    }),
  };
};

/** `refreshCombatantAfterLevelUp` for the side that can gain experience. */
export const refreshPlayerAfterLevelUp = (state: BattleState, previousMaxHp: number): BattleState =>
  updateCombatant(state, 'player', refreshCombatantAfterLevelUp(state.player, previousMaxHp));

/** Writes bounded, battle-owned state back to the matching party Pokemon. */
export const persistCombatantToPokemon = (combatant: BattleCombatant): void => {
  combatant.pokemon.currentHp = combatant.currentHp;
  combatant.pokemon.primaryStatus = combatant.primaryStatus;
  combatant.pokemon.moves.forEach((move, index) => {
    const battleMove =
      combatant.moves.find((candidate) => candidate.base === move.base) ?? combatant.moves[index];
    if (battleMove) {
      move.setPp(battleMove.pp);
    }
  });
};

export const resolveEnemyTurn = (state: BattleState, random: RandomSource): TurnResult => {
  if (state.outcome !== 'active') {
    return { state, events: [] };
  }

  const enemyMoveIndex = lockedMove(state, 'enemy') ?? chooseEnemyMove(state.enemy, random);
  return enemyMoveIndex === null ? { state, events: [] } : applyMove(state, 'enemy', enemyMoveIndex, random);
};

export const resolveCatchAttempt = (
  state: BattleState,
  random: RandomSource,
  ballModifier = 1,
): TurnResult => {
  if (state.outcome !== 'active') {
    return { state, events: [] };
  }
  if (!canCatchEnemy(state)) {
    return { state, events: [{ type: 'catch-disabled' }] };
  }

  const attempt = attemptCatch(state.enemy, random, ballModifier);
  const name = state.enemy.pokemon.base.name;
  const events: BattleEvent[] = [
    { type: 'ball-thrown', name },
    ...Array.from({ length: attempt.shakes }, (_, index) => ({ type: 'catch-shake' as const, count: index + 1 })),
  ];
  if (attempt.caught) {
    return {
      state: { ...state, outcome: 'caught' },
      events: [...events, { type: 'caught', name }],
    };
  }
  return { state, events: [...events, { type: 'broke-free', name }] };
};

/**
 * One combatant's action, start to finish.
 *
 * The order is generation III's and each step is a thing a move may now declare
 * rather than a thing this function knows about a move by name:
 *
 *  1. a pending recharge, or the second half of a charge, takes the turn over;
 *  2. a flinch set by whoever moved first;
 *  3. status that forbids the action (paralysis, freeze, sleep, confusion);
 *  4. PP;
 *  5. a charge move's first turn, which ends here;
 *  6. one accuracy roll, read through accuracy and evasion stages;
 *  7. one to five hits;
 *  8. the move's own drain, recoil and healing;
 *  9. its guaranteed `effects`, then each of its `secondaries` on its own roll;
 * 10. held-item recoil, then end-of-action status and gear.
 */
const applyMove = (
  state: BattleState,
  user: 'player' | 'enemy',
  moveIndex: number,
  random: RandomSource,
): TurnResult => {
  const attacker = user === 'player' ? state.player : state.enemy;
  const pending = attacker.pendingMove;

  // 1. A recharge is the whole action. The pending move is spent either way, so
  // a Hyper Beam can never cost two turns in a row.
  if (pending?.kind === MoveCharge.Recharge) {
    const rested = updateCombatant(state, user, { ...attacker, pendingMove: null });
    return applyEndOfAction(rested, user, [
      { type: 'recharging', user, name: attacker.pokemon.base.name },
    ]);
  }
  const releasingCharge = pending?.kind === MoveCharge.Charge;
  const chosenIndex = releasingCharge ? pending.moveIndex : moveIndex;
  const move = attacker.moves[chosenIndex];
  // PP was already spent on the winding-up turn, so a released charge never
  // checks it - otherwise a Solar Beam on its last PP would fizzle halfway.
  if (!move || (!releasingCharge && move.pp <= 0)) {
    return { state, events: move ? [{ type: 'no-pp', user, move: move.base.name }] : [] };
  }

  // 2. Flinch, before any of the ordinary status rolls: it is the other side's
  // move that took this turn away, not this side's condition.
  if (attacker.flinching) {
    const shaken = updateCombatant(state, user, { ...attacker, flinching: false, pendingMove: null });
    return applyEndOfAction(shaken, user, [
      { type: 'flinched', user, name: attacker.pokemon.base.name },
    ]);
  }

  // 3.
  const attempted = resolveStatusBeforeMove(state, user, random);
  if (!attempted.canAct) {
    return applyEndOfAction(attempted.state, user, attempted.events);
  }

  let nextState = attempted.state;
  const attackerAfterStatus = user === 'player' ? nextState.player : nextState.enemy;
  const defenderUser = user === 'player' ? ('enemy' as const) : ('player' as const);
  const attackerName = attackerAfterStatus.pokemon.base.name;

  // 4. PP, and the charge that is being released is now spent.
  const spentAttacker: BattleCombatant = {
    ...attackerAfterStatus,
    pendingMove: null,
    moves: releasingCharge
      ? attackerAfterStatus.moves
      : attackerAfterStatus.moves.map((known, index) =>
          index === chosenIndex ? { ...known, pp: known.pp - 1 } : known,
        ),
  };
  nextState = updateCombatant(nextState, user, spentAttacker);
  const events: BattleEvent[] = [...attempted.events];

  // 5. A charge move's first turn announces itself and stops. The move is
  // remembered on the combatant, which is the one piece of state that has to
  // outlive this call.
  if (move.base.charge === MoveCharge.Charge && !releasingCharge) {
    nextState = updateCombatant(nextState, user, {
      ...spentAttacker,
      pendingMove: { moveIndex: chosenIndex, kind: MoveCharge.Charge },
    });
    events.push(
      { type: 'used-move', user, name: attackerName, move: move.base.name },
      { type: 'charging', user, name: attackerName, move: move.base.name },
    );
    return applyEndOfAction(nextState, user, events);
  }

  const defenderNow = (): BattleCombatant => (user === 'player' ? nextState.enemy : nextState.player);
  const attackerNow = (): BattleCombatant => (user === 'player' ? nextState.player : nextState.enemy);
  const defenderName = defenderNow().pokemon.base.name;

  // 6. One accuracy roll for the whole action, read through both stages. A move
  // with `alwaysHits` skips it, which is the only way Swift can exist.
  const accuracy = stagedAccuracy(
    move.base.accuracy,
    attackerNow().statStages.accuracy,
    defenderNow().statStages.evasion,
  );
  if (!move.base.alwaysHits && clampRandom(random()) * 100 >= accuracy) {
    events.push({ type: 'used-move', user, name: attackerName, move: move.base.name }, { type: 'missed', user });
    return applyEndOfAction(nextState, user, events);
  }

  // 7. Hits. A single-hit move runs this loop once, so there is one path.
  const hitCount = rollHitCount(move.base, random);
  let totalDamage = 0;
  let landedHits = 0;
  let critical = false;
  let stab = false;
  let effectiveness = 1;
  let heldItemRecoil = 0;
  let defenderFainted = false;
  let endured = false;
  let immune = false;

  for (let hit = 0; hit < hitCount && !defenderFainted; hit += 1) {
    const defender = defenderNow();
    const result = calculateDamage(
      attackerNow().pokemon,
      defender.pokemon,
      move.base,
      random,
      attackerNow().statStages,
      defender.statStages,
    );
    stab = result.isStab;
    effectiveness = result.typeEffectiveness;
    critical = critical || result.isCritical;
    heldItemRecoil += result.recoil;
    // A move the defender is immune to does nothing at all, secondaries
    // included: a Normal move cannot make a Ghost flinch on the way past.
    if (result.typeEffectiveness === 0 && move.base.category !== MoveCategory.Status) {
      immune = true;
      break;
    }
    if (result.damage <= 0 && move.base.category === MoveCategory.Status) {
      break;
    }
    const survived = survivesKnockout(
      defender.pokemon,
      defender.currentHp,
      result.damage,
      defender.heldItemSpent,
    );
    endured = endured || survived;
    const hurt: BattleCombatant = {
      ...defender,
      currentHp: survived ? 1 : Math.max(0, defender.currentHp - result.damage),
      heldItemSpent: defender.heldItemSpent || survived,
    };
    totalDamage += defender.currentHp - hurt.currentHp;
    landedHits += 1;
    nextState = updateCombatant(nextState, defenderUser, hurt);
    defenderFainted = hurt.currentHp === 0;
  }

  events.push({
    type: 'used-move',
    user,
    target: defenderUser,
    name: attackerName,
    move: move.base.name,
    damage: totalDamage,
    category: move.base.category,
    isStab: stab,
  });
  if (critical) {
    events.push({ type: 'critical-hit' });
  }
  if (landedHits > 1) {
    events.push({ type: 'multi-hit', hits: landedHits });
  }
  if (isDamagingMove(move)) {
    events.push(...effectivenessEvents(effectiveness));
  }
  if (endured) {
    events.push({
      type: 'gear-endured',
      user: defenderUser,
      name: defenderName,
      item: gearLabel(defenderNow().pokemon.heldItemId),
    });
  }

  // 8. What the swing gives back and what it costs, in that order: a drain that
  // takes the attacker to full and a recoil that then takes HP off it read as
  // two things, and netting them would explain neither.
  if (move.base.drain > 0 && totalDamage > 0) {
    const healer = attackerNow();
    const drained = Math.min(
      healer.pokemon.maxHp - healer.currentHp,
      Math.max(1, Math.floor(totalDamage * move.base.drain)),
    );
    if (drained > 0) {
      nextState = updateCombatant(nextState, user, { ...healer, currentHp: healer.currentHp + drained });
      events.push({ type: 'drained', user, name: attackerName, amount: drained });
    }
  }
  if (move.base.healing > 0) {
    const healer = attackerNow();
    const restored = Math.min(
      healer.pokemon.maxHp - healer.currentHp,
      Math.max(1, Math.floor(healer.pokemon.maxHp * move.base.healing)),
    );
    if (healer.currentHp >= healer.pokemon.maxHp) {
      events.push({ type: 'heal-failed', user, name: attackerName });
    } else {
      nextState = updateCombatant(nextState, user, { ...healer, currentHp: healer.currentHp + restored });
      events.push({ type: 'healed', user, name: attackerName, amount: restored });
    }
  }
  if (move.base.recoil > 0 && totalDamage > 0) {
    const hurt = attackerNow();
    const paid = Math.min(hurt.currentHp, Math.max(1, Math.floor(totalDamage * move.base.recoil)));
    nextState = updateCombatant(nextState, user, { ...hurt, currentHp: hurt.currentHp - paid });
    events.push({ type: 'recoil', user, name: attackerName, damage: paid });
  }

  if (defenderFainted) {
    nextState = resolveFaint(nextState, defenderUser);
    events.push({ type: 'fainted', user: defenderUser, name: defenderName });
    if (defenderUser === 'enemy' && nextState.outcome === 'active') {
      events.push({ type: 'enemy-sent-out', name: nextState.enemy.pokemon.base.name });
    }
  }

  // 9. The move's own effects, then its secondaries. Both are skipped once the
  // target is down or the battle is over - a flinch on a fainted Pokemon is a
  // line of log about nothing.
  const missedEntirely = landedHits === 0 && move.base.category !== MoveCategory.Status;
  if (!immune && !missedEntirely && nextState.outcome === 'active' && !defenderFainted) {
    const guaranteed = applyMoveEffects(nextState, user, move.base.effects, move.base.target, move.base, random);
    nextState = guaranteed.state;
    events.push(...guaranteed.events);
    for (const secondary of move.base.secondaries) {
      if (nextState.outcome !== 'active') {
        break;
      }
      // Each secondary rolls on its own, exactly as the tutorial does it: a
      // move with two of them can land both, one, or neither.
      if (clampRandom(random()) * 100 >= secondary.chance) {
        continue;
      }
      const rolled = applyMoveEffects(nextState, user, secondary, secondary.target, move.base, random);
      nextState = rolled.state;
      events.push(...rolled.events);
    }
  }

  // 10. A recharge is booked now, on the turn the move landed.
  if (move.base.charge === MoveCharge.Recharge && nextState.outcome === 'active') {
    const spent = attackerNow();
    if (spent.currentHp > 0) {
      nextState = updateCombatant(nextState, user, {
        ...spent,
        pendingMove: { moveIndex: chosenIndex, kind: MoveCharge.Recharge },
      });
    }
  }

  // Life Orb, after the hit has landed and after whatever it knocked out has
  // fallen: the price is paid for a hit that connected, and it is paid second, so
  // a holder that takes its last two HP paying for a knockout still wins the
  // fight it just ended.
  if (heldItemRecoil > 0) {
    const holder = attackerNow();
    const paid = Math.min(holder.currentHp, heldItemRecoil);
    if (paid > 0) {
      const hurtHolder = { ...holder, currentHp: holder.currentHp - paid };
      nextState = updateCombatant(nextState, user, hurtHolder);
      events.push({
        type: 'gear-recoil',
        user,
        name: attackerName,
        item: gearLabel(holder.pokemon.heldItemId),
        damage: paid,
      });
    }
  }

  const standing = attackerNow();
  if (standing.currentHp === 0 && nextState.outcome === 'active') {
    nextState = resolveFaint(nextState, user);
    events.push({ type: 'fainted', user, name: attackerName });
    if (user === 'enemy' && nextState.outcome === 'active') {
      events.push({ type: 'enemy-sent-out', name: nextState.enemy.pokemon.base.name });
    }
  }

  return applyEndOfAction(nextState, user, events);
};

/**
 * How many times a multi-hit move hits.
 *
 * Generation III does not roll this evenly: two and three hits are 3/8 each,
 * four and five are 1/8 each, which is why Double Slap averages a shade under
 * three. A move with `min === max` (Double Kick) is that number; anything else
 * is uniform, which is the honest fallback rather than a second invented curve.
 */
export const rollHitCount = (move: MoveBase, random: RandomSource): number => {
  if (!move.hits) {
    return 1;
  }
  const { min, max } = move.hits;
  if (min >= max) {
    return min;
  }
  if (min === 2 && max === 5) {
    const roll = clampRandom(random());
    return roll < 0.375 ? 2 : roll < 0.75 ? 3 : roll < 0.875 ? 4 : 5;
  }
  return min + Math.floor(clampRandom(random()) * (max - min + 1));
};

/**
 * One bundle of effects, landed on whichever side the bundle names.
 *
 * `target` is the whole reason this is a function rather than three lines in
 * `applyMove`: every stat boost in this engine used to go to the *other* side
 * unconditionally, so a move could lower a Defence but never raise its own
 * Attack. Metal Claw's 10% Attack raise is a secondary with `target: Self`, and
 * nothing else about it is special.
 */
const applyMoveEffects = (
  state: BattleState,
  user: 'player' | 'enemy',
  effects: NormalizedMoveEffects | NormalizedSecondaryEffect,
  target: MoveTarget,
  move: MoveBase,
  random: RandomSource,
): { readonly state: BattleState; readonly events: readonly BattleEvent[] } => {
  const side = target === MoveTarget.Self ? user : user === 'player' ? ('enemy' as const) : ('player' as const);
  let nextState = state;
  const events: BattleEvent[] = [];

  if (effects.boosts.length > 0) {
    const boosted = applyStatBoosts(nextState, side, effects.boosts);
    nextState = boosted.state;
    events.push(...boosted.events);
  }
  if (effects.status) {
    // A move that cannot touch the target at all cannot poison it either:
    // Thunder Wave used to paralyse a Ground type, because the status branch
    // never asked the type chart the damage branch was already asking.
    const receiver = side === 'player' ? nextState.player : nextState.enemy;
    const immune =
      side !== user && getTypeEffectiveness(move.type, getCombatantTypes(receiver)) === 0;
    if (!immune) {
      const applied = applyStatus(nextState, side, effects.status, random);
      nextState = applied.state;
      events.push(...applied.events);
    } else {
      events.push({ type: 'effectiveness', multiplier: 0 });
    }
  }
  if (effects.flinch) {
    const victim = side === 'player' ? nextState.player : nextState.enemy;
    if (victim.currentHp > 0) {
      nextState = updateCombatant(nextState, side, { ...victim, flinching: true });
    }
  }

  return { state: nextState, events };
};

const resolveStatusBeforeMove = (
  state: BattleState,
  user: 'player' | 'enemy',
  random: RandomSource,
): { readonly state: BattleState; readonly events: readonly BattleEvent[]; readonly canAct: boolean } => {
  const combatant = user === 'player' ? state.player : state.enemy;
  const name = combatant.pokemon.base.name;
  const primary = combatant.primaryStatus;

  if (primary === PrimaryStatus.Paralysis && clampRandom(random()) < 0.25) {
    return { state, events: [{ type: 'status-prevented', user, name, status: primary }], canAct: false };
  }
  if (primary === PrimaryStatus.Freeze) {
    if (clampRandom(random()) >= 0.25) {
      return { state, events: [{ type: 'status-prevented', user, name, status: primary }], canAct: false };
    }
    state = updateCombatant(state, user, { ...combatant, primaryStatus: null });
    return { state, events: [{ type: 'status-cured', user, name, status: 'freeze' }], canAct: true };
  }
  if (primary === PrimaryStatus.Sleep) {
    if (combatant.sleepTurns > 0) {
      const asleep = { ...combatant, sleepTurns: combatant.sleepTurns - 1 };
      return {
        state: updateCombatant(state, user, asleep),
        events: [{ type: 'status-prevented', user, name, status: primary }],
        canAct: false,
      };
    }
    state = updateCombatant(state, user, { ...combatant, primaryStatus: null });
    return { state, events: [{ type: 'status-cured', user, name, status: 'sleep' }], canAct: true };
  }
  if (combatant.confusionTurns > 0) {
    const confused = { ...combatant, confusionTurns: combatant.confusionTurns - 1 };
    state = updateCombatant(state, user, confused);
    const events: BattleEvent[] = [];
    if (clampRandom(random()) >= 0.5) {
      const damage = Math.floor(combatant.pokemon.maxHp / 8);
      const hurt = { ...confused, currentHp: Math.max(0, confused.currentHp - damage) };
      state = updateCombatant(state, user, hurt);
      events.push({ type: 'confusion-self-hit', user, name, damage });
      if (hurt.currentHp === 0) {
        state = resolveFaint(state, user);
        events.push({ type: 'fainted', user, name });
        if (user === 'enemy' && state.outcome === 'active') {
          events.push({ type: 'enemy-sent-out', name: state.enemy.pokemon.base.name });
        }
      }
      if (confused.confusionTurns === 0) {
        state = updateCombatant(state, user, { ...hurt, confusionTurns: 0 });
        events.push({ type: 'status-cured', user, name, status: 'confusion' });
      }
      return { state, events, canAct: false };
    }
    if (confused.confusionTurns === 0) {
      events.push({ type: 'status-cured', user, name, status: 'confusion' });
    }
    return { state, events, canAct: true };
  }
  return { state, events: [], canAct: true };
};

/**
 * The end of one combatant's turn: what its status costs it, then what its gear
 * gives back.
 *
 * Leftovers is charged at exactly the point burn and poison are charged, which is
 * what makes it read as their mirror - and it is charged after them, so a burned
 * holder sees the burn take four and the food give one back rather than a single
 * net number that explains neither.
 */
const applyEndOfAction = (
  state: BattleState,
  user: 'player' | 'enemy',
  events: readonly BattleEvent[],
): TurnResult => {
  let nextState = state;
  const nextEvents: BattleEvent[] = [...events];
  const combatant = user === 'player' ? state.player : state.enemy;
  if (state.outcome !== 'active' || combatant.currentHp === 0) {
    return { state, events };
  }
  const divisor =
    combatant.primaryStatus === PrimaryStatus.Poison
      ? 8
      : combatant.primaryStatus === PrimaryStatus.Burn
        ? 16
        : 0;
  if (divisor > 0) {
    const damage = Math.floor(combatant.pokemon.maxHp / divisor);
    const updated = { ...combatant, currentHp: Math.max(0, combatant.currentHp - damage) };
    nextState = updateCombatant(nextState, user, updated);
    nextEvents.push({
      type: 'status-damage',
      user,
      name: combatant.pokemon.base.name,
      status: combatant.primaryStatus!,
      damage,
    });
    if (updated.currentHp === 0) {
      nextState = resolveFaint(nextState, user);
      nextEvents.push({ type: 'fainted', user, name: combatant.pokemon.base.name });
      if (user === 'enemy' && nextState.outcome === 'active') {
        nextEvents.push({ type: 'enemy-sent-out', name: nextState.enemy.pokemon.base.name });
      }
      return { state: nextState, events: nextEvents };
    }
  }

  const standing = user === 'player' ? nextState.player : nextState.enemy;
  const healed = endOfTurnHeal(standing.pokemon, standing.currentHp);
  if (healed > 0) {
    nextState = updateCombatant(nextState, user, {
      ...standing,
      currentHp: standing.currentHp + healed,
    });
    nextEvents.push({
      type: 'gear-heal',
      user,
      name: standing.pokemon.base.name,
      item: gearLabel(standing.pokemon.heldItemId),
      amount: healed,
    });
  }
  return { state: nextState, events: nextEvents };
};

const applyStatus = (
  state: BattleState,
  user: 'player' | 'enemy',
  status: StatusName,
  random: RandomSource,
): TurnResult => {
  const combatant = user === 'player' ? state.player : state.enemy;
  const name = combatant.pokemon.base.name;
  if (status === 'confusion') {
    if (combatant.confusionTurns > 0) {
      return { state, events: [{ type: 'status-already', user, name, status }] };
    }
    const updated = { ...combatant, confusionTurns: randomTurnCount(random, 4) };
    return { state: updateCombatant(state, user, updated), events: [{ type: 'status-applied', user, name, status }] };
  }
  if (combatant.primaryStatus) {
    return { state, events: [{ type: 'status-already', user, name, status }] };
  }
  const updated = {
    ...combatant,
    primaryStatus: status,
    sleepTurns: status === PrimaryStatus.Sleep ? randomTurnCount(random, 3) : 0,
  };
  return { state: updateCombatant(state, user, updated), events: [{ type: 'status-applied', user, name, status }] };
};

const updateCombatant = (state: BattleState, user: 'player' | 'enemy', combatant: BattleCombatant): BattleState =>
  user === 'player'
    ? { ...state, player: combatant, playerStatStages: new Map(state.playerStatStages).set(combatant.pokemon, combatant.statStages) }
    : { ...state, enemy: combatant };

const resolveFaint = (state: BattleState, faintedUser: 'player' | 'enemy'): BattleState => {
  if (faintedUser !== 'enemy' || !state.trainer) {
    return { ...state, outcome: faintedUser === 'enemy' ? 'victory' : 'defeat' };
  }

  const nextPartyIndex = state.enemyPartyIndex + 1;
  const nextPokemon = state.trainer.party[nextPartyIndex];
  if (!nextPokemon) {
    return { ...state, outcome: 'victory' };
  }

  return {
    ...state,
    enemy: toCombatant(nextPokemon),
    enemyPartyIndex: nextPartyIndex,
    outcome: 'active',
  };
};

const randomTurnCount = (random: RandomSource, maximum: number): number =>
  Math.floor(clampRandom(random()) * maximum) + 1;

// The name-matching status table that used to live here is gone. A move now
// declares what it inflicts on itself (`MoveEffects.status`), so a new status
// move is a data row rather than an edit to this file, and a renamed move can
// no longer lose its effect silently.

const applyStatBoosts = (
  state: BattleState,
  user: 'player' | 'enemy',
  boosts: readonly StatBoost[],
): { readonly state: BattleState; readonly events: readonly BattleEvent[] } => {
  let nextState = state;
  const events: BattleEvent[] = [];
  for (const boost of boosts) {
    const combatant = user === 'player' ? nextState.player : nextState.enemy;
    const updatedStages = applyStatBoost(combatant.statStages, boost);
    const change = updatedStages[boost.stat] - combatant.statStages[boost.stat];
    if (change === 0) {
      continue;
    }
    nextState = updateCombatant(nextState, user, { ...combatant, statStages: updatedStages });
    events.push({
      type: 'stat-stage-changed',
      user,
      name: combatant.pokemon.base.name,
      stat: boost.stat,
      stages: change,
    });
  }
  return { state: nextState, events };
};

const effectivenessEvents = (multiplier: number): BattleEvent[] => {
  if (multiplier === 0) {
    return [{ type: 'effectiveness', multiplier }];
  }
  if (multiplier > 1 || multiplier < 1) {
    return [{ type: 'effectiveness', multiplier }];
  }
  return [];
};

const clampRandom = (value: number): number => Math.min(0.999999, Math.max(0, value));

export const getCombatantTypes = (combatant: BattleCombatant): readonly PokemonType[] => [
  combatant.pokemon.base.primaryType,
  ...(combatant.pokemon.base.secondaryType ? [combatant.pokemon.base.secondaryType] : []),
];

export const isDamagingMove = (move: BattleMove): boolean =>
  move.base.category !== MoveCategory.Status && move.base.power > 0;
