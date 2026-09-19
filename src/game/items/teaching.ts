import { canLearnFromMachine, MACHINES, type MachineDefinition } from '../pokemon/machines';
import type { MoveBase, Pokemon } from '../pokemon';
import { getItemById, type ItemDefinition } from './items';

/**
 * Reading a TM or an HM to a Pokemon.
 *
 * This is the whole of the rule, Phaser-free, so what a disc refuses and what
 * it costs are testable without a screen. It is not part of `useFieldItem`
 * because teaching has an outcome no return value can carry: a Pokemon that
 * already knows four moves has to be *asked* which to give up, and the asking
 * is the move chooser from PR #118 - `openMoveChooser`, the same screen a
 * level-up opens, written against a Pokemon and a move for exactly this reason.
 *
 * So the caller gets one of three answers, and only the third involves a
 * screen. Two of them are already finished by the time they are handed back.
 *
 * **What is spent, and when.** A machine is used up by a move actually being
 * learned, and never by anything else: a refusal spends nothing, and a player
 * who opens the chooser and decides to keep all four moves still has the disc.
 * An HM (`MachineDefinition.reusable`) is never spent at all - one flag, as the
 * tutorial has it, rather than a second kind of item.
 */
export type TeachOutcome =
  /** Nothing happened and nothing was spent: the line says why. */
  | { readonly kind: 'refused'; readonly message: string; readonly machineIsSpent: false }
  /** Learned into a free slot. `machineIsSpent` is false for an HM. */
  | {
      readonly kind: 'learned';
      readonly move: MoveBase;
      readonly message: string;
      readonly machineIsSpent: boolean;
    }
  /**
   * Four moves already known. The move is queued on `Pokemon.pendingMoves`, so
   * the caller opens the chooser and settles it with `resolvePendingMove` -
   * exactly as a level-up does. Nothing is spent until that choice forgets one.
   */
  | { readonly kind: 'choose'; readonly move: MoveBase; readonly machine: MachineDefinition };

/** The machine an item is, or undefined for anything that is not a disc. */
export function machineForItem(item: ItemDefinition): MachineDefinition | undefined {
  return item.effect.type === 'machine' ? MACHINES[item.id] : undefined;
}

/** The machine an item id is, for a caller holding an id rather than a row. */
export function machineForItemId(itemId: string): MachineDefinition | undefined {
  const item = getItemById(itemId);
  return item ? machineForItem(item) : undefined;
}

/**
 * Whether reading this disc to this Pokemon would do anything at all. The bag
 * asks it to grey a row out before the player commits to a target, so the
 * refusal is on screen rather than behind a keypress.
 */
export function canBeTaught(item: ItemDefinition, pokemon: Pokemon): boolean {
  const machine = machineForItem(item);
  return (
    machine !== undefined &&
    canLearnFromMachine(pokemon.base.id, machine.move) &&
    !pokemon.moves.some((known) => known.base === machine.move)
  );
}

/**
 * Reads the disc. Mutates the Pokemon in the two cases that finish here, and
 * queues the move in the one that does not.
 */
export function teachFromMachine(item: ItemDefinition, pokemon: Pokemon): TeachOutcome {
  const machine = machineForItem(item);
  if (!machine) {
    return { kind: 'refused', machineIsSpent: false, message: `${item.displayName} is not a machine.` };
  }
  const name = pokemon.base.name.toUpperCase();
  const moveName = machine.move.name.toUpperCase();

  if (pokemon.moves.some((known) => known.base === machine.move)) {
    return { kind: 'refused', machineIsSpent: false, message: `${name} already knows ${moveName}.` };
  }
  // The check the whole item exists for, and it is canon's answer rather than a
  // designer's: `machines.ts` carries FireRed/LeafGreen's own compatibility
  // list, read out of a committed snapshot.
  if (!canLearnFromMachine(pokemon.base.id, machine.move)) {
    return { kind: 'refused', machineIsSpent: false, message: `${name} cannot learn ${moveName}.` };
  }

  if (pokemon.hasFreeMoveSlot) {
    pokemon.learnMove(machine.move);
    return {
      kind: 'learned',
      move: machine.move,
      message: `${name} learned ${moveName}!`,
      machineIsSpent: !machine.reusable,
    };
  }

  if (!pokemon.pendingMoves.includes(machine.move)) {
    pokemon.pendingMoves.push(machine.move);
  }
  return { kind: 'choose', move: machine.move, machine };
}
