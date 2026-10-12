import type { GridPosition } from '../movement/gridMovement';
import {
  boxContents,
  inLayerOrder,
  layerBelow,
  pieceAt,
  pieceTiles,
  placedPiece,
  placementRefusal,
  samePlacement,
  type BoxEntry,
  type FloorPlan,
  type HomeRoomId,
  type PlacedPiece,
  type Placement,
  refusalLine,
  type Refusal,
} from './arrangement';

/**
 * Decorating THE BOLTHOLE, as a state and the keys that change it - Phaser-free,
 * so every rule a player can meet is a test (`decorating.test.ts`) and the scene
 * only draws what this says (`base/decorateView.ts`).
 *
 * Habbo's whole verb set and nothing more: a cursor on the room's tiles; pick a
 * thing up, carry it, turn it, put it down; take something out of the box or put
 * something back in it. What the player is carrying is never in the room and
 * never in the box - it is in their hands - and nothing is written to the save
 * until it lands (`changed`), so a piece carried when the tab closes is still
 * standing where it stood.
 */

/** Something in the player's hands: which piece, which way round, and where on it they are holding it. */
export interface Held {
  readonly id: string;
  readonly facing: number;
  /** The tile of the piece under the cursor, from its top-left corner. */
  readonly grab: GridPosition;
  /** Where it was picked up from, or null if it came out of the box. */
  readonly from: Placement | null;
}

export interface DecorState {
  readonly room: HomeRoomId;
  readonly cursor: GridPosition;
  /** Everything standing in the whole house, the held piece not among it. */
  readonly layout: readonly Placement[];
  readonly held: Held | null;
  /** Which kind in the box Q and E are on. */
  readonly boxIndex: number;
}

/** What decorating is asked against: the room, what the save owns, and where the player is standing. */
export interface DecorContext {
  readonly plan: FloorPlan;
  readonly owned: ReadonlyMap<string, number>;
  readonly standing: readonly GridPosition[];
}

export type DecorAction =
  | { readonly kind: 'move'; readonly dx: number; readonly dy: number }
  | { readonly kind: 'point'; readonly at: GridPosition }
  | { readonly kind: 'press' }
  | { readonly kind: 'turn' }
  | { readonly kind: 'box'; readonly step: 1 | -1 }
  | { readonly kind: 'put-away' }
  | { readonly kind: 'cancel' };

/** Why something could not be done, beyond where it was put: a thing on top of what was asked for. */
export type DecorRefusal = Refusal | { readonly kind: 'carrying'; readonly what: string } | { readonly kind: 'empty-box' };

/** What the decorating panel says about something that could not be done. */
export function decorRefusalLine(refusal: DecorRefusal): string {
  switch (refusal.kind) {
    case 'carrying':
      return `TAKE THE ${refusal.what} OFF IT FIRST`;
    case 'empty-box':
      return 'THE BOX IS EMPTY';
    default:
      return refusalLine(refusal);
  }
}

export interface DecorResult {
  readonly state: DecorState;
  /** The layout changed and should be written: something landed, turned or went in the box. */
  readonly changed: boolean;
  /** What happened, for the sound and the panel. */
  readonly outcome: 'moved' | 'picked-up' | 'put-down' | 'turned' | 'boxed' | 'took-out' | 'cancelled' | 'refused' | 'nothing';
  readonly refusal?: DecorRefusal;
}

export function startDecorating(room: HomeRoomId, layout: readonly Placement[], cursor: GridPosition): DecorState {
  return { room, cursor: { ...cursor }, layout: [...layout], held: null, boxIndex: 0 };
}

/** The pieces standing in the room being decorated. */
export function roomPieces(state: DecorState): readonly PlacedPiece[] {
  return state.layout
    .filter((placement) => placement.room === state.room)
    .flatMap((placement) => placedPiece(placement) ?? []);
}

