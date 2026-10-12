import type { Direction, GridPosition } from '../movement/gridMovement';
import type { CastCharacterDesignId } from '../world/characterDesigns';

/**
 * THE DAY-CARE in the yard: a fenced pen on the lawn past THE BOLTHOLE, the
 * Day-Care Man at its fence, and whoever he is raising walking about inside
 * it (`hub/dayCare.ts` is what he does).
 *
 * It is a person and a pen rather than a door, because the thing worth seeing
 * is the Pokémon: the base's rule is that what you have going on stands
 * somewhere you can look at it (`fixtures.ts`), and a Pokémon behind a door is
 * a Pokémon nobody sees between raids. It is drawn as the Day-Care yards of the
 * games this is dressed as are - grass inside a fence, with the man outside it
 * - and he is FireRed's own: the Route 5 Day-Care Man is drawn as a gentleman
 * (`OBJ_EVENT_GFX_GENTLEMAN`, pret/pokefirered `data/maps/Route5_PokemonDayCare/map.json`).
 *
 * Like THE BOLTHOLE it is not on the way to re-kitting, so it is not one of
 * the seven-step doors: it is a stroll up the lawn, held by `baseMap.test.ts`.
 */

export interface DayCareKeeper {
  readonly id: string;
  /** What the caption calls him. */
  readonly name: string;
  readonly design: CastCharacterDesignId;
  readonly position: GridPosition;
  readonly facing: Direction;
}

export const DAY_CARE_KEEPER: DayCareKeeper = {
  id: 'day-care-man',
  name: 'DAY-CARE MAN',
  design: 'gentleman',
  // At the west fence of his pen, looking down the lawn towards the house the
  // player comes from.
  position: { x: 34, y: 11 },
  facing: 'left',
};

/** The grass inside the fence: where the Pokémon he is raising may stand. */
export const DAY_CARE_PEN = { x: 36, y: 9, width: 5, height: 4 } as const;

/** Every tile inside the fence, row by row. */
export function penTiles(): readonly GridPosition[] {
  return Array.from({ length: DAY_CARE_PEN.width * DAY_CARE_PEN.height }, (_tile, index) => ({
    x: DAY_CARE_PEN.x + (index % DAY_CARE_PEN.width),
    y: DAY_CARE_PEN.y + Math.floor(index / DAY_CARE_PEN.width),
  }));
}

/** Where the Pokémon stands when the yard is first drawn: the middle of the pen. */
export const PEN_HOME: GridPosition = { x: DAY_CARE_PEN.x + 2, y: DAY_CARE_PEN.y + 2 };

/**
 * Where it wanders next: one step to a neighbouring tile of the pen, chosen by
 * `roll` (0 to 1), or nowhere when the roll says it stays put. It never leaves
 * the fence, and it walks only a tile at a time, the way a figure in the yard
 * does.
 */
export function nextPenTile(from: GridPosition, roll: number): GridPosition {
  const steps: readonly GridPosition[] = [
    { x: from.x, y: from.y - 1 },
    { x: from.x, y: from.y + 1 },
    { x: from.x - 1, y: from.y },
    { x: from.x + 1, y: from.y },
  ].filter(
    (tile) =>
      tile.x >= DAY_CARE_PEN.x &&
      tile.y >= DAY_CARE_PEN.y &&
      tile.x < DAY_CARE_PEN.x + DAY_CARE_PEN.width &&
      tile.y < DAY_CARE_PEN.y + DAY_CARE_PEN.height,
  );
  // Some of the time it stays where it is, so it potters rather than paces.
  const index = Math.floor(Math.max(0, Math.min(0.999999, roll)) * (steps.length + 2));
  return steps[index] ?? from;
}
