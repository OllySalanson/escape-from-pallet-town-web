// Cuts the boutique's wearables out of FireRed's own people, so the player's
// look is layered from pieces drawn in exactly the overworld's style.
//
//   git clone --filter=blob:none --no-checkout https://github.com/pret/pokefirered.git <dir>
//   git -C <dir> checkout 037335f -- graphics/object_events/pics/people
//   git clone --filter=blob:none --no-checkout https://github.com/pret/pokeemerald.git <emerald>
//   git -C <emerald> checkout 731ad5b -- graphics/object_events/pics/people
//   node scripts/cut-frlg-wearables.mjs <dir> --emerald=<emerald> [--preview=<out.png>]
//
// Why this works at all: FireRed draws most of its people on one shared body.
// A youngster, a camper, Blue, a scientist and a Rocket grunt are the same
// sixteen-by-thirty-two figure in every facing and every step, with different
// colours and a different head - the eyes sit on the same row, the chin on the
// same row, and every step lowers the whole figure one pixel. So a piece cut
// from one of them by *position* fits all of the others in every frame by
// construction, and that is the rule this script holds every piece to.
//
// The regions are read off one reference figure, FireRed's `boy`, whose
// colours say what each pixel is (skin, hair, shirt, trousers): `HEAD` is
// everything above the shoulders, `TOP` the shirt and the arms, `LEGS` the
// trousers and the feet, and an outline pixel belongs to whatever it outlines.
// Every other figure's pixel takes the region of the reference pixel at the
// same place (or the nearest one, where the figure is drawn wider), so a top
// and a pair of trousers from two different people always meet on the same
// seam. A head is the one piece that needs no walk of its own: FireRed's steps
// lower the head a pixel and change nothing else about it, so a head is cut
// from the three standing frames and the gym leaders, who are drawn standing,
// lend theirs too. A whole outfit (`BODY`: top and legs as one) is cut from a
// figure whose walk is its own - a skirt or a long coat - and is worn alone.
//
// A piece is refused when the figure it is cut from is not the shared body in
// that region in every frame (`MAX_REGION_DRIFT`): if a piece cannot look right
// in every frame it is left out. Nothing from pret is committed: what ships is
// the cut pieces, rearranged into the grid `src/game/playerFrames.ts` reads,
// and `public/assets/ASSET_PROVENANCE.md` credits the origin.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';

const FRAME = 16;
const HEIGHT = 32;
/** The game's sole line (`CHARACTER_FEET_PIXEL_Y`). pret stands people on row 30. */
const FEET_PIXEL_Y = 27;
/** pret's frames for each facing: idle, first step, second step. */
const SOURCE_FRAMES = { down: [0, 3, 4], up: [1, 5, 6], left: [2, 7, 8] };
/** The output grid: rows down, right, up, left; columns idle, step, idle, step. */
const OUTPUT_FACINGS = ['down', 'right', 'up', 'left'];
const OUTPUT_COLUMNS = [0, 1, 0, 2];
const PIECE_WIDTH = FRAME * OUTPUT_COLUMNS.length;
const PIECE_HEIGHT = HEIGHT * OUTPUT_FACINGS.length;
const ATLAS_COLUMNS = 16;
/** Below this many differing pixels over all sixteen frames, two pieces read as one. */
const NEAR_DUPLICATE_PIXELS = 120;

/** How many pixels of a region may differ from the reference before a piece is refused. */
const MAX_REGION_DRIFT = { HEAD: Infinity, TOP: 12, LEGS: 12, BODY: Infinity };

/**
 * The reference's colours, by what they are. `boy`'s olive hair and brown
 * trousers share two palette entries, so a hair colour below the chin is
 * trousers - which is why the head is decided by position before colour.
 */
const REFERENCE = 'boy';
const REFERENCE_SKIN = new Set([1, 2, 3, 4]);
const REFERENCE_TROUSERS = new Set([6, 7]);
const OUTLINE = 15;

/**
 * Where the head ends: above row 23 of an idle frame, and the chin's run on
 * row 23 itself (columns 4-11, outline included), a pixel lower on a step.
 */
