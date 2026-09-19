import { inflateSync } from 'node:zlib';

/**
 * A PNG decoder for tests that have to assert on the art itself rather than on
 * its header - where a figure's soles rest, whether a cell's backing colour was
 * keyed out. It reads what this repository's pixel art is saved as, 8-bit RGBA
 * without interlacing, and throws on anything else rather than guessing.
 */
export interface PngPixels {
  readonly width: number;
  readonly height: number;
  /** Red, green, blue and alpha of the pixel at x, y. */
  at(x: number, y: number): readonly [number, number, number, number];
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const BYTES_PER_PIXEL = 4;

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toUpLeft = Math.abs(estimate - upLeft);
  if (toLeft <= toUp && toLeft <= toUpLeft) {
    return left;
  }
  return toUp <= toUpLeft ? up : upLeft;
}

export function decodePng(bytes: Buffer): PngPixels {
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('not a PNG');
  }

  let width = 0;
  let height = 0;
  const data: Buffer[] = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const body = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[9] !== 6 || body[12] !== 0) {
        throw new Error('expected a non-interlaced 8-bit RGBA PNG');
      }
    } else if (type === 'IDAT') {
      data.push(body);
    }
    offset += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(data));
  const stride = width * BYTES_PER_PIXEL;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x += 1) {
      const left = x >= BYTES_PER_PIXEL ? pixels[y * stride + x - BYTES_PER_PIXEL] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft =
        x >= BYTES_PER_PIXEL && y > 0 ? pixels[(y - 1) * stride + x - BYTES_PER_PIXEL] : 0;
      const predicted = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter];
      if (predicted === undefined) {
        throw new Error(`unknown PNG filter ${filter}`);
      }
      pixels[y * stride + x] = (raw[y * (stride + 1) + 1 + x] + predicted) & 0xff;
    }
  }

  return {
    width,
    height,
    at: (x, y) => {
      const index = (y * width + x) * BYTES_PER_PIXEL;
      return [pixels[index], pixels[index + 1], pixels[index + 2], pixels[index + 3]];
    },
  };
}
