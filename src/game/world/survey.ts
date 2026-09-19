/**
 * What the player has walked, kept tile by tile.
 *
 * The drop-in screen draws each map as a bird's-eye picture with everything
 * nobody has been to still dark, and that record is the point of the screen:
 * the dark retreating is what a raid is *for*, so it has to survive the raid,
 * the save and the reload. A district would have been the cheap unit, but a
 * district is a rectangle a dozen tiles on a side and at one game pixel to the
 * tile it lights up as a rectangle - the shape of the data rather than the
 * shape of the walk. A tile survey lights the roads the player actually took,
 * which is what makes the picture a record of a journey.
 *
 * It is stored as a bitset per map because the Floodplain is 64x64 - four
 * thousand booleans, which as an array of coordinates in JSON is forty
 * kilobytes and as bits is five hundred bytes. The width is stored beside it so
 * a map that is redrawn narrower or wider is read back at the width it was
 * surveyed at and clipped, rather than skewed by a row.
 *
 * Nothing derived is stored: which districts have been reached, how much of a
 * map is known, and the ground a beaten gate opens up are all computed from
 * this and from the map itself (`minimap.ts`), so a redrawn map cannot leave a
 * stale picture behind.
 */

/** One map's surveyed tiles: the width they were counted at, and the bits. */
export interface SurveyedMap {
  readonly width: number;
  /** Row-major bits, least significant bit first, base64 encoded. */
  readonly tiles: string;
}

/** Every map's survey, by map id. Absent on a save written before it existed. */
export type SurveyRecord = Readonly<Record<string, SurveyedMap>>;

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Base64 without a browser's `btoa`, because this is read by the lobby, by the
 * save loader and by tests that run in node, and a polyfilled global is one
 * more thing that can be missing at the wrong moment.
 */
function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let at = 0; at < bytes.length; at += 3) {
    const a = bytes[at];
    const b = at + 1 < bytes.length ? bytes[at + 1] : 0;
    const c = at + 2 < bytes.length ? bytes[at + 2] : 0;
    out += BASE64[a >> 2];
    out += BASE64[((a & 3) << 4) | (b >> 4)];
    out += at + 1 < bytes.length ? BASE64[((b & 15) << 2) | (c >> 6)] : '=';
    out += at + 2 < bytes.length ? BASE64[c & 63] : '=';
  }
  return out;
}

function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let written = 0;
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = BASE64.indexOf(char);
    if (value < 0) {
      continue;
    }
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[written] = (buffer >> bits) & 0xff;
      written += 1;
    }
  }
  return bytes.subarray(0, written);
}

/** A map's survey as a set of row-major tile indices at `width`. */
export function decodeSurvey(record: SurveyedMap | undefined): {
  readonly width: number;
  readonly tiles: ReadonlySet<number>;
} {
  if (!record || record.width <= 0) {
    return { width: 0, tiles: new Set() };
  }
  const bytes = fromBase64(record.tiles);
  const tiles = new Set<number>();
  for (let index = 0; index < bytes.length * 8; index += 1) {
    if ((bytes[index >> 3] & (1 << (index & 7))) !== 0) {
      tiles.add(index);
    }
  }
  return { width: record.width, tiles };
}

export function encodeSurvey(width: number, tiles: ReadonlySet<number>): SurveyedMap {
  let highest = -1;
  for (const index of tiles) {
    if (index > highest) {
      highest = index;
    }
  }
  const bytes = new Uint8Array(Math.max(1, (highest >> 3) + 1));
  for (const index of tiles) {
    if (index >= 0) {
      bytes[index >> 3] |= 1 << (index & 7);
    }
  }
  return { width, tiles: toBase64(bytes) };
}

/**
 * Asks a stored survey about a tile on the map as it is drawn *today*.
 *
 * A survey counted at another width is read at the width it was written at, so
 * a redrawn map shows the walk where the walk was rather than skewed by the
 * difference - and anything off the new map's edge is simply not asked about.
 */
export function surveyedTiles(record: SurveyedMap | undefined, width: number): ReadonlySet<number> {
  const stored = decodeSurvey(record);
  if (stored.width === 0) {
    return new Set();
  }
  if (stored.width === width) {
    return stored.tiles;
  }
  const remapped = new Set<number>();
  for (const index of stored.tiles) {
    const x = index % stored.width;
    const y = Math.floor(index / stored.width);
    if (x < width) {
      remapped.add(y * width + x);
    }
  }
  return remapped;
}

/** Adds this raid's walk to what a save already held for that map. */
export function mergeSurvey(
  record: SurveyedMap | undefined,
  width: number,
  walked: Iterable<number>,
): SurveyedMap {
  const tiles = new Set(surveyedTiles(record, width));
  for (const index of walked) {
    tiles.add(index);
  }
  return encodeSurvey(width, tiles);
}
