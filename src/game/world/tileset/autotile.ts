import type { TileRole } from './catalogue';

/**
 * Which piece of its material a tile is, read off its eight neighbours.
 *
 * This is the whole of "dressed edges": nothing in a map ever names an edge
 * tile, so nothing in a map can forget one. An author writes a region of hedge
 * and the hedge grows its own corners.
 *
 * The role set is deliberately the shape a Pokemon-family ground block is drawn
 * in - a solid, four edges, four outside corners and four inside corners, the
 * thirteen-tile block the FireRed/LeafGreen terrain sheet lays every material
 * out as - plus the one-tile runs and caps the narrower sheets need. Keeping to
 * that shape is what makes swapping the art a change to a catalogue rather than
 * a change to every map.
 */
export interface Neighbourhood {
  readonly north: boolean;
  readonly south: boolean;
  readonly east: boolean;
  readonly west: boolean;
  readonly northEast?: boolean;
  readonly northWest?: boolean;
  readonly southEast?: boolean;
  readonly southWest?: boolean;
}

/** True where the neighbour is the same material - or off the map, which counts
 *  as the same so a material running to the edge is not drawn as a rim. */
export function roleFor(same: Neighbourhood): TileRole {
  const { north, south, east, west } = same;
  const count = Number(north) + Number(south) + Number(east) + Number(west);

  if (count === 0) return 'single';

  if (count === 1) {
    if (north) return 'cap-s';
    if (south) return 'cap-n';
    if (east) return 'cap-w';
    return 'cap-e';
  }

  if (count === 2) {
    if (north && south) return 'run-v';
    if (east && west) return 'run-h';
    if (south && east) return 'corner-nw';
    if (south && west) return 'corner-ne';
    if (north && east) return 'corner-sw';
    return 'corner-se';
  }

  if (count === 3) {
    // Three neighbours match, so the edge faces the one that does not.
    if (!north) return 'edge-n';
    if (!south) return 'edge-s';
    if (!east) return 'edge-e';
    return 'edge-w';
  }

  // Every side matches, so only a missing diagonal can make this anything but
  // solid: the material turns an inside corner around a notch. A tile missing
  // more than one diagonal has no single piece drawn for it on any sheet of
  // this shape, so the first is taken and the rest are absorbed - which is why
  // a notch is authored as a notch rather than as a diagonal chain.
  if (same.northWest === false) return 'inner-nw';
  if (same.northEast === false) return 'inner-ne';
  if (same.southWest === false) return 'inner-sw';
  if (same.southEast === false) return 'inner-se';
  return 'fill';
}