const CHIN_ROW = 23;
const CHIN_FROM = 4;
const CHIN_TO = 11;

const args = process.argv.slice(2);
const pret = args.find((argument) => !argument.startsWith('--'));
const previewPath = args.find((argument) => argument.startsWith('--preview='))?.slice('--preview='.length);
// pret/pokeemerald at 731ad5b, for the people FireRed does not have (`emerald:` donors).
const emerald = args.find((argument) => argument.startsWith('--emerald='))?.slice('--emerald='.length);
const previewOnly = args.find((argument) => argument.startsWith('--only='))?.slice('--only='.length).split(',');
const previewZoom = Number(args.find((argument) => argument.startsWith('--zoom='))?.slice('--zoom='.length) ?? 3);
if (!pret) {
  console.error('usage: node scripts/cut-frlg-wearables.mjs <pret/pokefirered checkout> [--preview=<out.png>]');
  process.exit(1);
}

/** A 4- or 8-bit indexed PNG: its palette and its pixels as indices. */
function readIndexed(path) {
  const file = readFileSync(path);
  let offset = 8;
  const idat = [];
  let width = 0;
  let height = 0;
  let depth = 8;
  let palette = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const body = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
    } else if (type === 'PLTE') {
      palette = Array.from({ length: body.length / 3 }, (_, i) => [body[i * 3], body[i * 3 + 1], body[i * 3 + 2]]);
    } else if (type === 'IDAT') {
      idat.push(body);
    }
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = Math.ceil((width * depth) / 8);
  const pixels = new Uint8Array(width * height);
  let previous = new Uint8Array(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = Uint8Array.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i += 1) {
      const a = i > 0 ? line[i - 1] : 0;
      const b = previous[i];
      const c = i > 0 ? previous[i - 1] : 0;
      if (filter === 1) line[i] = (line[i] + a) & 255;
      else if (filter === 2) line[i] = (line[i] + b) & 255;
      else if (filter === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    for (let x = 0; x < width; x += 1) {
      pixels[y * width + x] = depth === 4 ? (x & 1 ? line[x >> 1] & 15 : line[x >> 1] >> 4) : line[x];
    }
    previous = line;
  }
  return { width, height, palette, pixels, frames: width / FRAME };
}

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
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * The player's palette draws skin a shade warmer than every other figure's
 * (`ffc594` where the townspeople's palettes all say `f6bd94`), so a head from
 * Red beside arms from anybody else would show the join. It is drawn in the
 * shared skin instead; nothing else of the player's palette changes.
 */
const SKIN_TO_SHARED = { 'ffc594': [0xf6, 0xbd, 0x94] };
const hex = (rgb) => rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
const canonical = (rgb) => SKIN_TO_SHARED[hex(rgb)] ?? rgb;

/**
 * FireRed's people share five palettes, and every colour of clothing or hair
 * on them is one of these three-shade ramps (light, mid, dark). A piece is
 * dyed by swapping one ramp for another, shade for shade, which is how the
 * game itself makes a camper of a youngster - so a dye is FireRed's own colour.
 */
const RAMPS = {
  olive: ['debd41', 'a48320', '525220'],
  green: ['83cd31', '398b00', '204110'],
  rose: ['de94bd', 'a44a83', '522041'],
  yellow: ['ffde4a', 'd5ac20', '836200'],
  violet: ['a48bee', '6a52bd', '413962'],
  orange: ['ee7341', 'ac4139', '4a3131'],
  tan: ['cdac62', '7b7341', '393918'],
  red: ['e66a4a', '943929', '521000'],
  grey: ['c5c5d5', '8b8b94', '4a4a5a'],
  pink: ['ffa4b4', 'd56a7b', '8b4152'],
  sky: ['94c5ee', '6283cd', '39394a'],
  scarlet: ['ff6a4a', 'c53939', '6a2929'],
};
const RAMP_OF = new Map(Object.entries(RAMPS).flatMap(([ramp, shades]) => shades.map((shade) => [shade, ramp])));

/**
 * A pret figure by its file, or an Emerald one by `emerald:<file>`: Emerald's
 * people are drawn on the same sixteen-by-thirty-two body, eyes and chin on
 * the same rows and a pixel's bob on a step, so a head of theirs sits on
 * FireRed's shared body as FireRed's own do.
 */
function person(file) {
  if (file.startsWith('emerald:')) {
    if (!emerald) throw new Error(`${file} needs --emerald=<pret/pokeemerald checkout>`);
    return readIndexed(join(emerald, 'graphics/object_events/pics/people', `${file.slice('emerald:'.length)}.png`));
  }
  return readIndexed(join(pret, 'graphics/object_events/pics/people', `${file}.png`));
}
const at = (image, frame, x, y) =>
  x < 0 || x >= FRAME || y < 0 || y >= image.height ? 0 : image.pixels[y * image.width + frame * FRAME + x];
const isStep = (frame) => frame >= 3;
const bobOf = (frame) => (isStep(frame) ? 1 : 0);

// -- the reference's regions -------------------------------------------------

const reference = person(REFERENCE);

function inHead(frame, x, y) {
  const bob = bobOf(frame);
  return y < CHIN_ROW + bob || (y === CHIN_ROW + bob && x >= CHIN_FROM && x <= CHIN_TO);
}

/** The reference's region for every pixel of every frame: 'HEAD', 'TOP', 'LEGS' or null. */
const referenceRegions = Array.from({ length: 9 }, (_, frame) => {
  const regions = Array.from({ length: HEIGHT }, () => new Array(FRAME).fill(null));
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < FRAME; x += 1) {
      const index = at(reference, frame, x, y);
      if (index === 0) continue;
      if (inHead(frame, x, y)) regions[y][x] = 'HEAD';
      else if (index === OUTLINE) regions[y][x] = 'OUTLINE';
      else if (REFERENCE_TROUSERS.has(index)) regions[y][x] = 'LEGS';
      else regions[y][x] = 'TOP';
    }
  }
  // An outline pixel outlines whatever most of its neighbours are, and the
  // legs where it is a tie at the feet (the soles are outline and nothing else).
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < FRAME; x += 1) {
      if (regions[y][x] !== 'OUTLINE') continue;
      const count = { TOP: 0, LEGS: 0 };
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const near = regions[y + dy]?.[x + dx];
        if (near === 'TOP' || near === 'LEGS') count[near] += Math.abs(dx) + Math.abs(dy) === 1 ? 2 : 1;
      }
      regions[y][x] = count.LEGS > count.TOP || (count.LEGS === count.TOP && y >= 28 + bobOf(frame)) ? 'LEGS' : 'TOP';
    }
  }
  return regions;
});

