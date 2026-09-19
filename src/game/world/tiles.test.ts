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

    /**
     * A landmark used only ever to add walls, so a bridge laid over a river was
     * a drawing of a bridge: the deck was marked as somewhere to stand and the
     * water under it still said no. Every crossing on the Floodplain was a
     * stranded piece of map until this was the rule.
     */
    it('makes the deck of a bridge ground, whatever it is laid over', () => {
      const map = sketch(['....', 'WWWW', 'WWWW', 'WWWW', '....']);
      map.plant(0, 0, 'bridge');
      const { collision } = buildMapLayers(map, FRLG_TILESET);
      for (let y = 0; y < 5; y += 1) {
        expect(`rail at 0,${y} is solid: ${collision[y][0]}`).toBe(`rail at 0,${y} is solid: true`);
        expect(`deck at 1,${y} is solid: ${collision[y][1]}`).toBe(`deck at 1,${y} is solid: false`);
        expect(`deck at 2,${y} is solid: ${collision[y][2]}`).toBe(`deck at 2,${y} is solid: false`);
        expect(`rail at 3,${y} is solid: ${collision[y][3]}`).toBe(`rail at 3,${y} is solid: true`);
      }
    });

    /**
     * The other half of that rule. A crown is not solid either, but it hangs
     * over things rather than standing on them - if it cleared what was under
     * it, every tree on a map's edge would open the edge.
     */
    it('never lets a crown open the water or the thicket it hangs over', () => {
      const map = sketch(['WWWTTT', '......', '......']);
      map.plant(0, 0, 'tree');
      map.plant(3, 0, 'tree');
      const { collision } = buildMapLayers(map, FRLG_TILESET);
      expect(collision[0]).toEqual([true, true, true, true, true, true]);
    });

    it('rolls no encounters on a deck laid over tall grass', () => {
      const map = sketch(['gggg', 'gggg', 'gggg', 'gggg', 'gggg']);
      map.plant(0, 0, 'bridge');
      const { tallGrass } = buildMapLayers(map, FRLG_TILESET);
      expect(tallGrass[2][1]).toBe(false);
      expect(tallGrass[2][2]).toBe(false);
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

  /**
   * A lane that turns a corner is whole on all four sides and missing only a
   * diagonal. The sheet has a tile for exactly that, and for a whole map's life
   * it was never drawn: only four neighbours were asked, so the corner came out
   * as plain fill and the fringe either side of it stopped dead in a notch.
   */
  it('turns a path round an inside corner with the corner the sheet draws for it', () => {
    const { ground } = buildMapLayers(
      sketch([
        '......',
        '.,,,,.',
        '.,,,,.',
        '.,,...',
        '.,,...',
        '......',
      ]),
      FRLG_TILESET,
    );
    const earth = FRLG_TILESET.materials.earth.roles;
    // 2,2 has earth on all four sides and grass only to its south-east.
    expect(ground.tiles[2][2]).toBe(earth['inner-se']);
    expect(ground.tiles[2][2]).not.toBe(earth.fill);
    // And a tile whole on every side, diagonals included, is still plain fill.
    const wide = buildMapLayers(sketch(['.....', '.,,,.', '.,,,.', '.,,,.', '.....']), FRLG_TILESET);
    expect(wide.ground.tiles[2][2]).toBe(earth.fill);
  });

  /**
   * A ford is a paler reach of the same river. Drawn with a bank against the
   * deep water either side of it, it read as a pool of its own and cut the
   * river into three; it is banked where it meets land and nowhere else.
   */
  it('draws no bank between a ford and the deep water it crosses', () => {
    const { ground } = buildMapLayers(
      sketch([
        '.......',
        'WWwwwWW',
        'WWwwwWW',
        'WWwwwWW',
        '.......',
      ]),
      FRLG_TILESET,
    );
    const ford = FRLG_TILESET.materials.ford.roles;
    const water = FRLG_TILESET.materials.water.roles;
    // The ford's west column meets deep water: mid-river it is plain shallows,
    // and at the banks an edge facing the land, never a corner.
    expect(ground.tiles[2][2]).toBe(ford.fill);
    expect(ground.tiles[1][2]).toBe(ford['edge-n']);
    expect(ground.tiles[3][2]).toBe(ford['edge-s']);
    // And the river beside it carries on as river.
    expect(ground.tiles[2][1]).toBe(water.fill);
    expect(ground.tiles[1][1]).toBe(water['edge-n']);
  });
});
