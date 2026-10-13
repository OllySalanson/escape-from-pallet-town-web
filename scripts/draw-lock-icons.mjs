// Draws the lock icons into public/assets/icons: the Lockpick a raid carries,
// the five keys that each open one map's locked exit, the Card Key a map file's
// locked exits open to, and the two things on the
// map they open - a locked gate (a keyed exit) and a locked crate.
//
//   node scripts/draw-lock-icons.mjs [--preview=<out.png>]
//
// 16x16 RGBA on the set's own rules (see ASSET_PROVENANCE.md): the shared
// outline #241f2e and a handful of tones each. Every key is one brass key with a
// bow of its own colour, because five keys that differ only in their name are
// five keys nobody can tell apart in a pack; the gate and the crate carry the
// same brass padlock so a lock reads as a lock wherever it is drawn.
//
// Written as character art for the same reason a map is: a grid of numbers
// cannot be looked at. `--preview` writes every icon side by side at eight
// times its size, which is how they were judged.
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

// A brass key lying flat: its bow on the left, the bit hanging under the far
// end of the shaft. Only the bow (b, B) changes from key to key.
const KEY_ROWS = [
  '................',
  '................',
  '................',
  '................',
  '..oooo..........',
  '.obbbbo.........',
  'obBooBbooooooooo',
  'obo..obllllllllo',
  'obo..obssssssddo',
  'obBooBboooolsodo',
  '.obbbbo...olsodo',
  '..oooo....oooooo',
  '................',
  '................',
  '................',
  '................',
];
const BRASS = { l: 'f1d27a', s: 'c79a3a', d: '8a6420' };
const key = (bow, bowShade) => ({ tones: { ...BRASS, b: bow, B: bowShade }, rows: KEY_ROWS });

// The padlock both locked things carry: a steel shackle over a brass body with
// a keyhole in it.
const PADLOCK = { y: 'f1c84a', Y: 'b8862a', k: '97a3b2' };

const ICONS = {
  lockpick: {
    // A hooked steel pick on a bound grip, lying corner to corner.
    tones: { l: 'd3dbe4', s: '97a3b2', h: '8a5a8c', H: '5c3a5e' },
    rows: [
      '................',
      '............oo..',
      '...........olso.',
      '............oso.',
      '...........olo..',
      '..........olo...',
      '.........olo....',
      '........olo.....',
      '.......olo......',
      '......ohho......',
      '.....ohHHo......',
      '....ohHHo.......',
      '...ohHHo........',
      '..ohHHo.........',
      '..oHHo..........',
      '...oo...........',
    ],
  },
  // The five keys, one a map, in the colours of where they are found.
  'weir-key': key('6fb0d8', '3f6f9d'),
  'paddock-key': key('d8a35a', '9a6a2c'),
  'forester-key': key('7cc06a', '3f7a34'),
  'garden-key': key('e88aa8', 'a8506c'),
  'market-key': key('c8443c', '86261f'),
  'card-key': {
    // FireRed's Card Key: a plastic card with a magnetic stripe and a brass
    // chip, not a key, because what it opens is a door made by a company.
    tones: { c: 'e8eef4', C: 'b8c4d0', m: '3f5f8f', y: 'f1c84a', Y: 'b8862a' },
    rows: [
      '................',
      '................',
      '................',
      'oooooooooooooooo',
      'occcccccccccccCo',
      'ommmmmmmmmmmmmmo',
      'ommmmmmmmmmmmmmo',
      'occcccccccccccCo',
      'ocoyyocccccccCCo',
      'ocoyYocccccccCCo',
      'ocoooocccCCCCCCo',
      'occcccccccccccCo',
      'oCCCCCCCCCCCCCCo',
      'oooooooooooooooo',
      '................',
      '................',
    ],
  },
  'locked-gate': {
    // A plank gate between two posts, padlocked shut across its middle rail.
    tones: { p: '6b4a2b', w: 'c9974a', W: '8a6430', ...PADLOCK },
    rows: [
      '................',
      'oo............oo',
      'opoooooooooooopo',
      'opwWwWwWwWwWwWpo',
      'opwWwWokkoWwWWpo',
      'opwWwWkookWwWWpo',
      'opooookookoooopo',
      'opwWoyyyyyyoWWpo',
      'opwWoyYooYyoWWpo',
      'opwWoyYooYyoWWpo',
      'opwWoyyyyyyoWWpo',
      'opwWooooooooWWpo',
      'opoooooooooooopo',
      'opwWwWwWwWwWwWpo',
      'opwWwWwWwWwWwWpo',
      'oooooooooooooooo',
    ],
  },
  'locked-crate': {
    // A wooden crate bound in iron, with the padlock on its hasp.
    tones: { l: 'd09a5a', w: 'b07a44', W: '8a5a2c', i: '6a6f7a', ...PADLOCK },
    rows: [
      '................',
      '................',
      '.oooooooooooooo.',
      '.olllllllllllWo.',
      '.oiiiiiiiiiiiio.',
      '.owwwwokkowwwWo.',
      '.owwwwkookwwwWo.',
      '.oiiiikookiiiio.',
      '.owwoyyyyyyowWo.',
      '.owwoyYooYyowWo.',
      '.owwoyYooYyowWo.',
      '.owwoyyyyyyowWo.',
      '.oiiooooooooiio.',
      '.oWWWWWWWWWWWWo.',
      '.oooooooooooooo.',
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

const drawn = Object.entries(ICONS).map(([name, { tones, rows }]) => {
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
  return rgba;
});

const preview = process.argv.find((value) => value.startsWith('--preview='))?.slice('--preview='.length);
if (preview) {
  const zoom = 8;
  const cell = SIZE * zoom + 8;
  const width = cell * drawn.length;
  const sheet = Buffer.alloc(width * cell * 4);
  for (let p = 0; p < sheet.length; p += 4) sheet.set([120, 168, 104, 255], p);
  drawn.forEach((rgba, index) => {
    for (let y = 0; y < SIZE * zoom; y += 1) {
      for (let x = 0; x < SIZE * zoom; x += 1) {
        const from = (Math.floor(y / zoom) * SIZE + Math.floor(x / zoom)) * 4;
        if (rgba[from + 3] === 0) continue;
        rgba.copy(sheet, ((y + 4) * width + index * cell + x + 4) * 4, from, from + 4);
      }
    }
  });
  writeFileSync(preview, encodePng(width, cell, sheet));
}
console.log(`drew ${drawn.length} lock icons`);