/** The region of the reference pixel nearest to (x, y) in `frame`. */
function regionAt(frame, x, y) {
  const regions = referenceRegions[frame];
  if (regions[y]?.[x]) return regions[y][x];
  if (inHead(frame, x, y)) return 'HEAD';
  for (let radius = 1; radius < HEIGHT; radius += 1) {
    let best = null;
    let bestDistance = Infinity;
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const region = regions[y + dy]?.[x + dx];
        if (!region || region === 'HEAD') continue;
        const distance = dx * dx + dy * dy;
        if (distance < bestDistance) {
          best = region;
          bestDistance = distance;
        }
      }
    }
    if (best) return best;
  }
  return 'TOP';
}

// -- the donors ---------------------------------------------------------------

/**
 * Who lends what. A figure is named by its pret file; `head`, `top`, `legs` and
 * `body` are the pieces taken from it, each refused if it does not fit (above).
 * `hair` lists the palette entries of hair that falls below the chin - long
 * hair, plaits, a ponytail - so it stays with the head rather than the top.
 */
const DONORS = JSON.parse(readFileSync(new URL('./wearable-donors.json', import.meta.url), 'utf8'));

function bottomOf(image, frame) {
  let bottom = 0;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < FRAME; x += 1) if (at(image, frame, x, y)) bottom = y;
  }
  return bottom;
}

