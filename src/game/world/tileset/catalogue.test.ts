import { describe, expect, it } from 'vitest';
import { fillTile, resolveTile, TILE_ROLES, type MaterialTiles } from './catalogue';
import { CLASSIC_TILESET } from './classicTileset';
import { OVERWORLD_TILESET } from './overworldTileset';
import { FRLG_TILESET } from './frlgTileset';
import { POKEMON_GROUND_TILESET } from './pokemonGround';
import { TILE_SOURCES } from './sheets';
import { MATERIALS, type Material } from './materials';

const CATALOGUES = {
  frlg: FRLG_TILESET,
  classic: CLASSIC_TILESET,
  overworld: OVERWORLD_TILESET,
  'pokemon ground': POKEMON_GROUND_TILESET,
};

describe('resolving a tile from a material and a role', () => {
  it('takes the exact role when the sheet draws one', () => {
    const tiles: MaterialTiles = { roles: { fill: 1, 'edge-n': 2, 'corner-nw': 3 } };
    expect(resolveTile(tiles, 'corner-nw')).toBe(3);
  });

  /**
   * A sheet with no corner art must render as a blunt-cornered mass rather than
   * as a hole. The chain is ordered by how little it lies: a corner falls back
   * to the edge it is most like, an edge to fill.
   */
  it('falls back along the chain rather than drawing a hole', () => {
    const tiles: MaterialTiles = { roles: { fill: 1, 'edge-n': 2 } };
    expect(resolveTile(tiles, 'corner-nw')).toBe(2);
    expect(resolveTile(tiles, 'edge-s')).toBe(1);
    expect(resolveTile(tiles, 'inner-se')).toBe(1);
  });

  it('never returns a hole for any role of any shipped material', () => {
    for (const [name, catalogue] of Object.entries(CATALOGUES)) {
      for (const material of Object.keys(catalogue.materials) as Material[]) {
        for (const role of TILE_ROLES) {
          const tile = resolveTile(catalogue.materials[material], role);
          expect(`${name}/${material}/${role}: ${tile}`).not.toBe(`${name}/${material}/${role}: -1`);
        }
      }
    }
  });
});

describe('fill variation', () => {
  const tiles: MaterialTiles = { roles: { fill: 1 }, fillVariants: [2, 3, 4], variantRarity: 6 };

  it('is a function of position, so a map builds identically every time', () => {
    expect(fillTile(tiles, 7, 11)).toBe(fillTile(tiles, 7, 11));
  });

  it('is sparse: variants accent a surface rather than speckling it', () => {
    let varied = 0;
    for (let y = 0; y < 40; y += 1) {
      for (let x = 0; x < 40; x += 1) {
        if (fillTile(tiles, x, y) !== 1) varied += 1;
      }
    }
    const share = varied / 1600;
    expect(share).toBeGreaterThan(0.08);
    expect(share).toBeLessThan(0.26);
  });

  it('leaves a material with no variants alone', () => {
    expect(fillTile({ roles: { fill: 9 } }, 3, 4)).toBe(9);
  });
});

describe('the shipped catalogues', () => {
  it('covers every material, so no map can name one that cannot be drawn', () => {
    for (const [name, catalogue] of Object.entries(CATALOGUES)) {
      for (const material of Object.keys(MATERIALS) as Material[]) {
        expect(`${name} draws ${material}: ${catalogue.materials[material] !== undefined}`).toBe(
          `${name} draws ${material}: true`,
        );
      }
    }
  });

  it('names only tiles that exist on one of its own sheets', () => {
    for (const [name, catalogue] of Object.entries(CATALOGUES)) {
      const spans = catalogue.sources.map((source) => ({
        from: source.firstIndex,
        to: source.firstIndex + source.columns * source.rows,
      }));
      const onSheet = (tile: number): boolean =>
        tile < 0 || spans.some((span) => tile >= span.from && tile < span.to);

      for (const [material, tiles] of Object.entries(catalogue.materials)) {
        for (const tile of [...Object.values(tiles.roles), ...(tiles.fillVariants ?? [])]) {
          expect(`${name}/${material} tile ${tile}: ${onSheet(tile)}`).toBe(
            `${name}/${material} tile ${tile}: true`,
          );
        }
      }
      for (const [propName, prop] of Object.entries(catalogue.props)) {
        expect(prop.cells).toHaveLength(prop.width * prop.height);
        for (const cell of prop.cells) {
          expect(`${name}/${propName} tile ${cell.tile}: ${onSheet(cell.tile)}`).toBe(
            `${name}/${propName} tile ${cell.tile}: true`,
          );
        }
      }
      if (catalogue.shore) {
        for (const tile of Object.values(catalogue.shore.tiles) as number[]) {
          expect(`${name}/shore tile ${tile}: ${onSheet(tile)}`).toBe(
            `${name}/shore tile ${tile}: true`,
          );
        }
      }
    }
  });

  /**
   * Two sheets under one numbering: a tile that fell in the gap between them
   * would render as whatever Phaser found nearest rather than as an error.
   */
  it('gives every sheet a span of its own that no other sheet overlaps', () => {
    for (const catalogue of Object.values(CATALOGUES)) {
      const spans = catalogue.sources
        .map((source) => ({
          from: source.firstIndex,
          to: source.firstIndex + source.columns * source.rows,
        }))
        .sort((a, b) => a.from - b.from);
      for (let index = 1; index < spans.length; index += 1) {
        expect(spans[index].from).toBeGreaterThanOrEqual(spans[index - 1].to);
      }
    }
  });

  it('draws every sheet any map uses from the list the loader fetches', () => {
    const loaded = new Set(TILE_SOURCES.map((source) => source.textureKey));
    for (const catalogue of Object.values(CATALOGUES)) {
      for (const source of catalogue.sources) {
        expect(`${source.textureKey} is loaded: ${loaded.has(source.textureKey)}`).toBe(
          `${source.textureKey} is loaded: true`,
        );
      }
    }
  });
});
