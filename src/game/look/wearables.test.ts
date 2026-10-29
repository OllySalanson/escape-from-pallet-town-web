import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getItemById, isFoundOnly, ItemCategory, MATERIAL_IDS } from '../items/items';
import { BUILT_IN_FILE_PRIZES } from '../world/filePrizes';
import { decodePng } from '../testing/pngPixels';
import { composeLook, PIECE_HEIGHT, PIECE_WIDTH } from './composeLook';
import { WEARABLE_PIECES } from './generated/wearablePieces';
import { STARTER_LOOK, type DressedLook } from './look';
import { BOUTIQUE_NAME, RAID_WEARABLES, slotOf, STARTER_WEARABLES, WEARABLES, wearableById } from './wearables';

const sheet = decodePng(readFileSync(new URL('../../../public/assets/wearables.png', import.meta.url)));
const data = new Uint8Array(sheet.width * sheet.height * 4);
for (let y = 0; y < sheet.height; y += 1) {
  for (let x = 0; x < sheet.width; x += 1) data.set(sheet.at(x, y), (y * sheet.width + x) * 4);
}
const atlas = { width: sheet.width, height: sheet.height, data };

/** A look with one piece on it, over the starter pieces. */
function dressedIn(id: string): DressedLook {
  const piece = wearableById(id)!;
  return { ...STARTER_LOOK, [slotOf(piece)]: piece.id };
}

const pixelsOf = (look: DressedLook): Uint8ClampedArray => composeLook(atlas, look);

/** How many pixels a piece draws over all sixteen frames, alone. */
function ownPixels(pieceId: keyof typeof WEARABLE_PIECES): number {
  const { cell } = WEARABLE_PIECES[pieceId];
  const left = (cell % 16) * PIECE_WIDTH;
  const top = Math.floor(cell / 16) * PIECE_HEIGHT;
  let count = 0;
  for (let y = 0; y < PIECE_HEIGHT; y += 1) {
    for (let x = 0; x < PIECE_WIDTH; x += 1) if (atlas.data[((top + y) * atlas.width + left + x) * 4 + 3]) count += 1;
  }
  return count;
}

