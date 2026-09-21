import type { GridPosition } from '../movement/gridMovement';
import { MATERIAL_CHARS, MATERIALS, type Material } from './tileset/materials';
import type { WorldMapId } from '../worldMap';

/**
 * A place inside a map, with a roof on it.
 *
 * The tutorial's interiors are a second Unity scene reached through a portal,
 * and that architecture is the one thing in it this game must not take: a map
 * here is an arena, an exit takes whoever steps on it, and the hunter's pursuit
 * is a breadth-first search over one collision grid. A second scene would give
 * the player somewhere the hunter is not, which is a safe box, and it would
 * give the raid a loading seam every time somebody ducked out of the rain.
 *
 * So an interior here is **the same map with a lid on it**. The floor is drawn
 * in the sketch like any other ground - walls round it, a mouth at each end,
 * stone and gravel inside - so every structural rule, every measured route and
 * the hunter's own search see ordinary tiles and need to know nothing. What is
 * added is one tile layer above the figures (`MapLayers.roof`, painted by
 * `buildMapLayers` from `roof` below) which is drawn while you are outside and
 * lifted while you are inside. From the outside the cave is the hillside it is
 * cut into; step through a mouth and the hill lifts off.
 *
 * Four things follow, and each is a rule rather than a flourish.
 *
 * **Two mouths, always.** A room with one door is the shape of the fault the
 * captain hit on 2026-09-19, where the hunter settled in the gap he had come
 * through and there was nothing to do about it. Two mouths make an interior a
 * *route* rather than a pocket: whoever is inside always has somewhere to go,
 * and a figure standing in one passage never shuts the place. `interiors.test.ts`
 * holds that, and holds the stronger form of it - no floor tile is a dead end,
 * so blocking any single tile still leaves every other tile a way out.
 *
 * **It breaks the trail, and it is not a safe box.** While the player is under
 * a roof the hunter cannot see them: it walks to the last tile it knew them on
 * and keeps hunting from there (`HunterState.lastSeen` in `hunter.ts`). It is
 * not blinded and never freezes - a frozen figure in a mouth would be a wall -
 * so it may perfectly well walk in after you, and walking into it still catches
 * you. The raid clock does not stop, and `RAID_DURATION_MS` does not move: a
 * player who hides in a hole is spending the only thing a raid cannot buy back.
 *
 * **It is worth going in for.** An interior carries its own `encounters`
 * district, and a cave's floor rolls for wildlife the way tall grass does
 * (`floorRolls`), which is what puts Zubat, Geodude and Diglett somewhere they
 * belong and nowhere else on the surface of any map. Loot and landmarks stand
 * in it like anywhere else.
 *
 * **Dark is atmosphere, never a lock.** The tutorial gates its caves behind
 * Flash. A key item that makes ground passable is exactly the corridor-with-a-
 * lock this game refuses (`AGENTS.md`, field moves), so an interior is merely
 * dimmer: `dim` is a veil drawn over its ground and under every figure, so the
 * floor is dark and the people in it are lit.
 */

export interface MapInterior {
  readonly id: string;
  readonly mapId: WorldMapId;
  /** What a caption at a mouth calls it. */
  readonly label: string;
  /** The line the field guide and the drop-in screen read. */
  readonly description: string;
  /**
   * Every tile the roof covers. The floor is whatever of it the sketch drew
   * walkable; the rest is the rock the passages are cut through, and is
   * covered so the outside reads as one unbroken hillside.
   */
  readonly roof: Rect;
  /**
   * The hillside itself: an opaque ground, autotiled, under everything the lid
   * draws. Every wall material on the FireRed sheet is an *overlay* - one rock,
   * one bush, drawn over whatever is beneath - so a lid painted from one of
   * them alone is a scatter of boulders with the cave showing between them,
   * which is what the first draft of this looked like on screen.
   */
  readonly roofGround: Material;
  /**
   * And the lid itself, **drawn**, one character per tile of `roof` in the same
   * alphabet every map is written in (`MATERIAL_CHARS`).
   *
   * It is drawn rather than filled for the reason the maps themselves are: a
   * rectangle of one material is wallpaper, and this one was - ten by six of
   * the identical rock tile in a rigid grid, which is the hedge-maze fault
   * `AGENTS.md` records for THE STAITHE, found the same way, by looking at it.
   * A ground character paints that ground alone; a wall character stands on
   * `roofGround`; and `' '` is a hole in the lid, which is what a mouth is and
   * the only thing that tells anyone a cave is there.
   */
  readonly lid: readonly string[];
  /**
   * The tiles you step through to get in and out, each one walkable and each
   * one on the edge of `roof`. Two at least - see the header.
   */
  readonly mouths: readonly GridPosition[];
  /** Whether every walkable floor tile rolls for wildlife, as a cave's does. */
  readonly floorRolls: boolean;
  /** How dark the inside is, 0 (no veil) to 1 (black). */
  readonly dim: number;
}

