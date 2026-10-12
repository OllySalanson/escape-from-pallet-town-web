// What a GBA game keeps its art in, read as the hardware reads it: an indexed
// PNG of 8x8 tiles in sixteen colours, a JASC palette file, and the 16x16
// "metatiles" a map is laid in - four tiles on a bottom layer and four on a
// top, each naming its tile, its flips and its palette.
//
// The older cutters (`cut-frlg-home.mjs`, `cut-frlg-areas.mjs`) each carry
// their own copy of this; `cut-home-furniture.mjs` is the first to share it.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

/** An indexed PNG whose pixel values are palette indices (4 or 8 bits). */
export function readIndexedPng(path) {
  const file = readFileSync(path);
  let offset = 8;
  const idat = [];
  let width = 0;
  let height = 0;
  let depth = 0;
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('ascii', offset + 4, offset + 8);
    const body = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      if (body[9] !== 3) throw new Error(`${path} is not an indexed PNG`);
      if (body[12] !== 0) throw new Error(`${path} is interlaced`);
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(body));
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  if (depth !== 4 && depth !== 8) throw new Error(`${path}: unsupported bit depth ${depth}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = Math.ceil((width * depth) / 8);
  const lines = Buffer.alloc(height * stride);
  let source = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[source];
    source += 1;
    const line = lines.subarray(y * stride, (y + 1) * stride);
    const previous = y === 0 ? null : lines.subarray((y - 1) * stride, y * stride);
    for (let x = 0; x < stride; x += 1) {
      const value = raw[source + x];
      const a = x >= 1 ? line[x - 1] : 0;
      const b = previous ? previous[x] : 0;
      const c = previous && x >= 1 ? previous[x - 1] : 0;
      let predicted = 0;
      if (filter === 1) predicted = a;
      else if (filter === 2) predicted = b;
      else if (filter === 3) predicted = (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        predicted = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error(`${path}: unknown PNG filter ${filter}`);
      line[x] = (value + predicted) & 0xff;
    }
    source += stride;
  }
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const byte = lines[y * stride + (depth === 4 ? x >> 1 : x)];
      pixels[y * width + x] = depth === 8 ? byte : x & 1 ? byte & 15 : byte >> 4;
    }
  }
  return { width, height, pixels };
}

/** A JASC palette file: sixteen colours, already in eight bits a channel. */
export const readPalette = (path) =>
  readFileSync(path, 'utf8')
    .trim()
    .split(/\r?\n/)
    .slice(3)
    .map((line) => line.trim().split(/\s+/).map(Number));

/** A clear RGBA image. */
export const blank = (width, height) => ({ width, height, data: Buffer.alloc(width * height * 4) });

/** Sets one pixel of an RGBA image, opaque. */
export function setPixel(image, x, y, [r, g, b]) {
  const at = (y * image.width + x) * 4;
  image.data[at] = r;
  image.data[at + 1] = g;
  image.data[at + 2] = b;
  image.data[at + 3] = 255;
}

/**
 * A tileset pair as a map loads it: the primary's tiles first and the
 * secondary's after, and the metatile tables the same way.
 */
export function tilesetPair({ primaryTiles, secondaryTiles, primaryMetatiles, secondaryMetatiles, palettes, split }) {
  const sheets = [readIndexedPng(primaryTiles), readIndexedPng(secondaryTiles)];
  const tables = [readFileSync(primaryMetatiles), readFileSync(secondaryMetatiles)];
  const tilePixel = (tile, x, y) => {
    const sheet = tile < split.tiles ? sheets[0] : sheets[1];
    const index = tile < split.tiles ? tile : tile - split.tiles;
    const columns = sheet.width / 8;
    const px = (index % columns) * 8 + x;
    const py = Math.floor(index / columns) * 8 + y;
    if (py >= sheet.height) throw new Error(`tile ${tile} is off its sheet`);
    return sheet.pixels[py * sheet.width + px];
  };
  /**
   * One metatile, as the GBA draws it: the bottom layer, then the top over it,
   * colour 0 clear. `keep` can leave tiles out by their index - the ground a
   * piece of furniture was drawn standing on, say - and is told each tile's
   * palette, so a cut can refuse one drawn in a palette that varies by room.
   */
  const drawMetatile = (image, id, left, top, keep = () => true) => {
    const table = id < split.metatiles ? tables[0] : tables[1];
    const base = (id < split.metatiles ? id : id - split.metatiles) * 16;
    if (base + 16 > table.length) throw new Error(`metatile ${id} does not exist`);
    for (let layer = 0; layer < 2; layer += 1) {
      for (let quarter = 0; quarter < 4; quarter += 1) {
        const entry = table.readUInt16LE(base + (layer * 4 + quarter) * 2);
        const tile = entry & 0x3ff;
        const flipX = (entry >> 10) & 1;
        const flipY = (entry >> 11) & 1;
        const palette = entry >> 12;
        if (!keep(tile, palette)) continue;
        for (let y = 0; y < 8; y += 1) {
          for (let x = 0; x < 8; x += 1) {
            const index = tilePixel(tile, flipX ? 7 - x : x, flipY ? 7 - y : y);
            if (index === 0) continue;
            setPixel(image, left + (quarter % 2) * 8 + x, top + Math.floor(quarter / 2) * 8 + y, palettes[palette][index]);
          }
        }
      }
    }
  };
  return { drawMetatile, metatileCount: tables[1].length / 16 + split.metatiles };
}

/** An object-event picture: an indexed sheet drawn in one palette, colour 0 clear. */
export function drawPicture(path, palette) {
  const picture = readIndexedPng(path);
  const image = blank(picture.width, picture.height);
  for (let y = 0; y < picture.height; y += 1) {
    for (let x = 0; x < picture.width; x += 1) {
      const index = picture.pixels[y * picture.width + x];
      if (index !== 0) setPixel(image, x, y, palette[index]);
    }
  }
  return image;
}

/** A crop of an RGBA image. */
export function crop(image, left, top, width, height) {
  const out = blank(width, height);
  for (let y = 0; y < height; y += 1) {
    image.data.copy(out.data, y * width * 4, ((top + y) * image.width + left) * 4, ((top + y) * image.width + left + width) * 4);
  }
  return out;
}

/** The same image mirrored left to right. */
export function mirror(image) {
  const out = blank(image.width, image.height);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      image.data.copy(out.data, (y * image.width + (image.width - 1 - x)) * 4, (y * image.width + x) * 4, (y * image.width + x) * 4 + 4);
    }
  }
  return out;
}

/** Copies one RGBA image onto another, clear pixels left alone. */
export function paste(onto, image, left, top) {
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const from = (y * image.width + x) * 4;
      if (image.data[from + 3] === 0) continue;
      image.data.copy(onto.data, ((top + y) * onto.width + left + x) * 4, from, from + 4);
    }
  }
}
