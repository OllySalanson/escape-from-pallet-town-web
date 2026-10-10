// Draws the dig icons into public/assets/icons: the Pickaxe a raid carries and
// the rubble a buried exit is drawn as until one digs it out.
//
//   node scripts/draw-dig-icons.mjs
//
// 16x16 RGBA on the set's own rules (see ASSET_PROVENANCE.md): the shared
// outline #241f2e and a handful of tones each. The pickaxe is steel on a wooden
// haft, drawn upright so the head reads as a T at 16px; the rubble is a heap of
// warm grey stones, a colour of its own so it is never mistaken for FireRed's
// cracked Rock Smash rock, which is a door rather than a way out.
//
// Written as character art for the same reason a map is: a grid of numbers
// cannot be looked at.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const SIZE = 16;
const OUT = new URL('../public/assets/icons/', import.meta.url);

const hex = (value) => [
  parseInt(value.slice(0, 2), 16),
  parseInt(value.slice(2, 4), 16),
  parseInt(value.slice(4, 6), 16),
  255,
];

const ICONS = {
  pickaxe: {
    tones: { l: 'd3dbe4', s: '97a3b2', d: '5e6a7a', w: 'c9974a', W: '8a6430' },
    rows: [
      '................',
      '....oooooooo....',
      '..oollllllssoo..',
      '.olssoowWoosddo.',
      '.oso..owWo..odo.',
      'oso...owWo...odo',
      'oo....owWo....oo',
      '......owWo......',
      '......owWo......',
      '......owWo......',
      '......owWo......',
      '......owWo......',
      '......owWo......',
      '......owWo......',
      '......oooo......',
      '................',
    ],
  },
  rubble: {
    tones: { l: 'd8cfbd', s: 'a0967f', d: '6a604f', D: '463e33' },
    rows: [
      '................',
      '................',
      '................',
      '......oooo......',
      '.....ollsso.....',
      '....olssssdo....',
      '..oooossddooo...',
      '.ollsoooddolso..',
      '.olssslooolssdo.',
      'olssssdlllssddo.',
      'olsddssdsssdddDo',
      'olssooolssdooddo',
      'osddollsssdolsdo',
      'oddDosssddDosddo',
      '.ooooooooooooooo',
      '................',
    ],
  },
};

const OUTLINE = hex('241f2e');

function crc32(bytes) {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function encodePng(width, height, rgba) {
  const chunk = (type, body) => {
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
  for (let y = 0; y < height; y += 1) {
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, { tones, rows }] of Object.entries(ICONS)) {
  if (rows.length !== SIZE) throw new Error(`${name}: expected ${SIZE} rows, got ${rows.length}`);
  const rgba = Buffer.alloc(SIZE * SIZE * 4);
  rows.forEach((row, y) => {
    if (row.length !== SIZE) throw new Error(`${name}: row ${y} is ${row.length} wide: "${row}"`);
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const colour = ch === 'o' ? OUTLINE : tones[ch] ? hex(tones[ch]) : null;
      if (!colour) throw new Error(`${name}: no colour "${ch}"`);
      Buffer.from(colour).copy(rgba, (y * SIZE + x) * 4);
    });
  });
  writeFileSync(new URL(`${name}.png`, OUT), encodePng(SIZE, SIZE, rgba));
}
console.log(`drew ${Object.keys(ICONS).length} dig icons`);
