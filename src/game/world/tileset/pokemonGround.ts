import type { TilesetCatalogue } from './catalogue';
import { CLASSIC_TILESET } from './classicTileset';
import { OVERWORLD_PROPS, type OverworldPropName } from './overworldTileset';
import { CLASSIC, OVERWORLD } from './sheets';

/**
 * GBA-palette ground, with the CC0 sheet's objects standing on it.
 *
 * This is the split the pixels force and the one the game should be built on.
 * Ground is one family or it is not ground: `tileset.png`'s grass is hue 152
 * and 91% exact GBA 15-bit colour, ArMM1998's is hue 123 and 11%, and a seam
 * between them reads as two games pasted together. Objects are the opposite -
 * a brown timber house carrying its own shadow sits on either grass, which is
 * not a theory: `character.png` is from the Zelda-like pack and every figure in
 * the game has been standing on GBA grass since the first commit.
 *
 * So: materials come from the classic sheet and props come from the wide one.
 * When a fuller Pokemon-family terrain sheet is adopted, the change is to
 * `materials` alone - the maps name materials and roles, never tiles, and the
 * role set is already the thirteen-piece shape those sheets are drawn in.
 */
export const POKEMON_GROUND_TILESET: TilesetCatalogue<OverworldPropName> = {
  sources: [CLASSIC.source, OVERWORLD.source],
  materials: CLASSIC_TILESET.materials,
  props: OVERWORLD_PROPS,
};
