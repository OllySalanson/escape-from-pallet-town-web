import type { GridPosition } from '../movement/gridMovement';
import type { WorldMapId } from '../worldMap';
import { trainersOn } from './mapTrainers';

/** A trainer THE MAP marks: one who has not paid this save, where the player has been. */
export interface PurseMark {
  readonly tile: GridPosition;
  readonly name: string;
}

/**
 * The trainers on a map who would still pay their prize (`prizeMoney.ts`),
 * for THE MAP to mark with a coin. New money is a trainer not yet beaten, and a
 * win that paid nothing could not tell a player which fights still pay (the
 * fresh critic, 26 Nov 2026). Only where the player has walked beside them,
 * so the map tells what they have seen rather than where everybody stands,
 * and never a boss: a boss is fought once a save, and its door says so.
 */
export function pursesOn(
  mapId: WorldMapId,
  trainersPaid: readonly string[],
  isKnown: (tile: GridPosition) => boolean,
): readonly PurseMark[] {
  const paid = new Set(trainersPaid);
  const seen = (at: GridPosition): boolean =>
    [at, { x: at.x + 1, y: at.y }, { x: at.x - 1, y: at.y }, { x: at.x, y: at.y + 1 }, { x: at.x, y: at.y - 1 }].some(isKnown);
  return trainersOn(mapId)
    .filter((encounter) => encounter.bossId === undefined && !paid.has(encounter.trainer.id) && seen(encounter.position))
    .map((encounter) => ({ tile: encounter.position, name: encounter.trainer.name }));
}