describe("THE HARBOUR BOUTIQUE's catalogue", () => {
  it('is named in one place', () => {
    expect(BOUTIQUE_NAME).toBe('THE HARBOUR BOUTIQUE');
  });

  it('holds well over a hundred pieces, every id and name its own', () => {
    expect(WEARABLES.length).toBeGreaterThan(150);
    expect(new Set(WEARABLES.map((piece) => piece.id)).size).toBe(WEARABLES.length);
    expect(new Set(WEARABLES.map((piece) => piece.name)).size).toBe(WEARABLES.length);
    // Over a hundred different shapes before a single dye, which is the count that matters.
    expect(new Set(WEARABLES.map((piece) => piece.piece)).size).toBeGreaterThan(110);
  });

  it('cuts every piece it sells, and wears each in the slot its art is', () => {
    for (const piece of WEARABLES) {
      expect([piece.id, piece.piece in WEARABLE_PIECES]).toEqual([piece.id, true]);
      const slot = slotOf(piece);
      const expected = piece.kind === 'hat' || piece.kind === 'hair' ? 'head' : piece.kind === 'outfit' ? 'body' : piece.kind;
      expect([piece.id, slot]).toEqual([piece.id, expected]);
    }
  });

  it('prices money pieces in money, barter pieces in found goods only, and raid finds not at all', () => {
    for (const piece of WEARABLES) {
      switch (piece.rarity) {
        case 'starter':
          expect([piece.id, piece.price, piece.barter]).toEqual([piece.id, undefined, undefined]);
          break;
        case 'everyday':
        case 'smart':
        case 'fine':
          expect([piece.id, (piece.price ?? 0) > 0, piece.barter]).toEqual([piece.id, true, undefined]);
          break;
        case 'barter':
          expect([piece.id, piece.price]).toEqual([piece.id, undefined]);
          // The best things cannot be bought at any price: never money, only what a raid finds.
          for (const itemId of Object.keys(piece.barter ?? {})) {
            expect([piece.id, MATERIAL_IDS.includes(itemId as never)]).toEqual([piece.id, true]);
          }
          break;
        case 'raid':
          expect([piece.id, piece.price, piece.barter]).toEqual([piece.id, undefined, undefined]);
          break;
      }
    }
  });

  it('prices the tiers in order: everyday under smart under fine', () => {
    const prices = (rarity: string) => WEARABLES.filter((piece) => piece.rarity === rarity).map((piece) => piece.price ?? 0);
    expect(Math.max(...prices('everyday'))).toBeLessThan(Math.min(...prices('fine')));
    expect(Math.max(...prices('smart'))).toBeLessThan(Math.min(...prices('fine')));
    expect(Math.min(...prices('everyday'))).toBeGreaterThan(0);
  });

  it('gives everybody a whole figure to start from', () => {
    expect(STARTER_WEARABLES).toEqual(['short-crop', 'plain-tee', 'plain-trousers']);
  });

  it('draws every piece crisp, on the sole line, in all sixteen frames', () => {
    const faults: string[] = [];
    for (const piece of WEARABLES) {
      const pixels = pixelsOf(dressedIn(piece.id));
      for (let frame = 0; frame < 16; frame += 1) {
        const left = (frame % 4) * 16;
        const top = Math.floor(frame / 4) * 32;
        let drawn = 0;
        for (let y = 0; y < 32; y += 1) {
          for (let x = 0; x < 16; x += 1) {
            const alpha = pixels[((top + y) * PIECE_WIDTH + left + x) * 4 + 3];
            // Nothing half-drawn: a pixel is there or it is not.
            if (alpha !== 0 && alpha !== 255) faults.push(`${piece.id} frame ${frame}: a soft pixel at ${x},${y}`);
            if (alpha === 0) continue;
            drawn += 1;
            // Nothing below the soles: a foot under them stands on the next tile.
            if (y > 27) faults.push(`${piece.id} frame ${frame}: a pixel under the soles at ${x},${y}`);
          }
        }
        // A whole figure in every frame: no step that loses a leg or a head.
        if (drawn < 100) faults.push(`${piece.id} frame ${frame}: only ${drawn} pixels drawn`);
      }
    }
    expect(faults).toEqual([]);
    expect(PIECE_HEIGHT).toBe(128);
  });

  it('makes every colour variant clearly another colour of its piece', () => {
    for (const piece of WEARABLES.filter((each) => each.dye)) {
      const plain = WEARABLES.find((each) => each.piece === piece.piece && !each.dye);
      expect([piece.id, plain !== undefined]).toEqual([piece.id, true]);
      const a = pixelsOf(dressedIn(piece.id));
      const b = pixelsOf(dressedIn(plain!.id));
      let differ = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) differ += 1;
      }
      // A good part of the piece changes colour - the whole cap, not a stray outline.
      const own = ownPixels(piece.piece);
      expect([piece.id, differ >= Math.max(own / 4, 16 * 6)]).toEqual([piece.id, true]);
    }
  });
});

describe("the boutique's raid finds", () => {
  it('is each an item of its own id, found and never packed, laid in Greystone Vale as a prize', () => {
    const laid = new Set((BUILT_IN_FILE_PRIZES['greystone-vale'] ?? []).map((prize) => prize.itemId as string));
    expect(RAID_WEARABLES.length).toBeGreaterThanOrEqual(12);
    for (const piece of RAID_WEARABLES) {
      const item = getItemById(piece.id);
      expect([piece.id, item?.category, item?.effect.type]).toEqual([piece.id, ItemCategory.Wearable, 'wearable']);
      expect([piece.id, isFoundOnly(piece.id), laid.has(piece.id)]).toEqual([piece.id, true, true]);
    }
  });

  it('is rarer than any find but the Bicycle', () => {
    for (const prize of BUILT_IN_FILE_PRIZES['greystone-vale'] ?? []) {
      if (!RAID_WEARABLES.some((piece) => piece.id === prize.itemId)) continue;
      expect([prize.itemId, prize.chance > 0.05 && prize.chance <= 0.08]).toEqual([prize.itemId, true]);
    }
  });
});
