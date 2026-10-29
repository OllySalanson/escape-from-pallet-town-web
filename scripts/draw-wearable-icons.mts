// Draws the icon of every piece a raid can find, into public/assets/icons: the
// piece worn on the starter look - the head for a hat or hair, the body for
// anything worn lower - which is what a find in the pack looks like: a little
// person in it.
//
//   npx vite-node scripts/draw-wearable-icons.mts
//
// It composes with the game's own `composeLook` from the cut pieces
// (`public/assets/wearables.png`), so an icon is the piece as it is worn.
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { decodePng } from '../src/game/testing/pngPixels';
import { composeLook, PIECE_WIDTH } from '../src/game/look/composeLook';
import { STARTER_LOOK } from '../src/game/look/look';
import { RAID_WEARABLES, slotOf } from '../src/game/look/wearables';

const SIZE = 16;
/**
 * The rows of the down-facing standing frame an icon is: a head from the top
 * of a tall hat to the chest, anything worn lower from the chin to the soles.
 */
const HEAD_FROM_ROW = 7;
const BODY_FROM_ROW = 12;

const sheet = decodePng(readFileSync(new URL('../public/assets/wearables.png', import.meta.url)));
const data = new Uint8Array(sheet.width * sheet.height * 4);
for (let y = 0; y < sheet.height; y += 1) {
  for (let x = 0; x < sheet.width; x += 1) data.set(sheet.at(x, y), (y * sheet.width + x) * 4);
}
const atlas = { width: sheet.width, height: sheet.height, data };

function crc32(bytes: Uint8Array): number {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const chunk = (type: string, body: Buffer) => {
    const out = Buffer.alloc(body.length + 12);
    out.writeUInt32BE(body.length, 0);
    out.write(type, 4, 'ascii');
    body.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) Buffer.from(rgba.subarray(y * width * 4, (y + 1) * width * 4)).copy(raw, y * (width * 4 + 1) + 1);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const piece of RAID_WEARABLES) {
  const slot = slotOf(piece);
  const from = slot === 'head' ? HEAD_FROM_ROW : BODY_FROM_ROW;
  const look = { ...STARTER_LOOK, [slot]: piece.id };
  const pixels = composeLook(atlas, look);
  const icon = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const at = ((from + y) * PIECE_WIDTH + x) * 4;
      icon.set(pixels.subarray(at, at + 4), (y * SIZE + x) * 4);
    }
  }
  writeFileSync(new URL(`../public/assets/icons/${piece.id}.png`, import.meta.url), encodePng(SIZE, SIZE, icon));
  console.log(`drew icons/${piece.id}.png`);
}
