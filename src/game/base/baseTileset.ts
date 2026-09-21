import { withDoorway, type TilesetCatalogue } from '../world/tileset/catalogue';
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
export type BasePropName = FloodTownPropName | 'oakLab' | 'pokemonCentre' | 'workshop';

export const BASE_TILESET: TilesetCatalogue<BasePropName> = {
  ...FLOOD_TOWN_TILESET,
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
  },
};
