// Draws the Pokedollar sign into public/assets/battle/pokedollar.ttf.
//
//   node scripts/draw-pokedollar-glyph.mjs
//
// Orange Kid, the game's one typeface, has no glyph for U+20BD - the P with a
// bar that everybody types for the Pokedollar - so every amount of money would
// otherwise come out in whatever face the browser falls back to, beside digits
// in the pixel font. This is that one glyph and nothing else: a TrueType font
// joined to the game's family in `src/style.css` by `unicode-range`, so the
// browser takes the sign from here and every other character from Orange Kid,
// on a DOM screen and in a canvas scene alike.
//
// It is drawn on Orange Kid's own grid rather than beside it. That face is set
// in cells of about 74 units on a 1000-unit em, with an 80-unit stem, and its P
// is five cells wide and eight tall with its bowl's corners knocked off; the
// sign below is that P with its stem moved in a cell and two bars through it,
// which is how these games draw it. Its vertical metrics are Orange Kid's own,
// copied number for number, so a line with a price in it is exactly as tall as
// a line without one.
//
// Written by hand, like the PNGs the icon scripts write, so the script needs no
// dependency and the file is byte-stable. The font is CC0, as Orange Kid is.
import { writeFileSync } from 'node:fs';

const OUT = new URL('../public/assets/battle/pokedollar.ttf', import.meta.url);

/** Orange Kid's cell edges: x across its P, y up its cap height. */
const X = [40, 114, 194, 268, 342, 416];
const Y = [0, 74, 148, 222, 296, 370, 444, 518, 599];

// Top row first, one character a cell. The stem is the second column.
const SIGN = [
  '.###.',
  '.#..#',
  '.#..#',
  '####.',
  '.#...',
  '###..',
  '.#...',
  '.#...',
];

const ADVANCE = 456; // Orange Kid's P, $ and the yen sign: five cells and a gap.
const CODE_POINT = 0x20bd;

// Orange Kid's vertical metrics, as its own tables state them.
const METRICS = {
  unitsPerEm: 1000,
  ascender: 978,
  descender: -222,
  lineGap: 0,
  typoAscender: 599,
  typoDescender: -222,
  typoLineGap: 200,
  winAscent: 978,
  winDescent: 222,
  xHeight: 451,
  capHeight: 599,
};

// --- The outline ------------------------------------------------------------

/** One rectangle a run of filled cells in a row, all wound the same way. */
const rectangles = SIGN.flatMap((row, fromTop) => {
  const y = SIGN.length - 1 - fromTop;
  const runs = [];
  let start = -1;
  [...`${row}.`].forEach((cell, x) => {
    if (cell === '#' && start < 0) start = x;
    if (cell !== '#' && start >= 0) {
      runs.push({ x0: X[start], x1: X[x], y0: Y[y], y1: Y[y + 1] });
      start = -1;
    }
  });
  return runs;
});

// Clockwise, as TrueType winds a filled contour. Runs that touch share an edge
// and are filled by the non-zero rule as one shape.
const contours = rectangles.map(({ x0, x1, y0, y1 }) => [
  [x0, y0],
  [x0, y1],
  [x1, y1],
  [x1, y0],
]);
const points = contours.flat();
const bounds = {
  xMin: Math.min(...points.map(([x]) => x)),
  xMax: Math.max(...points.map(([x]) => x)),
  yMin: Math.min(...points.map(([, y]) => y)),
  yMax: Math.max(...points.map(([, y]) => y)),
};

// --- Tables -----------------------------------------------------------------

const u16 = (value) => {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(value & 0xffff);
  return b;
};
const i16 = (value) => {
  const b = Buffer.alloc(2);
  b.writeInt16BE(value);
  return b;
};
const u32 = (value) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(value >>> 0);
  return b;
};
const cat = (...parts) => Buffer.concat(parts);

/** Glyph 0 is .notdef and empty; glyph 1 is the sign. */
const signGlyph = cat(
  i16(contours.length),
  i16(bounds.xMin),
  i16(bounds.yMin),
  i16(bounds.xMax),
  i16(bounds.yMax),
  ...contours.map((_, index) => u16((index + 1) * 4 - 1)),
  u16(0), // no instructions
  Buffer.alloc(points.length, 0x01), // every point on the curve, coordinates as words
  ...points.map(([x], index) => i16(x - (index === 0 ? 0 : points[index - 1][0]))),
  ...points.map(([, y], index) => i16(y - (index === 0 ? 0 : points[index - 1][1]))),
);
const glyf = cat(signGlyph, Buffer.alloc((4 - (signGlyph.length % 4)) % 4));
const loca = cat(u32(0), u32(0), u32(glyf.length)); // long offsets

const head = cat(
  u32(0x00010000), // version
  u32(0x00010000), // fontRevision
  u32(0), // checkSumAdjustment, written last
  u32(0x5f0f3cf5), // magic
  u16(0b1011), // baseline and left sidebearing at 0, integer ppem
  u16(METRICS.unitsPerEm),
  Buffer.alloc(16), // created and modified: zero, so the file is byte-stable
  i16(bounds.xMin),
  i16(bounds.yMin),
  i16(bounds.xMax),
  i16(bounds.yMax),
  u16(0), // macStyle
  u16(8), // lowestRecPPEM
  i16(2), // fontDirectionHint
  i16(1), // indexToLocFormat: long
  i16(0), // glyphDataFormat
);

