import { withDoorway, type PropDefinition, type TilesetCatalogue } from '../world/tileset/catalogue';
import { pieceTile, BASE_SHEET_SOURCE } from './baseSheet';
import {
  FLOOD_TOWN_TILESET,
  type FloodTownPropName,
} from '../world/tileset/floodTownTileset';

/**
 * The base is drawn on the same sheet the four raid maps are, with three of its
 * buildings opened up.
 *
 * A door is the one part of a building that is ground. The shared props are
 * solid edge to edge - they were authored as scenery for maps nobody goes
 * inside - so the base names its own three with the doorway cut out of them,
 * and the player walks into the dark of the opening exactly as they do in the
 * games this is dressed as. A prop is the last word on its own tiles
 * (`buildMapLayers`), so that is the whole of it: no second collision list, and
 * the door cannot drift from the art it is drawn in.
 *
 * Which cell is the doorway was read off the sheet rather than guessed - the
 * shop front's is two cells wide and dead centre, the house's is one cell under
 * its arch, and the boathouse's is the pair under its own.
 */
export type BasePropName =
  | FloodTownPropName
  | 'oakLab'
  | 'pokemonCentre'
  | 'workshop'
  | 'billsCottage';

/**
 * Bill's cottage: a little blue-roofed FireRed house, cut onto the base's own
 * sheet (`scripts/cut-frlg-base.mjs`). The sheet draws its door at the east
 * end; it stands here drawn left for right, so the door is at the end nearest
 * the jetty and the walk from the boat to Bill is four steps rather than eight.
 * FireRed's houses are lit from straight above, so nothing reads backwards.
 */
function mirroredCottage(): PropDefinition {
  const width = 5;
  const height = 3;
  const door = { x: 1, y: 2 };
  return {
    label: 'cottage',
    width,
    height,
    cells: Array.from({ length: width * height }, (_cell, index) => {
      const x = index % width;
      const y = Math.floor(index / width);
      return {
        tile: pieceTile('cottage', width - 1 - x, y),
        solid: !(x === door.x && y === door.y),
        flipX: true,
      };
    }),
  };
}

export const BASE_TILESET: TilesetCatalogue<BasePropName> = {
  ...FLOOD_TOWN_TILESET,
  sources: [...FLOOD_TOWN_TILESET.sources, BASE_SHEET_SOURCE.source],
  props: {
    ...FLOOD_TOWN_TILESET.props,
    // 4x4. The shop front, which is the one building on the FireRed sheet and
    // the only one that reads as an institution rather than as somebody's home.
    oakLab: withDoorway(FLOOD_TOWN_TILESET.props.building, [
      [1, 3],
      [2, 3],
    ]),
    // 5x5, with a single arched door under a lit window.
    pokemonCentre: withDoorway(FLOOD_TOWN_TILESET.props.house, [[2, 4]]),
    // 4x5. Doors wide enough for a boat, which is what a workshop wants.
    workshop: withDoorway(FLOOD_TOWN_TILESET.props.barn, [
      [1, 4],
      [2, 4],
    ]),
    billsCottage: mirroredCottage(),
  },
};