/** What is in the box while decorating: what is owned, less what stands and what is carried. */
export function decorBox(state: DecorState, owned: ReadonlyMap<string, number>): readonly BoxEntry[] {
  const out = state.held ? [{ ...heldPlacement(state, state.held) }] : [];
  return boxContents(owned, [...state.layout, ...out]);
}

/** Where the held piece would land: its grabbed tile on the cursor. */
export function heldPlacement(state: DecorState, held: Held): Placement {
  return {
    id: held.id,
    room: state.room,
    x: state.cursor.x - held.grab.x,
    y: state.cursor.y - held.grab.y,
    facing: held.facing,
  };
}

/** Whether the held piece may be put down where it is, and if not, why. */
export function heldRefusal(state: DecorState, context: DecorContext): Refusal | null {
  if (!state.held) {
    return null;
  }
  const candidate = placedPiece(heldPlacement(state, state.held));
  return candidate ? placementRefusal(context.plan, roomPieces(state), candidate, context.standing) : { kind: 'off-floor' };
}

/** The piece under the cursor that a press would pick up: the one on top. */
export function pieceUnderCursor(state: DecorState): PlacedPiece | undefined {
  return pieceAt(roomPieces(state), state.cursor);
}

/**
 * Whether R would turn anything now: the piece in hand, else the one under the
 * cursor, has another way round. A table, a desk, a plant in a tub or a mat
 * has one, so the keys line does not offer to turn it.
 */
export function canTurnNow(state: DecorState): boolean {
  const definition = state.held ? placedPiece(heldPlacement(state, state.held))?.definition : pieceUnderCursor(state)?.definition;
  return (definition?.facings.length ?? 0) > 1;
}

/**
 * What stands on a piece's top, by name: a doll on a desk, a cushion on the
 * table. Taking the desk away from under it is refused rather than leaving the
 * doll in mid-air or moving it without asking.
 */
function standingOn(state: DecorState, piece: PlacedPiece): string | undefined {
  const tops = new Set(
    pieceTiles(piece)
      .filter((tile) => tile.cell === 'T')
      .map((tile) => `${tile.x},${tile.y}`),
  );
  return roomPieces(state).find(
    (other) =>
      !samePlacement(other, piece) &&
      layerBelow(piece.definition, other.definition) &&
      pieceTiles(other).some((tile) => tops.has(`${tile.x},${tile.y}`)),
  )?.definition.name;
}

const without = (layout: readonly Placement[], placement: Placement): readonly Placement[] => {
  const index = layout.findIndex((each) => samePlacement(each, placement));
  return index < 0 ? layout : [...layout.slice(0, index), ...layout.slice(index + 1)];
};

const unchanged = (state: DecorState, outcome: DecorResult['outcome'] = 'nothing', refusal?: DecorRefusal): DecorResult => ({
  state,
  changed: false,
  outcome,
  ...(refusal ? { refusal } : {}),
});

/** Takes the box's chosen kind into the player's hands, held by its bottom middle. */
function takeFromBox(state: DecorState, owned: ReadonlyMap<string, number>, index: number): DecorResult {
  const box = decorBox({ ...state, held: null }, owned);
  if (box.length === 0) {
    return unchanged({ ...state, held: null }, 'refused', { kind: 'empty-box' });
  }
  const boxIndex = ((index % box.length) + box.length) % box.length;
  const { definition } = box[boxIndex];
  return {
    state: {
      ...state,
      boxIndex,
      held: {
        id: definition.id,
        facing: 0,
        grab: { x: Math.floor((definition.width - 1) / 2), y: definition.height - 1 },
        from: null,
      },
    },
    changed: false,
    outcome: 'took-out',
  };
}