/** The figure's pixels in a region, as {x, y, rgb} per pret frame. */
function cut(image, donor, region) {
  const hair = new Set(donor.hair ?? []);
  const frames = [];
  for (let frame = 0; frame < 9; frame += 1) {
    // A figure drawn standing has only its three idle frames; a head on a step
    // is the idle head a pixel lower, which is exactly what FireRed draws.
    const source = frame < image.frames ? frame : [0, 1, 2, 0, 0, 1, 1, 2, 2][frame];
    const drop = frame < image.frames ? 0 : bobOf(frame);
    const keep = new Set();
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < FRAME; x += 1) {
        const index = at(image, source, x, y);
        if (index === 0) continue;
        const where = regionAt(frame, x, y + drop);
        if (region === 'BODY' ? where !== 'HEAD' : where === region) keep.add(`${x},${y}`);
      }
    }
    // Long hair: a hair colour below the chin that touches the head is the head's.
    if (hair.size > 0) {
      const inRegion = (x, y) => regionAt(frame, x, y + drop) === 'HEAD';
      const grown = new Set();
      const queue = [];
      for (let y = 0; y < HEIGHT; y += 1) {
        for (let x = 0; x < FRAME; x += 1) if (at(image, source, x, y) && inRegion(x, y)) queue.push([x, y]);
      }
      const seen = new Set(queue.map(([x, y]) => `${x},${y}`));
      while (queue.length > 0) {
        const [x, y] = queue.shift();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          const key = `${nx},${ny}`;
          if (seen.has(key)) continue;
          const index = at(image, source, nx, ny);
          if (!hair.has(index)) continue;
          seen.add(key);
          grown.add(key);
          queue.push([nx, ny]);
        }
      }
      // The hair's own outline goes with it.
      for (const key of [...grown]) {
        const [x, y] = key.split(',').map(Number);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (at(image, source, x + dx, y + dy) === OUTLINE && !inRegion(x + dx, y + dy)) grown.add(`${x + dx},${y + dy}`);
        }
      }
      if (region === 'HEAD') for (const key of grown) keep.add(key);
      else for (const key of grown) keep.delete(key);
    }
    const pixels = [];
    for (const key of keep) {
      const [x, y] = key.split(',').map(Number);
      pixels.push({ x, y: y + drop, rgb: canonical(image.palette[at(image, source, x, y)]) });
    }
    frames.push(pixels);
  }
  return frames;
}

/** How far a donor's region strays from the reference's, at worst over the frames. */
function drift(image, region) {
  let worst = 0;
  for (let frame = 0; frame < Math.min(9, image.frames); frame += 1) {
    let differ = 0;
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < FRAME; x += 1) {
        const mine = at(image, frame, x, y) !== 0;
        const theirs = at(reference, frame, x, y) !== 0;
        if (mine === theirs) continue;
        const where = regionAt(frame, x, y);
        if (region === 'BODY' ? where !== 'HEAD' : where === region) differ += 1;
      }
    }
    worst = Math.max(worst, differ);
  }
  return worst;
}

/** One piece laid on the game's grid: 4x4 frames of 16x32, RGBA. */
function layOut(framesCut) {
  const out = Buffer.alloc(PIECE_WIDTH * PIECE_HEIGHT * 4);
  OUTPUT_FACINGS.forEach((facing, row) => {
    const mirrored = facing === 'right';
    const sources = SOURCE_FRAMES[mirrored ? 'left' : facing];
    OUTPUT_COLUMNS.forEach((step, column) => {
      const frame = sources[step];
      // Every frame is lowered by the reference's own amount, so a step stands
      // on the sole line as the game's other figures do.
      const lower = FEET_PIXEL_Y - bottomOf(reference, frame);
      for (const { x, y, rgb } of framesCut[frame]) {
        const ox = mirrored ? FRAME - 1 - x : x;
        const oy = y + lower;
        if (oy < 0 || oy >= HEIGHT) continue;
        const to = ((row * HEIGHT + oy) * PIECE_WIDTH + column * FRAME + ox) * 4;
        out[to] = rgb[0];
        out[to + 1] = rgb[1];
        out[to + 2] = rgb[2];
        out[to + 3] = 255;
      }
    });
  });
  return out;
}

