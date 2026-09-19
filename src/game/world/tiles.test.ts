import { describe, expect, it } from 'vitest';
import { MapSketch } from './mapGrid';
import { buildMapLayers } from './tiles';
import { OVERWORLD_TILESET } from './tileset/overworldTileset';
import { CLASSIC_TILESET } from './tileset/classicTileset';
import { FRLG_TILESET } from './tileset/frlgTileset';
import { POKEMON_GROUND_TILESET } from './tileset/pokemonGround';

/** A small map drawn as character art, the way a real map is authored. */
function sketch(rows: readonly string[]) {
  const map = new MapSketch({ width: rows[0].length, height: rows.length, fill: 'W' });
  map.draw(0, 0, rows);
  return map;
}

describe('building a map from a sketch and a catalogue', () => {
  it('reads collision and encounters off the materials, not off the art', () => {
    const layers = buildMapLayers(
      sketch([
        'WWWWW',
        'W.gTW',
        'W,,#W',
        'WWWWW',
      ]),
      OVERWORLD_TILESET,
    );
    expect(layers.collision[1]).toEqual([true, false, false, true, true]);
    expect(layers.tallGrass[1]).toEqual([false, false, true, false, false]);
    expect(layers.collision[2]).toEqual([true, false, false, true, true]);
    expect(layers.tallGrass[2]).toEqual([false, false, false, false, false]);
  });

  /**
   * The single thing that most separates a drawn map from a stamped one, and
   * the one edge a map must never place by hand: it changes every time a bank
   * is nudged, and a missed piece is a bare seam.
   */
  it('draws a shoreline wherever ground meets water, without being asked', () => {
    const { ground } = buildMapLayers(
      sketch([
        'WWWWW',
        'W...W',
        'W...W',
        'W...W',
        'WWWWW',
      ]),
      OVERWORLD_TILESET,
    );
    const shore = OVERWORLD_TILESET.shore!.tiles;
    expect(ground.tiles[1][1]).toBe(shore.waterNorthWest);
    expect(ground.tiles[1][2]).toBe(shore.waterNorth);
    expect(ground.tiles[1][3]).toBe(shore.waterNorthEast);
    expect(ground.tiles[2][1]).toBe(shore.waterWest);
    expect(ground.tiles[2][3]).toBe(shore.waterEast);
    expect(ground.tiles[3][2]).toBe(shore.waterSouth);
    // The middle of the island is plain ground: a bank is only where water is.
    expect(Object.values(shore)).not.toContain(ground.tiles[2][2]);
  });

  it('turns the bank around a corner the water only touches diagonally', () => {
    const { ground } = buildMapLayers(
      sketch([
        '.....',
        '..W..',
        '.....',
      ]),
      OVERWORLD_TILESET,
    );
    const shore = OVERWORLD_TILESET.shore!.tiles;
    expect(ground.tiles[0][1]).toBe(shore.diagonalSouthEast);
    expect(ground.tiles[0][3]).toBe(shore.diagonalSouthWest);
    expect(ground.tiles[2][1]).toBe(shore.diagonalNorthEast);
    expect(ground.tiles[2][3]).toBe(shore.diagonalNorthWest);
  });

  it('leaves ground the sheet has no beach for unbanked', () => {
    // Paving meets water at a kerb, not at a shoreline, so no rim is drawn.
    const { ground } = buildMapLayers(sketch(['WPW']), OVERWORLD_TILESET);
    expect(Object.values(OVERWORLD_TILESET.shore!.tiles)).not.toContain(ground.tiles[0][1]);
  });

  /** A hedge is growth standing on ground, so something has to be under it. */
  it('stands growth on whatever its neighbours are made of', () => {
    const { ground, overlay } = buildMapLayers(
      sketch([
        '.....',
        ',,#,,',
        '.....',
      ]),
      OVERWORLD_TILESET,
    );
    expect(overlay.tiles[1][2]).toBeGreaterThanOrEqual(0);
    // Earth on both sides, so the hedge stands on earth rather than on grass.
    const earth = OVERWORLD_TILESET.materials.earth;
    const earthTiles = new Set([earth.roles.fill, ...(earth.fillVariants ?? [])]);
    expect(earthTiles.has(ground.tiles[1][2])).toBe(true);
    const grass = OVERWORLD_TILESET.materials.grass;
    const grassTiles = new Set([grass.roles.fill, ...(grass.fillVariants ?? [])]);
    expect(grassTiles.has(ground.tiles[1][2])).toBe(false);
  });

  describe('planted landmarks', () => {
    it('carries its own collision, so the art and the wall agree', () => {
      const map = sketch(['......', '......', '......', '......']);
      map.plant(1, 0, 'tree');
      const { detail, canopy, collision } = buildMapLayers(map, FRLG_TILESET);
      // FireRed draws a broadleaf as 3x3 with the trunk on the bottom row, so
      // the crown is over whoever walks behind it and only the trunk is solid.
      expect(canopy.tiles[0][1]).toBeGreaterThanOrEqual(0);
      expect(detail.tiles[1][2]).toBeGreaterThanOrEqual(0);
      expect(detail.tiles[2][1]).toBeGreaterThanOrEqual(0);
      // You walk behind the top of the crown; everything under it is a wall.
      expect(collision[0][1]).toBe(false);
      expect(collision[0][3]).toBe(false);
      expect(collision[1][1]).toBe(true);
      expect(collision[2][3]).toBe(true);
    });

    it('refuses a prop the catalogue does not draw', () => {
      const map = sketch(['...']);
      map.plant(0, 0, 'wyvern');
      expect(() => buildMapLayers(map, FRLG_TILESET)).toThrow(/no prop named 'wyvern'/);
    });

    it('never lets a crown drawn over the figures also be a wall', () => {
      const map = sketch(['......', '......', '......', '......']);
      map.plant(1, 0, 'tree');
      const { canopy, collision } = buildMapLayers(map, FRLG_TILESET);
      for (let y = 0; y < collision.length; y += 1) {
        for (let x = 0; x < collision[y].length; x += 1) {
          if (canopy.tiles[y][x] < 0) continue;
          expect(`canopy at ${x},${y} is solid: ${collision[y][x]}`).toBe(
            `canopy at ${x},${y} is solid: false`,
          );
        }
      }
    });

    it('refuses a prop that runs off the map rather than losing half of it', () => {
      const map = sketch(['...']);
      map.plant(2, 0, 'tree');
      expect(() => buildMapLayers(map, FRLG_TILESET)).toThrow(/runs off the map/);
    });
  });

  it('draws the same sketch from any catalogue', () => {
    const rows = ['WWWWW', 'W.gTW', 'W,,#W', 'WWWWW'];
    for (const catalogue of [CLASSIC_TILESET, OVERWORLD_TILESET, POKEMON_GROUND_TILESET, FRLG_TILESET]) {
      const layers = buildMapLayers(sketch(rows), catalogue);
      expect(layers.collision[1]).toEqual([true, false, false, true, true]);
      expect(layers.ground.tiles.every((row) => row.every((tile) => tile >= 0))).toBe(true);
    }
  });
});
