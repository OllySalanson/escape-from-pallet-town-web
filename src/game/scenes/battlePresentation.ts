import type { BattleEvent } from '../pokemon/battle/battleEngine';

export const BATTLE_SCREEN_WIDTH = 320;
export const MOVE_COLUMN_WIDTH = 148;
export const MOVE_COMMAND_ROWS = 2;
export const MOVE_COMMAND_HEIGHT = 64;

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
  readonly base: { readonly name: string; readonly type: string; readonly pp: number };
  readonly pp: number;
}): string => `${move.base.name.toUpperCase()}\n${move.base.type.toUpperCase()} ${move.pp}/${move.base.pp}`;

export const moveCommandLayout = (index: number): MoveCommandLayout => {
  const column = index % 2;
  const row = Math.floor(index / 2);
  return {
    x: 18 + column * MOVE_COLUMN_WIDTH,
    y: 3 + row * 30,
    width: MOVE_COLUMN_WIDTH - 12,
    height: 28,
  };
};

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
