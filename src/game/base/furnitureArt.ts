import type Phaser from 'phaser';
import type { Rect } from '../ui/labelPlacement';
import { FIGURE_BAND, FLOOR_FURNITURE_DEPTH, atRow } from '../world/depths';
import {
  POKEMON_ICON_SIZE,
  POKEMON_ICON_TEXTURE,
  pokemonIconFrames,
  pokemonSoleDrop,
} from '../world/pokemonFigures';
import { TILE_SIZE } from '../worldMap';
import { layerBelow, pieceTiles, type PlacedPiece } from '../home/arrangement';
import type { FurnitureArt } from '../home/furniture';
import { FURNITURE_PIECES, FURNITURE_SHEET } from '../home/generated/furniturePieces';

/**
 * How a piece of the player's furniture is drawn (`home/furniture.ts`).
 *
 * Furniture is a sprite, never a tile, because the house's tiles are its
 * walls and floor and a piece stands on them: a mat over whatever floor it is
 * put on, a pot plant in front of the counter, a doll on a desk. Each kind of
 * thing is drawn in its own place in the order of things - a rug just over the
 * floor, everything that stands sorted by its bottom row with the figures, so
 * the player walks in front of a plant that is behind them, and a doll a hair
 * in front of the desk it stands on.
 */

/** The sheet the house's furniture is drawn from: loaded by `BootScene`. */
export const FURNITURE_TEXTURE = FURNITURE_SHEET.textureKey;
export const FURNITURE_PATH = FURNITURE_SHEET.imagePath;

/** Adds a frame for one piece to the furniture sheet, once. */
function sheetFrame(scene: Phaser.Scene, piece: keyof typeof FURNITURE_PIECES): string {
  const texture = scene.textures.get(FURNITURE_TEXTURE);
  if (!texture.has(piece)) {
    const at = FURNITURE_PIECES[piece];
    texture.add(piece, 0, at.column * TILE_SIZE, at.row * TILE_SIZE, at.width * TILE_SIZE, at.height * TILE_SIZE);
  }
  return piece;
}

/**
 * One facing of a piece, its top-left corner on a tile. A doll drawn from a
 * party icon stands as a Pokemon in the world does: centred on its tile, its
 * feet on the tile's last row.
 */
export function furnitureImage(
  scene: Phaser.Scene,
  art: FurnitureArt,
  x: number,
  y: number,
): Phaser.GameObjects.Image {
  if (art.kind === 'icon') {
    return scene.add
      .image(
        x * TILE_SIZE + TILE_SIZE / 2,
        (y + 1) * TILE_SIZE + pokemonSoleDrop(art.species),
        POKEMON_ICON_TEXTURE,
        pokemonIconFrames(art.species)[0],
      )
      .setOrigin(0.5, 1)
      .setFlipX(art.flip);
  }
  return scene.add
    .image(x * TILE_SIZE, y * TILE_SIZE, FURNITURE_TEXTURE, sheetFrame(scene, art.piece))
    .setOrigin(0, 0)
    .setFlipX(art.flip);
}

/** What a piece is a little in front of, if it stands on something: a doll on a desk. */
function host(piece: PlacedPiece, pieces: readonly PlacedPiece[]): PlacedPiece | undefined {
  const tiles = new Set(pieceTiles(piece).map((tile) => `${tile.x},${tile.y}`));
  return pieces.find(
    (other) =>
      other !== piece &&
      other.definition.layer === 'standing' &&
      layerBelow(other.definition, piece.definition) &&
      pieceTiles(other).some((tile) => tile.cell === 'T' && tiles.has(`${tile.x},${tile.y}`)),
  );
}

/** Where a piece is drawn in the order of things. */
export function furnitureDepth(piece: PlacedPiece, pieces: readonly PlacedPiece[]): number {
  if (piece.definition.layer === 'floor') {
    return FLOOR_FURNITURE_DEPTH;
  }
  const under = host(piece, pieces);
  if (under) {
    return furnitureDepth(under, pieces) + 0.0001;
  }
  // A hair behind a figure on the same row, so whoever sits in a chair is in it.
  return atRow(FIGURE_BAND, piece.y + piece.definition.height - 1) - 0.0002;
}

/** The ground a piece's art covers, in pixels: what a caption may not be seated over. */
export function furnitureRect(piece: PlacedPiece): Rect {
  const art = piece.definition.facings[piece.facing];
  if (art.kind === 'icon') {
    return {
      x: piece.x * TILE_SIZE + (TILE_SIZE - POKEMON_ICON_SIZE) / 2,
      y: (piece.y + 1) * TILE_SIZE - POKEMON_ICON_SIZE,
      width: POKEMON_ICON_SIZE,
      height: POKEMON_ICON_SIZE,
    };
  }
  return {
    x: piece.x * TILE_SIZE,
    y: piece.y * TILE_SIZE,
    width: piece.definition.width * TILE_SIZE,
    height: piece.definition.height * TILE_SIZE,
  };
}
