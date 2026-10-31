import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { decodePng, type PngPixels } from '../testing/pngPixels';
import { PACK_IDS } from './packs';

const SIZE = 16;
/** The one outline every icon in the set is drawn in (`scripts/draw-pack-icons.mjs`). */
const OUTLINE = [0x24, 0x1f, 0x2e];

const iconOf = async (id: string): Promise<PngPixels> =>
  decodePng(await readFile(new URL(`../../../public/assets/icons/${id}.png`, import.meta.url)));

const opaque = (icon: PngPixels, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < SIZE && y < SIZE && icon.at(x, y)[3] > 0;

const rowsTall = (icon: PngPixels): number => {
  const filled = Array.from({ length: SIZE }, (_, y) => y).filter((y) =>
    Array.from({ length: SIZE }, (_, x) => x).some((x) => opaque(icon, x, y)),
  );
  return filled.length;
};

/**
 * A pack's icon is the picture of it on every screen (what it looks like on a
 * figure's back is `look/wornPack.ts`). Its rows are typed by hand and the script only checks that
 * each is sixteen long, which a row a pixel short and padded with a dot passes.
 * That is how the Hauler frame shipped with a right side that stepped in and out
 * twice and two bare posts at each end, which read as a creature with horns and
 * legs stuck on one frame.
 */
describe('the pack icons', () => {
  it.each(PACK_IDS)('%s has the same outline down both sides', async (id) => {
    const icon = await iconOf(id);
    const crooked: string[] = [];
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE / 2; x += 1) {
        if (opaque(icon, x, y) !== opaque(icon, SIZE - 1 - x, y)) {
          crooked.push(`row ${y}, columns ${x} and ${SIZE - 1 - x}`);
        }
      }
    }
    expect(crooked).toEqual([]);
  });

  it.each(PACK_IDS)('%s is closed all the way round', async (id) => {
    const icon = await iconOf(id);
    const open: string[] = [];
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        if (!opaque(icon, x, y)) {
          continue;
        }
        const onTheEdge = [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ].some(([nx, ny]) => !opaque(icon, nx, ny));
        if (onTheEdge && icon.at(x, y).slice(0, 3).join() !== OUTLINE.join()) {
          open.push(`${x},${y}`);
        }
      }
    }
    expect(open).toEqual([]);
  });

  it('grows with what it holds, so the four are told apart without the word beside them', async () => {
    const heights = await Promise.all(PACK_IDS.map(async (id) => rowsTall(await iconOf(id))));
    expect(heights).toEqual([...heights].sort((a, b) => a - b));
    expect(new Set(heights).size).toBe(PACK_IDS.length);
  });
});
