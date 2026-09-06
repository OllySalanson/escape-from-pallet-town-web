import type { MoveBase } from '../MoveBase';
import { MoveCategory } from '../MoveBase';
import type { Pokemon } from '../Pokemon';
import type { PokemonType } from '../PokemonType';
import { calculateDamage, type RandomSource } from './damage';

export interface BattleMove {
  readonly base: MoveBase;
  readonly pp: number;
}

export interface BattleCombatant {
  readonly pokemon: Pokemon;
  readonly currentHp: number;
  readonly moves: readonly BattleMove[];
}

export interface BattleState {
  readonly player: BattleCombatant;
  readonly enemy: BattleCombatant;
  readonly outcome: 'active' | 'victory' | 'defeat';
}

export type BattleEvent =
  | { readonly type: 'used-move'; readonly user: 'player' | 'enemy'; readonly name: string; readonly move: string }
  | { readonly type: 'missed'; readonly user: 'player' | 'enemy' }
  | { readonly type: 'critical-hit' }
  | { readonly type: 'effectiveness'; readonly multiplier: number }
  | { readonly type: 'fainted'; readonly user: 'player' | 'enemy'; readonly name: string }
  | { readonly type: 'no-pp'; readonly user: 'player' | 'enemy'; readonly move: string };

export interface TurnResult {
  readonly state: BattleState;
  readonly events: readonly BattleEvent[];
}

const toCombatant = (pokemon: Pokemon): BattleCombatant => ({
  pokemon,
  currentHp: pokemon.currentHp,
  moves: pokemon.moves.map((move) => ({ base: move.base, pp: move.pp })),
});

export const createBattleState = (player: Pokemon, enemy: Pokemon): BattleState => ({
  player: toCombatant(player),
  enemy: toCombatant(enemy),
  outcome: player.isFainted ? 'defeat' : enemy.isFainted ? 'victory' : 'active',
});

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
    { user: 'player' as const, moveIndex: playerMoveIndex, speed: state.player.pokemon.stats.speed },
    ...(enemyMoveIndex === null
      ? []
      : [{ user: 'enemy' as const, moveIndex: enemyMoveIndex, speed: state.enemy.pokemon.stats.speed }]),
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

const applyMove = (
  state: BattleState,
  user: 'player' | 'enemy',
  moveIndex: number,
  random: RandomSource,
): TurnResult => {
  const attacker = user === 'player' ? state.player : state.enemy;
  const defender = user === 'player' ? state.enemy : state.player;
  const move = attacker.moves[moveIndex];
  if (!move || move.pp <= 0) {
    return { state, events: move ? [{ type: 'no-pp', user, move: move.base.name }] : [] };
  }

  const updatedAttacker = {
    ...attacker,
    moves: attacker.moves.map((knownMove, index) =>
      index === moveIndex ? { ...knownMove, pp: knownMove.pp - 1 } : knownMove,
    ),
  };
  const eventPrefix: BattleEvent[] = [
    { type: 'used-move', user, name: attacker.pokemon.base.name, move: move.base.name },
  ];

  if (clampRandom(random()) * 100 >= move.base.accuracy) {
    return {
      state: withCombatants(state, user, updatedAttacker, defender),
      events: [...eventPrefix, { type: 'missed', user }],
    };
  }

  const damage = calculateDamage(attacker.pokemon, defender.pokemon, move.base, random);
  const updatedDefender = {
    ...defender,
    currentHp: Math.max(0, defender.currentHp - damage.damage),
  };
  let nextState = withCombatants(state, user, updatedAttacker, updatedDefender);
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
    events.push({ type: 'fainted', user: defenderUser, name: defender.pokemon.base.name });
  }

  return { state: nextState, events };
};

const withCombatants = (
  state: BattleState,
  attackerUser: 'player' | 'enemy',
  attacker: BattleCombatant,
  defender: BattleCombatant,
): BattleState =>
  attackerUser === 'player'
    ? { ...state, player: attacker, enemy: defender }
    : { ...state, player: defender, enemy: attacker };

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