const hhea = cat(
  u32(0x00010000),
  i16(METRICS.ascender),
  i16(METRICS.descender),
  i16(METRICS.lineGap),
  u16(ADVANCE),
  i16(bounds.xMin), // minLeftSideBearing
  i16(ADVANCE - bounds.xMax), // minRightSideBearing
  i16(bounds.xMax), // xMaxExtent
  i16(1), // caretSlopeRise
  i16(0), // caretSlopeRun
  i16(0), // caretOffset
  Buffer.alloc(8),
  i16(0), // metricDataFormat
  u16(2), // numberOfHMetrics
);

const hmtx = cat(u16(ADVANCE), i16(0), u16(ADVANCE), i16(bounds.xMin));

const maxp = cat(
  u32(0x00010000),
  u16(2), // numGlyphs
  u16(points.length), // maxPoints
  u16(contours.length), // maxContours
  u16(0),
  u16(0),
  u16(2), // maxZones
  ...Array.from({ length: 7 }, () => u16(0)),
  u16(0), // maxComponentElements
  u16(0), // maxComponentDepth
);

const os2 = cat(
  u16(4), // version
  i16(ADVANCE), // xAvgCharWidth
  u16(400), // usWeightClass
  u16(5), // usWidthClass
  u16(0), // fsType: installable
  i16(650), i16(600), i16(0), i16(75), // subscript size and offset
  i16(650), i16(600), i16(0), i16(350), // superscript size and offset
  i16(50), // yStrikeoutSize
  i16(259), // yStrikeoutPosition
  i16(0), // sFamilyClass
  Buffer.alloc(10), // panose
  u32(0), u32(1 << 1), u32(0), u32(0), // ulUnicodeRange: bit 33, currency symbols
  Buffer.from('NONE', 'ascii'),
  u16(0x40), // fsSelection: regular, as Orange Kid's is
  u16(CODE_POINT), // usFirstCharIndex
  u16(CODE_POINT), // usLastCharIndex
  i16(METRICS.typoAscender),
  i16(METRICS.typoDescender),
  i16(METRICS.typoLineGap),
  u16(METRICS.winAscent),
  u16(METRICS.winDescent),
  u32(1), // ulCodePageRange1: Latin 1
  u32(0),
  i16(METRICS.xHeight),
  i16(METRICS.capHeight),
  u16(0), // usDefaultChar
  u16(0x20), // usBreakChar
  u16(0), // usMaxContext
);

// One segment for the sign and the terminator format 4 always ends on.
const segments = [
  { start: CODE_POINT, end: CODE_POINT, delta: 1 - CODE_POINT },
  { start: 0xffff, end: 0xffff, delta: 1 },
];
const format4 = cat(
  u16(4),
  u16(16 + segments.length * 8), // length
  u16(0), // language
  u16(segments.length * 2), // segCountX2
  u16(4), // searchRange
  u16(1), // entrySelector
  u16(0), // rangeShift
  ...segments.map(({ end }) => u16(end)),
  u16(0),
  ...segments.map(({ start }) => u16(start)),
  ...segments.map(({ delta }) => u16(delta)),
  ...segments.map(() => u16(0)),
);
const cmap = cat(u16(0), u16(2), u16(0), u16(3), u32(20), u16(3), u16(1), u32(20), format4);

const NAMES = {
  0: 'The Pokedollar sign for Escape from Pallet Town, drawn on Orange Kid. CC0.',
  1: 'Pokedollar Sign',
  2: 'Regular',
  3: 'Pokedollar Sign Regular',
  4: 'Pokedollar Sign',
  5: 'Version 1.000',
  6: 'PokedollarSign-Regular',
};
const nameRecords = Object.entries(NAMES).map(([id, text]) => ({ id: Number(id), text: Buffer.from(text, 'utf16le').swap16() }));
let nameOffset = 0;
const name = cat(
  u16(0),
  u16(nameRecords.length),
  u16(6 + nameRecords.length * 12),
  ...nameRecords.map(({ id, text }) => {
    const record = cat(u16(3), u16(1), u16(0x409), u16(id), u16(text.length), u16(nameOffset));
    nameOffset += text.length;
    return record;
  }),
  ...nameRecords.map(({ text }) => text),
);

const post = cat(u32(0x00030000), u32(0), i16(-75), i16(50), u32(0), u32(0), u32(0), u32(0), u32(0));

// --- The file ---------------------------------------------------------------

const tables = { 'OS/2': os2, cmap, glyf, head, hhea, hmtx, loca, maxp, name, post };
const tags = Object.keys(tables).sort();
const padded = (buffer) => cat(buffer, Buffer.alloc((4 - (buffer.length % 4)) % 4));
const checksum = (buffer) => {
  const data = padded(buffer);
  let sum = 0;
  for (let offset = 0; offset < data.length; offset += 4) sum = (sum + data.readUInt32BE(offset)) >>> 0;
  return sum;
};

const entrySelector = Math.floor(Math.log2(tags.length));
const searchRange = 2 ** entrySelector * 16;
const directory = [cat(u32(0x00010000), u16(tags.length), u16(searchRange), u16(entrySelector), u16(tags.length * 16 - searchRange))];
let offset = 12 + tags.length * 16;
const bodies = [];
for (const tag of tags) {
  const table = tables[tag];
  directory.push(cat(Buffer.from(tag.padEnd(4), 'ascii'), u32(checksum(table)), u32(offset), u32(table.length)));
  bodies.push(padded(table));
  offset += padded(table).length;
}
const font = cat(...directory, ...bodies);
const headOffset = 12 + tags.length * 16 + bodies.slice(0, tags.indexOf('head')).reduce((sum, body) => sum + body.length, 0);
font.writeUInt32BE((0xb1b0afba - checksum(font)) >>> 0, headOffset + 8);

writeFileSync(OUT, font);
console.log(`battle/pokedollar.ttf: ${rectangles.length} runs, ${font.length} bytes`);