/**
 * How long the lid takes to come off, in milliseconds.
 *
 * Short enough that it is never a wait - a step is 150ms and this runs beside
 * the next one rather than in front of it - and long enough to read as the hill
 * lifting rather than as a tile layer being switched off.
 */
export const INTERIOR_COVER_MS = 220;

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * THE DELVE, under Pallet Town's east valley.
 *
 * The valley was drawn with a quarry in its east hills and an adit landmark on
 * the quarry's west face - "the level driven into the quarry face, still shored
 * and still stocked" (`pois.ts`). This is that level, finally driven: it goes
 * in off THE HANGER, doglegs down through the rock and comes out on the quarry
 * floor, and the two places it joins are 37 walking steps apart round it.
 *
 * It is deliberately *not* the short way. The through-walk winds, so it is
 * nineteen steps against the thirty-seven round the hill - an alternative that
 * pays for knowing it, not a wormhole that makes the valley small - and its
 * floor rolls for a fight on every step of it, so the short way is the one
 * that costs. The one thing it
 * has that no ground above it has is what lives in it.
 *
 * Its mouths are both in the upper lobe of the east valley, which is also
 * deliberate: Pallet's valley is authored as two lobes with no new crossing
 * between them (`maps/palletTown.ts`), and a cave that joined THE QUARRY to
 * THE KILNS would undo 143 steps of that decision. That cave is the obvious
 * next one and it is the captain's call, not a side effect of this one.
 */
export const WORLD_INTERIORS: readonly MapInterior[] = [
  {
    id: 'pallet-delve',
    mapId: 'pallet-town',
    label: 'THE DELVE',
    description:
      'The old level under the quarry hill: in off the hanger, down through the rock and out on the quarry floor. Nothing that lives down there lives anywhere above it.',
    roof: { x: 44, y: 22, width: 10, height: 6 },
    // A rocky knoll: a crown of rock fading to scree at its foot, with a gap
    // at each mouth. It is the quarry's own ground carried up over the level,
    // so the hill belongs to the working rather than sitting in the wood as a
    // rectangle - and a player crossing the hanger can see there is something
    // here before they can see the way in.
    roofGround: 'gravel',
    lid: [
      ' CCCCCCCCC',
      'vCCCCCCCCv',
      'vvCCCCCCv ',
      'vvvCCCCvvv',
      'vvvvCCvvvv',
      'vvvvvvvvvv',
    ],
    mouths: [
      // Off the hanger, and out onto the quarry floor.
      { x: 44, y: 22 },
      { x: 53, y: 24 },
    ],
    floorRolls: true,
    dim: 0.45,
  },
];

export function interiorsForMap(mapId: WorldMapId): readonly MapInterior[] {
  return WORLD_INTERIORS.filter((interior) => interior.mapId === mapId);
}

export function isInsideRect(rect: Rect, tile: GridPosition): boolean {
  return (
    tile.x >= rect.x &&
    tile.x < rect.x + rect.width &&
    tile.y >= rect.y &&
    tile.y < rect.y + rect.height
  );
}

/**
 * The interior whose roof covers this tile, if any.
 *
 * Roofed, not merely inside the rectangle: standing on a mouth already counts,
 * because a mouth is the first tile of the inside and the lid has to be off
 * before the player has taken the step that would put them under it.
 */
export function interiorAt(
  mapId: WorldMapId,
  tile: GridPosition,
): MapInterior | undefined {
  return interiorsForMap(mapId).find((interior) => isInsideRect(interior.roof, tile));
}

/**
 * What the lid draws on one of its tiles: nothing, a ground, or a wall standing
 * on the hillside's own ground.
 */
export function lidAt(
  interior: MapInterior,
  x: number,
  y: number,
): { readonly ground: Material; readonly standing: Material | null } | null {
  const char = interior.lid[y - interior.roof.y]?.[x - interior.roof.x];
  if (char === undefined || char === ' ') {
    return null;
  }
  const material = (Object.keys(MATERIAL_CHARS) as Material[]).find(
    (candidate) => MATERIAL_CHARS[candidate] === char,
  );
  if (material === undefined) {
    throw new Error(`interior '${interior.id}' draws its lid with an unknown character '${char}'`);
  }
  return MATERIALS[material].ground
    ? { ground: material, standing: null }
    : { ground: interior.roofGround, standing: material };
}

/** Whether a step onto this tile should roll for wildlife as tall grass does. */
export function interiorFloorRolls(mapId: WorldMapId, tile: GridPosition): boolean {
  return interiorAt(mapId, tile)?.floorRolls === true;
}
