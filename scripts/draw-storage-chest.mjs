// Draws THE CHEST, the player's storage in THE BOLTHOLE (`home/furniture.ts`),
// into public/assets/storage-chest.png: two 32x24 frames side by side, the
// chest shut and the chest with its lid thrown back, which is what the player
// sees for a moment before the chest's screen opens. The chest stands on two
// tiles and its lid rises half a tile above them, so it reads past the head of
// a player standing in front of it.
//
//   node scripts/draw-storage-chest.mjs
//
// It is drawn in the smugglers' `sea-chest` icon's colours (`draw-relic-icons.mjs`),
// the same oak, iron bands and brass lock, so the thing a player keeps their
// finds in at home looks like the thing they dug a treasure out of. The open
// frame is the lid's dark inside, raised, and gold catching the light in the
// chest's mouth.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const WIDTH = 32;
const HEIGHT = 24;
const FRAMES = 2;
const OUT = new URL('../public/assets/storage-chest.png', import.meta.url);

const hex = (value) => [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16), 255];
const C = {
  o: hex('241f2e'),
  // oak, iron bands and a brass lock - the sea chest's own colours
  d: hex('5a3820'), D: hex('8c5a2e'), B: hex('b98048'), i: hex('4a4a58'), I: hex('8a8aa0'), y: hex('d9a520'), Y: hex('f6d860'),
  // the dark inside of the chest
  k: hex('1a1418'),
};

/** A blank frame, a row an array of colour keys. */
const blank = () => Array.from({ length: HEIGHT }, () => Array.from({ length: WIDTH }, () => '.'));
const rect = (frame, x0, y0, x1, y1, key) => {
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) frame[y][x] = key;
};
/** A box with a one-pixel outline and its two top corners cut, as the icon set draws a lid. */
const box = (frame, x0, y0, x1, y1, fill) => {
  rect(frame, x0, y0, x1, y1, 'o');
  rect(frame, x0 + 1, y0 + 1, x1 - 1, y1 - 1, fill);
  frame[y0][x0] = '.';
  frame[y0][x1] = '.';
};
/** The brass lock plate: outlined, square-cornered, sitting on the wood. */
const plate = (frame, x0, y0, x1, y1) => {
  rect(frame, x0, y0, x1, y1, 'o');
  rect(frame, x0 + 1, y0 + 1, x1 - 1, y1 - 1, 'y');
};
/** The two iron bands that run down the chest, a shadow and a shine. */
const bands = (frame, y0, y1) => {
  for (const x of [8, 22]) {
    rect(frame, x, y0, x, y1, 'i');
    rect(frame, x + 1, y0, x + 1, y1, 'I');
  }
};

/** The body: two tiles wide, one tile tall, standing on the tile's last row. */
function body(frame) {
  box(frame, 0, 13, 31, 23, 'D');
  rect(frame, 1, 22, 30, 22, 'd');
  rect(frame, 1, 14, 30, 14, 'B');
  bands(frame, 14, 22);
}

// Shut: the lid's dome over the body, an iron rim between, and the lock.
const shut = blank();
body(shut);
box(shut, 1, 6, 30, 14, 'D');
rect(shut, 2, 7, 29, 7, 'B');
rect(shut, 2, 8, 29, 8, 'B');
bands(shut, 7, 13);
rect(shut, 1, 13, 30, 13, 'i');
rect(shut, 1, 14, 30, 14, 'I');
plate(shut, 13, 11, 18, 17);
rect(shut, 14, 12, 17, 12, 'Y');
rect(shut, 15, 14, 16, 15, 'o');

// Open: the lid thrown back above the body, its dark underside showing, and
// the brass light of what is inside in the chest's mouth.
const open = blank();
body(open);
box(open, 1, 1, 30, 9, 'd');
rect(open, 2, 8, 29, 8, 'k');
bands(open, 2, 7);
rect(open, 1, 9, 30, 9, 'o');
plate(open, 13, 7, 18, 11);
rect(open, 14, 8, 17, 8, 'Y');
// The chest's mouth, from the lid's hinge down to the front edge.
rect(open, 0, 10, 31, 16, 'o');
rect(open, 1, 10, 30, 15, 'k');
for (const x of [4, 5, 10, 11, 12, 19, 20, 26, 27]) open[14][x] = 'Y';
for (const x of [3, 6, 9, 13, 14, 17, 18, 21, 25, 28]) open[15][x] = 'y';
for (const x of [7, 16, 23]) open[13][x] = 'y';

const frames = [shut, open];
const table = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};

const width = WIDTH * FRAMES;
const raw = Buffer.alloc((width * 4 + 1) * HEIGHT);
for (let y = 0; y < HEIGHT; y += 1) {
  const base = y * (width * 4 + 1);
  raw[base] = 0;
  frames.forEach((frame, index) => {
    frame[y].forEach((key, x) => {
      raw.set(C[key] ?? [0, 0, 0, 0], base + 1 + (index * WIDTH + x) * 4);
    });
  });
}
const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0);
header.writeUInt32BE(HEIGHT, 4);
header.set([8, 6, 0, 0, 0], 8);
writeFileSync(
  OUT,
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]),
);
console.log('storage-chest.png');
