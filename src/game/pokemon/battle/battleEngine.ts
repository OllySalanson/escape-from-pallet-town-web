import type { MoveBase } from '../MoveBase';
import { MoveCategory } from '../MoveBase';
import type { Pokemon } from '../Pokemon';
import type { PokemonType } from '../PokemonType';
import { calculateDamage, type RandomSource } from './damage';
import { PrimaryStatus, type PrimaryStatus as PrimaryStatusType } from './status';
import {
  applyStatBoost,
  createStatStages,
  getStagedStat,
  type BattleStat,
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
}

export interface BattleState {
  readonly player: BattleCombatant;
  readonly enemy: BattleCombatant;
  readonly playerStatStages: ReadonlyMap<Pokemon, StatStages>;
  readonly outcome: 'active' | 'victory' | 'defeat';
}

export type BattleEvent =
  | { readonly type: 'used-move'; readonly user: 'player' | 'enemy'; readonly name: string; readonly move: string }
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
  | { readonly type: 'stat-stage-changed'; readonly user: 'player' | 'enemy'; readonly name: string; readonly stat: BattleStat; readonly stages: number };

export type StatusName = PrimaryStatusType | 'confusion';

export interface TurnResult {
  readonly state: BattleState;
  readonly events: readonly BattleEvent[];
}

const toCombatant = (pokemon: Pokemon): BattleCombatant => ({
  pokemon,
  currentHp: pokemon.currentHp,
  moves: pokemon.moves.map((move) => ({ base: move.base, pp: move.pp })),
  primaryStatus: pokemon.primaryStatus,
  sleepTurns: 0,
  confusionTurns: 0,
  statStages: createStatStages(),
});

export const createBattleState = (player: Pokemon, enemy: Pokemon): BattleState => {
  const playerCombatant = toCombatant(player);
  return {
    player: playerCombatant,
    enemy: toCombatant(enemy),
    playerStatStages: new Map([[player, playerCombatant.statStages]]),
    outcome: player.isFainted ? 'defeat' : enemy.isFainted ? 'victory' : 'active',
  };
};

export const chooseEnemyMove = (combatant: BattleCombatant, random: RandomSource): number | null => {
  const usableMoves = combatant.moves
    .map((move, index) => ({ move, index }))
    .filter(({ move }) => move.pp > 0);
  if (usableMoves.length === 0) {
    return null;
  }

  return usableMoves[Math.floor(clampRandom(random()) * usableMoves.length)]?.index ?? null;
};

export const resolveTurn = (
  state: BattleState,
  playerMoveIndex: number,
  random: RandomSource,
): TurnResult => {
  if (state.outcome !== 'active') {
    return { state, events: [] };
  }

  const playerMove = state.player.moves[playerMoveIndex];
  if (!playerMove || playerMove.pp <= 0) {
    return {
      state,
      events: playerMove
        ? [{ type: 'no-pp', user: 'player', move: playerMove.base.name }]
        : [],
    };
  }

  const enemyMoveIndex = chooseEnemyMove(state.enemy, random);
  const actions = [
    { user: 'player' as const, moveIndex: playerMoveIndex, speed: getStagedStat(state.player.pokemon.stats.speed, state.player.statStages.speed) },
    ...(enemyMoveIndex === null
      ? []
      : [{ user: 'enemy' as const, moveIndex: enemyMoveIndex, speed: getStagedStat(state.enemy.pokemon.stats.speed, state.enemy.statStages.speed) }]),
  ].sort((left, right) => right.speed - left.speed || (left.user === 'player' ? -1 : 1));

  let nextState = state;
  const events: BattleEvent[] = [];
  for (const action of actions) {
    if (nextState.outcome !== 'active') {
      break;
    }
    const result = applyMove(nextState, action.user, action.moveIndex, random);
    nextState = result.state;
    events.push(...result.events);
  }

  return { state: nextState, events };
};

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

export const resolveEnemyTurn = (state: BattleState, random: RandomSource): TurnResult => {
  if (state.outcome !== 'active') {
    return { state, events: [] };
  }

  const enemyMoveIndex = chooseEnemyMove(state.enemy, random);
  return enemyMoveIndex === null ? { state, events: [] } : applyMove(state, 'enemy', enemyMoveIndex, random);
};

