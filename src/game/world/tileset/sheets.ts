import { tileReader, type TileSource } from './catalogue';
import { FRLG_TILESET } from './frlgTileset';

/**
 * The images the game draws maps from, and where each one's tiles sit in the
 * shared numbering a map's layers use.
 *
 * Two sheets, and the split between them is not a matter of taste. The shipped
 * `tileset.png` is GBA Pokemon art - 91% of its colours are exact 15-bit GBA
 * values, and its grass sits at hue 152. ArMM1998's CC0 `Overworld.png` is hue
 * 123 and 11%: a different colour of green, not a different shade. So the two
 * grounds cannot meet. Objects can: `character.png`, the sprite every figure in
 * the game is drawn from, comes from the Zelda-like pack and has stood on GBA
 * grass since the first commit without anyone noticing.
 *
 * Hence the rule the catalogues keep: **ground from one family, objects from
 * either.** The first indices are round numbers with a wide gap so a tile
 * number in a dump says at a glance which sheet it came from.
 */
export const CLASSIC = tileReader(
  { textureKey: 'classicTiles', imagePath: 'assets/tileset.png', columns: 8, rows: 13 },
  0,
);

export const OVERWORLD = tileReader(
  { textureKey: 'overworld', imagePath: 'assets/Overworld.png', columns: 40, rows: 36 },
  1000,
);

/**
 * Every image the loader has to fetch, whatever any one map uses.
 *
 * The FireRed/LeafGreen sheet numbers itself from 2000, declared beside its own
 * catalogue because that is where its dimensions are known.
 */
export const TILE_SOURCES: readonly TileSource[] = [
  CLASSIC.source,
  OVERWORLD.source,
  ...FRLG_TILESET.sources,
];