/** One key, one change. */
export function decorate(state: DecorState, action: DecorAction, context: DecorContext): DecorResult {
  switch (action.kind) {
    case 'move':
    case 'point': {
      const target =
        action.kind === 'move' ? { x: state.cursor.x + action.dx, y: state.cursor.y + action.dy } : action.at;
      const cursor = {
        x: Math.max(0, Math.min(context.plan.width - 1, target.x)),
        y: Math.max(0, Math.min(context.plan.height - 1, target.y)),
      };
      if (cursor.x === state.cursor.x && cursor.y === state.cursor.y) {
        return unchanged(state);
      }
      return { state: { ...state, cursor }, changed: false, outcome: 'moved' };
    }
    case 'press': {
      if (state.held) {
        const refusal = heldRefusal(state, context);
        if (refusal) {
          return unchanged(state, 'refused', refusal);
        }
        return {
          state: { ...state, layout: inLayerOrder([...state.layout, heldPlacement(state, state.held)]), held: null },
          changed: true,
          outcome: 'put-down',
        };
      }
      const piece = pieceUnderCursor(state);
      if (!piece) {
        return takeFromBox(state, context.owned, state.boxIndex);
      }
      const carrying = standingOn(state, piece);
      if (carrying) {
        return unchanged(state, 'refused', { kind: 'carrying', what: carrying });
      }
      const placement: Placement = { id: piece.id, room: piece.room, x: piece.x, y: piece.y, facing: piece.facing };
      return {
        state: {
          ...state,
          layout: without(state.layout, placement),
          held: {
            id: piece.id,
            facing: piece.facing,
            grab: { x: state.cursor.x - piece.x, y: state.cursor.y - piece.y },
            from: placement,
          },
        },
        changed: false,
        outcome: 'picked-up',
      };
    }
    case 'turn': {
      if (state.held) {
        const definition = placedPiece(heldPlacement(state, state.held))?.definition;
        if (!definition || definition.facings.length < 2) {
          return unchanged(state);
        }
        return {
          state: { ...state, held: { ...state.held, facing: (state.held.facing + 1) % definition.facings.length } },
          changed: false,
          outcome: 'turned',
        };
      }
      // Turning something where it stands, as Habbo does: only if it still
      // fits turned.
      const piece = pieceUnderCursor(state);
      if (!piece || piece.definition.facings.length < 2) {
        return unchanged(state);
      }
      const placement: Placement = { id: piece.id, room: piece.room, x: piece.x, y: piece.y, facing: piece.facing };
      const rest = without(state.layout, placement);
      const turned: Placement = { ...placement, facing: (piece.facing + 1) % piece.definition.facings.length };
      const candidate = placedPiece(turned);
      const others = roomPieces({ ...state, layout: rest });
      const refusal = candidate ? placementRefusal(context.plan, others, candidate, context.standing) : null;
      if (refusal) {
        return unchanged(state, 'refused', refusal);
      }
      return { state: { ...state, layout: inLayerOrder([...rest, turned]) }, changed: true, outcome: 'turned' };
    }
    case 'box': {
      // Whatever was in hand goes back first - to where it stood, or into the
      // box - and Q and E walk the box from the kind that was last taken out:
      // the first press shows it, every press after that moves on.
      const held = state.held;
      const layout = held?.from ? inLayerOrder([...state.layout, held.from]) : state.layout;
      const index = held && !held.from ? state.boxIndex + action.step : state.boxIndex;
      return takeFromBox({ ...state, layout, held: null }, context.owned, index);
    }
    case 'put-away': {
      if (state.held) {
        // A piece carried from a room is gone from the layout already; one out
        // of the box was never in it. Either way it is in the box now.
        return {
          state: { ...state, held: null },
          changed: state.held.from !== null,
          outcome: 'boxed',
        };
      }
      const piece = pieceUnderCursor(state);
      if (!piece) {
        return unchanged(state);
      }
      const carrying = standingOn(state, piece);
      if (carrying) {
        return unchanged(state, 'refused', { kind: 'carrying', what: carrying });
      }
      return {
        state: { ...state, layout: without(state.layout, piece) },
        changed: true,
        outcome: 'boxed',
      };
    }
    case 'cancel': {
      if (!state.held) {
        return unchanged(state);
      }
      const layout = state.held.from ? inLayerOrder([...state.layout, state.held.from]) : state.layout;
      return { state: { ...state, layout, held: null }, changed: false, outcome: 'cancelled' };
    }
  }
}