const applyMove = (
  state: BattleState,
  user: 'player' | 'enemy',
  moveIndex: number,
  random: RandomSource,
): TurnResult => {
  const attacker = user === 'player' ? state.player : state.enemy;
  const move = attacker.moves[moveIndex];
  if (!move || move.pp <= 0) {
    return { state, events: move ? [{ type: 'no-pp', user, move: move.base.name }] : [] };
  }

  const attempted = resolveStatusBeforeMove(state, user, random);
  if (!attempted.canAct) {
    return applyEndOfAction(attempted.state, user, attempted.events);
  }

  let statusState = attempted.state;
  const attackerAfterStatus = user === 'player' ? statusState.player : statusState.enemy;
  const defenderAfterStatus = user === 'player' ? statusState.enemy : statusState.player;
  const updatedAttacker = {
    ...attackerAfterStatus,
    moves: attackerAfterStatus.moves.map((knownMove, index) =>
      index === moveIndex ? { ...knownMove, pp: knownMove.pp - 1 } : knownMove,
    ),
  };
  const eventPrefix: BattleEvent[] = [
    ...attempted.events,
    { type: 'used-move', user, name: attackerAfterStatus.pokemon.base.name, move: move.base.name },
  ];

  if (clampRandom(random()) * 100 >= move.base.accuracy) {
    statusState = withCombatants(statusState, user, updatedAttacker, defenderAfterStatus);
    return applyEndOfAction(statusState, user, [...eventPrefix, { type: 'missed', user }]);
  }

  const damage = calculateDamage(
    attackerAfterStatus.pokemon,
    defenderAfterStatus.pokemon,
    move.base,
    random,
    attackerAfterStatus.statStages,
    defenderAfterStatus.statStages,
  );
  const updatedDefender = {
    ...defenderAfterStatus,
    currentHp: Math.max(0, defenderAfterStatus.currentHp - damage.damage),
  };
  let nextState = withCombatants(statusState, user, updatedAttacker, updatedDefender);
  const events: BattleEvent[] = [
    ...eventPrefix,
    ...(damage.isCritical ? [{ type: 'critical-hit' } as const] : []),
    ...effectivenessEvents(damage.typeEffectiveness),
  ];

  if (updatedDefender.currentHp === 0) {
    const defenderUser = user === 'player' ? 'enemy' : 'player';
    nextState = {
      ...nextState,
      outcome: defenderUser === 'enemy' ? 'victory' : 'defeat',
    };
    events.push({ type: 'fainted', user: defenderUser, name: defenderAfterStatus.pokemon.base.name });
  }

  const status = statusEffectForMove(move.base.name);
  if (status && nextState.outcome === 'active') {
    const applied = applyStatus(nextState, user === 'player' ? 'enemy' : 'player', status, random);
    nextState = applied.state;
    events.push(...applied.events);
  }
  if (move.base.boosts.length > 0 && nextState.outcome === 'active') {
    const boosted = applyStatBoosts(nextState, user === 'player' ? 'enemy' : 'player', move.base.boosts);
    nextState = boosted.state;
    events.push(...boosted.events);
  }

  return applyEndOfAction(nextState, user, events);
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
        state = { ...state, outcome: user === 'player' ? 'defeat' : 'victory' };
        events.push({ type: 'fainted', user, name });
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

const applyEndOfAction = (
  state: BattleState,
  user: 'player' | 'enemy',
  events: readonly BattleEvent[],
): TurnResult => {
  const combatant = user === 'player' ? state.player : state.enemy;
  if (state.outcome !== 'active' || !combatant.primaryStatus || combatant.currentHp === 0) {
    return { state, events };
  }
  const divisor = combatant.primaryStatus === PrimaryStatus.Poison ? 8 : combatant.primaryStatus === PrimaryStatus.Burn ? 16 : 0;
  if (divisor === 0) {
    return { state, events };
  }
  const damage = Math.floor(combatant.pokemon.maxHp / divisor);
  const updated = { ...combatant, currentHp: Math.max(0, combatant.currentHp - damage) };
  let nextState = updateCombatant(state, user, updated);
  const nextEvents: BattleEvent[] = [
    ...events,
    { type: 'status-damage', user, name: combatant.pokemon.base.name, status: combatant.primaryStatus, damage },
  ];
  if (updated.currentHp === 0) {
    nextState = { ...nextState, outcome: user === 'player' ? 'defeat' : 'victory' };
    nextEvents.push({ type: 'fainted', user, name: combatant.pokemon.base.name });
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

const randomTurnCount = (random: RandomSource, maximum: number): number =>
  Math.floor(clampRandom(random()) * maximum) + 1;

const statusEffects: Readonly<Record<string, StatusName>> = {
  'Poision Powder': PrimaryStatus.Poison,
  'Poison Powder': PrimaryStatus.Poison,
  Sing: PrimaryStatus.Sleep,
  'Thunder Wave': PrimaryStatus.Paralysis,
  'Super Sonic': 'confusion',
};

const statusEffectForMove = (name: string): StatusName | null => statusEffects[name] ?? null;

const withCombatants = (
  state: BattleState,
  attackerUser: 'player' | 'enemy',
  attacker: BattleCombatant,
  defender: BattleCombatant,
): BattleState =>
  attackerUser === 'player'
    ? {
        ...state,
        player: attacker,
        enemy: defender,
        playerStatStages: new Map(state.playerStatStages).set(attacker.pokemon, attacker.statStages),
      }
    : {
        ...state,
        player: defender,
        enemy: attacker,
        playerStatStages: new Map(state.playerStatStages).set(defender.pokemon, defender.statStages),
      };

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