/** Whether a laid-out piece draws anything below the sole line in any frame. */
function underSoles(art) {
  for (let row = 0; row < OUTPUT_FACINGS.length; row += 1) {
    for (let y = FEET_PIXEL_Y + 1; y < HEIGHT; y += 1) {
      for (let x = 0; x < PIECE_WIDTH; x += 1) if (art[((row * HEIGHT + y) * PIECE_WIDTH + x) * 4 + 3]) return true;
    }
  }
  return false;
}

const pieces = [];
const refused = [];
for (const [file, donor] of Object.entries(DONORS)) {
  const image = person(file);
  for (const region of ['HEAD', 'TOP', 'LEGS', 'BODY']) {
    const id = donor[region.toLowerCase()];
    if (!id) continue;
    if (region !== 'HEAD' && image.frames < 9) {
      refused.push(`${id}: ${file} has no walk`);
      continue;
    }
    const strayed = drift(image, region);
    if (strayed > MAX_REGION_DRIFT[region]) {
      refused.push(`${id}: ${file}'s ${region.toLowerCase()} strays ${strayed}px from the shared body`);
      continue;
    }
    const art = layOut(cut(image, donor, region));
    // A stride that reaches under the soles stands on the next tile south, and
    // lifting the piece alone would part it from the head above it.
    if (underSoles(art)) {
      refused.push(`${id}: ${file}'s stride reaches under the soles`);
      continue;
    }
    const counts = {};
    for (let i = 0; i < art.length; i += 4) {
      if (!art[i + 3]) continue;
      const ramp = RAMP_OF.get(hex([art[i], art[i + 1], art[i + 2]]));
      if (ramp) counts[ramp] = (counts[ramp] ?? 0) + 1;
    }
    const ramps = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([ramp]) => ramp);
    pieces.push({ id, slot: region.toLowerCase(), file, art, ramps });
  }
}

const atlasRows = Math.ceil(pieces.length / ATLAS_COLUMNS);
const atlasWidth = ATLAS_COLUMNS * PIECE_WIDTH;
const atlasHeight = atlasRows * PIECE_HEIGHT;
const atlas = Buffer.alloc(atlasWidth * atlasHeight * 4);
pieces.forEach((piece, cell) => {
  const left = (cell % ATLAS_COLUMNS) * PIECE_WIDTH;
  const top = Math.floor(cell / ATLAS_COLUMNS) * PIECE_HEIGHT;
  for (let y = 0; y < PIECE_HEIGHT; y += 1) {
    piece.art.copy(atlas, ((top + y) * atlasWidth + left) * 4, y * PIECE_WIDTH * 4, (y + 1) * PIECE_WIDTH * 4);
  }
});
writeFileSync(new URL('../public/assets/wearables.png', import.meta.url), encodePng(atlasWidth, atlasHeight, atlas));

