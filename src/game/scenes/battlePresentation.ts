import type { BattleEvent } from '../pokemon/battle/battleEngine';
import { MoveCategory, type MoveBase } from '../pokemon/MoveBase';
import type { PokemonType } from '../pokemon/PokemonType';
import { getTypeEffectiveness } from '../pokemon/battle/typeChart';
import { STAB_MULTIPLIER } from '../pokemon/battle/damage';

export const BATTLE_SCREEN_WIDTH = 320;
export const MOVE_COLUMN_WIDTH = 148;
export const MOVE_COMMAND_ROWS = 2;
export const MOVE_COMMAND_HEIGHT = 64;
/** Move rows are single-line so the two guidance lines share the same panel. */
export const MOVE_GUIDANCE_ROWS = 2;

export interface MoveCommandLayout {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CombatPresentationStep {
  readonly event: BattleEvent;
  readonly actor: 'player' | 'enemy' | null;
  readonly target: 'player' | 'enemy' | null;
  readonly hpDelta: number;
}

export const formatMoveCommand = (move: {
  readonly base: { readonly name: string };
  readonly pp: number;
}): string => (move.pp > 0 ? move.base.name.toUpperCase() : `${move.base.name.toUpperCase()} --`);

export const moveCommandLayout = (index: number): MoveCommandLayout => {
  const column = index % 2;
  const row = Math.floor(index / 2);
  return {
    x: 18 + column * MOVE_COLUMN_WIDTH,
    y: 2 + row * 17,
    width: MOVE_COLUMN_WIDTH - 12,
    height: 16,
  };
};

/** The guidance lines sit under the two move rows, inside the same panel. */
export const moveGuidanceLayout = (line: number): MoveCommandLayout => ({
  x: 18,
  y: 37 + line * 12,
  width: BATTLE_SCREEN_WIDTH - 36,
  height: 11,
});

export type MatchupTone = 'good' | 'bad' | 'neutral' | 'none';

export interface MoveGuidance {
  /** Type, category, power and PP: what the move is. */
  readonly summary: string;
  /** How the move lands on the Pokemon currently facing the player. */
  readonly matchup: string;
  readonly tone: MatchupTone;
  readonly effectiveness: number;
}

export const formatMultiplier = (multiplier: number): string =>
  `x${Number.isInteger(multiplier) ? multiplier : multiplier.toFixed(2).replace(/0+$/, '')}`;

export const effectivenessLabel = (multiplier: number): string => {
  if (multiplier === 0) {
    return 'NO EFFECT';
  }
  if (multiplier > 1) {
    return 'SUPER EFFECTIVE';
  }
  return multiplier < 1 ? 'RESISTED' : 'NORMAL DAMAGE';
};

export const matchupTone = (multiplier: number): MatchupTone => {
  if (multiplier === 0) {
    return 'none';
  }
  return multiplier > 1 ? 'good' : multiplier < 1 ? 'bad' : 'neutral';
};

export const formatTypeList = (types: readonly PokemonType[]): string =>
  types.map((type) => type.toUpperCase()).join('/');

/**
 * Everything the player needs before committing to a move: what it does, and
 * how it lands on the Pokemon in front of them. Derived rather than authored so
 * the panel can never drift from `calculateDamage`.
 */
export const describeMoveGuidance = (
  move: { readonly base: MoveBase; readonly pp: number },
  attackerTypes: readonly PokemonType[],
  defender: { readonly name: string; readonly types: readonly PokemonType[] },
): MoveGuidance => {
  const isStab = attackerTypes.includes(move.base.type);
  const stabSuffix = isStab ? ` · SAME-TYPE ${formatMultiplier(STAB_MULTIPLIER)}` : '';
  const pp = `PP ${move.pp}/${move.base.pp}`;

  if (move.base.category === MoveCategory.Status || move.base.power <= 0) {
    return {
      summary: `${move.base.type.toUpperCase()} · STATUS · ${pp}`,
      matchup: move.base.description || 'No direct damage.',
      tone: 'neutral',
      effectiveness: 1,
    };
  }

  const effectiveness = getTypeEffectiveness(move.base.type, defender.types);
  return {
    summary: `${move.base.type.toUpperCase()} · ${move.base.category.toUpperCase()} · POWER ${move.base.power} · ${pp}${stabSuffix}`,
    matchup: `vs ${defender.name.toUpperCase()}: ${effectivenessLabel(effectiveness)} ${formatMultiplier(effectiveness)}`,
    tone: matchupTone(effectiveness),
    effectiveness,
  };
};

/**
 * The ITEM command carries what the player packed, the way BALL carries the
 * balls: the count is on the command, so the loadout decision is legible from
 * inside the fight it was made for rather than only from the bag screen.
 */
export const formatItemCommand = (count: number): string => `ITEM x${count}`;

/** One medicine row in the item submenu, counted the way the pocket counts it. */
export const formatItemRow = (
  item: { readonly displayName: string },
  count: number,
): string => `${item.displayName.toUpperCase()} x${count}`;

/** The party screen's heading while it is choosing who to give an item to. */
export const itemTargetPrompt = (item: { readonly displayName: string }): string =>
  `Use ${item.displayName.toUpperCase()} on which POKéMON?`;

/**
 * What the highlighted medicine would do, on the same line the move submenu
 * puts a move's numbers - and it ends with the turn, because that is the price
 * and it has to be read before the item is spent, not after.
 */
export const describeItemGuidance = (item: { readonly description: string }): string =>
  `${item.description} Using it costs your turn.`;

/** Said when the ITEM command is chosen with nothing in the medicine pocket. */
export const NO_BATTLE_ITEMS_MESSAGE = 'No medicine in your pack!';

/** Whole seconds, so a cost printed on a command reads the same as the raid timer. */
export const formatSeconds = (ms: number): string => `${Math.round(ms / 1_000)}s`;

/**
 * Escape commands state their price before the player commits. The hunter's escape
 * costs raid time and always works; a wild escape is a roll, so it shows its odds.
 */
export const formatHunterFleeCommand = (penaltyMs: number): string =>
  `FLEE -${formatSeconds(penaltyMs)}`;

export const formatWildEscapeCommand = (chance: number): string =>
  `RUN ${Math.round(chance * 100)}%`;

/** What the player is told after breaking contact, so the cost is never silent. */
export const hunterFleeMessages = (penaltyMs: number, searchMs: number): readonly string[] => [
  'You broke away from the RIVAL HUNTER!',
  `It lost your trail and holds off for ${formatSeconds(searchMs)}.`,
  `Breaking contact cost ${formatSeconds(penaltyMs)} of raid time.`,
];

export const WILD_ESCAPE_SUCCESS_MESSAGE = 'Got away safely!';

export const wildEscapeFailureMessage = (enemyName: string): string =>
  `Couldn't get away from ${enemyName.toUpperCase()}!`;

export const combatPresentationSteps = (
  events: readonly BattleEvent[],
): readonly CombatPresentationStep[] =>
  events.map((event) => {
    if (event.type === 'used-move') {
      return {
        event,
        actor: event.user,
        target: event.target ?? null,
        hpDelta: event.damage ?? 0,
      };
    }
    if (event.type === 'confusion-self-hit' || event.type === 'status-damage') {
      return { event, actor: event.user, target: event.user, hpDelta: event.damage };
    }
    return { event, actor: null, target: null, hpDelta: 0 };
  });

export const combatantLabel = (user: 'player' | 'enemy'): string =>
  user === 'player' ? 'Your' : 'Foe';

/** The HUD banner names the side and its typing, so incoming damage is readable. */
export const combatantBanner = (
  role: 'WILD' | 'RIVAL' | 'YOUR POKéMON',
  types: readonly PokemonType[],
): string => `${role}  ${formatTypeList(types)}`;

/**
 * One line of battle log per event. Damaging hits carry the HP they took, so a
 * defeat can be read back from the log without replaying the HP bar.
 */
export const eventToMessage = (event: BattleEvent): string => {
  switch (event.type) {
    case 'used-move': {
      // The HP figure is the whole point: a loss has to be explicable from the
      // log alone, not inferred from a bar that has already finished animating.
      // The same-type bonus is named because it is otherwise the largest
      // invisible term in the damage calculation.
      const opening = `${combatantLabel(event.user)} ${event.name.toUpperCase()} used ${event.move.toUpperCase()}!`;
      if (!event.damage) {
        return opening;
      }
      const stab = event.isStab ? ` · SAME-TYPE ${formatMultiplier(STAB_MULTIPLIER)}` : '';
      return `${opening} -${event.damage} HP${stab}`;
    }
    case 'missed':
      return 'The attack missed!';
    case 'critical-hit':
      return 'A critical hit!';
    case 'effectiveness':
      if (event.multiplier === 0) {
        return 'It does not affect the target...';
      }
      return event.multiplier > 1 ? "It's super effective!" : "It's not very effective...";
    case 'fainted':
      return `${event.name} fainted!`;
    case 'no-pp':
      return `No PP left for ${event.move}!`;
    case 'status-applied':
      return `${event.name} is ${statusLabel(event.status)}!`;
    case 'status-already':
      return `${event.name} already has a status condition!`;
    case 'status-prevented':
      return `${event.name} is ${statusLabel(event.status)} and can't move!`;
    case 'status-damage':
      return `${event.name} is hurt by ${statusLabel(event.status)}!`;
    case 'status-cured':
      return event.status === 'sleep'
        ? `${event.name} woke up!`
        : event.status === 'freeze'
          ? `${event.name} thawed out!`
          : `${event.name} snapped out of confusion!`;
    case 'confusion-self-hit':
      return `${combatantLabel(event.user)} ${event.name.toUpperCase()} hurt itself in confusion!`;
    case 'stat-stage-changed':
      return `${event.name}'s ${statLabel(event.stat)} ${event.stages > 0 ? 'rose' : 'fell'}!`;
    case 'ball-thrown':
      return `Threw a POKé BALL at ${event.name.toUpperCase()}!`;
    case 'catch-shake':
      return `${event.count}...`;
    case 'caught':
      return `Gotcha! ${event.name.toUpperCase()} was caught!`;
    case 'broke-free':
      return `${event.name.toUpperCase()} broke free!`;
    case 'catch-disabled':
      return "You can't catch a trainer's POKéMON!";
    case 'enemy-sent-out':
      return `Go, ${event.name.toUpperCase()}!`;
  }
};

const statusLabel = (status: string): string =>
  ({
    poison: 'poison',
    burn: 'a burn',
    paralysis: 'paralysis',
    sleep: 'asleep',
    freeze: 'frozen',
    confusion: 'confused',
  })[status] ?? status;

const statLabel = (stat: string): string =>
  ({
    attack: 'Attack',
    defense: 'Defense',
    spAttack: 'Sp. Attack',
    spDefense: 'Sp. Defense',
    speed: 'Speed',
  })[stat] ?? stat;