const generated = [
  '// Generated by scripts/cut-frlg-wearables.mjs - do not edit by hand.',
  '// Each piece is one cell of public/assets/wearables.png: a 64x128 block laid',
  "// out as `src/game/playerFrames.ts`'s grid, cut from the pret figure named.",
  '',
  "export type WearableSlot = 'head' | 'top' | 'legs' | 'body';",
  '',
  '/** FireRed\'s own three-shade colour ramps, light to dark, as the people are drawn in. */',
  'export const WEARABLE_RAMPS = {',
  ...Object.entries(RAMPS).map(([ramp, shades]) => `  ${ramp}: [${shades.map((shade) => `0x${shade}`).join(', ')}],`),
  '} as const;',
  '',
  'export type WearableRamp = keyof typeof WEARABLE_RAMPS;',
  '',
  'export interface WearablePiece {',
  '  readonly slot: WearableSlot;',
  '  /** The cell of the atlas, counted along its rows. */',
  '  readonly cell: number;',
  "  /** The pret/pokefirered figure the piece is cut from. */",
  '  readonly from: string;',
  '  /** The colour ramps the piece is drawn in, the one covering most of it first. */',
  '  readonly ramps: readonly WearableRamp[];',
  '}',
  '',
  `export const WEARABLE_ATLAS_COLUMNS = ${ATLAS_COLUMNS};`,
  '',
  'export const WEARABLE_PIECES = {',
  ...pieces.map(
    (piece, cell) =>
      `  '${piece.id}': { slot: '${piece.slot}', cell: ${cell}, from: '${piece.file}', ramps: [${piece.ramps.map((ramp) => `'${ramp}'`).join(', ')}] },`,
  ),
  '} as const satisfies Record<string, WearablePiece>;',
  '',
  'export type WearablePieceId = keyof typeof WEARABLE_PIECES;',
  '',
];
writeFileSync(new URL('../src/game/look/generated/wearablePieces.ts', import.meta.url), generated.join('\n'));
console.log(`cut ${pieces.length} pieces into public/assets/wearables.png`);
for (const line of refused) console.log(`refused ${line}`);
// Two pieces of one slot that differ by a handful of pixels are one piece to a player.
for (let a = 0; a < pieces.length; a += 1) {
  for (let b = a + 1; b < pieces.length; b += 1) {
    if (pieces[a].slot !== pieces[b].slot) continue;
    let differ = 0;
    for (let i = 0; i < pieces[a].art.length; i += 4) {
      if (pieces[a].art.readUInt32BE(i) !== pieces[b].art.readUInt32BE(i)) differ += 1;
    }
    if (differ < NEAR_DUPLICATE_PIXELS) console.log(`alike ${pieces[a].id} ${pieces[b].id} (${differ}px)`);
  }
}

// -- the preview: every piece worn on the reference, every frame ----------------

if (previewPath) {
  const base = { head: layOut(cut(reference, {}, 'HEAD')), top: layOut(cut(reference, {}, 'TOP')), legs: layOut(cut(reference, {}, 'LEGS')) };
  const zoom = previewZoom;
  const gap = 4;
  const shown = previewOnly ? pieces.filter((piece) => previewOnly.some((id) => piece.id.includes(id))) : pieces;
  const rowWidth = PIECE_WIDTH * 4 + gap * 3;
  const perRow = previewOnly ? 1 : 2;
  const width = (rowWidth + 12) * perRow;
  const cellHeight = HEIGHT + gap;
  const rows = Math.ceil(shown.length / perRow);
  const image = Buffer.alloc(width * zoom * rows * cellHeight * zoom * 4);
  const plot = (x, y, rgb) => {
    for (let dy = 0; dy < zoom; dy += 1) {
      for (let dx = 0; dx < zoom; dx += 1) {
        const o = ((y * zoom + dy) * width * zoom + x * zoom + dx) * 4;
        image[o] = rgb[0];
        image[o + 1] = rgb[1];
        image[o + 2] = rgb[2];
        image[o + 3] = 255;
      }
    }
  };
  for (let y = 0; y < rows * cellHeight; y += 1) for (let x = 0; x < width; x += 1) plot(x, y, (x >> 2) % 2 ^ (y >> 2) % 2 ? [92, 168, 128] : [104, 184, 140]);
  shown.forEach((piece, k) => {
    const layers = piece.slot === 'body' ? [piece.art, base.head] : ['legs', 'top', 'head'].map((slot) => (slot === piece.slot ? piece.art : base[slot]));
    const left = (k % perRow) * (rowWidth + 12);
    const top = Math.floor(k / perRow) * cellHeight;
    // All sixteen frames: four facings, each idle-step-idle-step, side by side.
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 4; column += 1) {
        for (const layer of layers) {
          for (let y = 0; y < HEIGHT; y += 1) {
            for (let x = 0; x < FRAME; x += 1) {
              const o = ((row * HEIGHT + y) * PIECE_WIDTH + column * FRAME + x) * 4;
              if (layer[o + 3]) plot(left + row * (PIECE_WIDTH + gap) + column * FRAME + x, top + y, [layer[o], layer[o + 1], layer[o + 2]]);
            }
          }
        }
      }
    }
  });
  writeFileSync(previewPath, encodePng(width * zoom, rows * cellHeight * zoom, image));
  console.log(`preview ${previewPath}`);
}
