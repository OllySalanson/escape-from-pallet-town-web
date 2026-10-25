// A tiny animated-PNG writer, so nothing needs installing: a playtest that
// records a clip screenshots once a frame, decodes each picture and lays them
// end to end as one looping APNG at 30 frames a second.
import { deflateSync, inflateSync } from 'node:zlib';

export function decodePng(bytes) {
  let at = 8;
  let width = 0;
  let height = 0;
  let colourType = 6;
  const data = [];
  while (at < bytes.length) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.subarray(at + 4, at + 8).toString('ascii');
    const body = bytes.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      colourType = body[9];
    } else if (type === 'IDAT') {
      data.push(body);
    }
    at += 12 + length;
  }
  const channels = colourType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const pixels = Buffer.alloc(width * height * 4);
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const row = Buffer.alloc(stride);
    for (let x = 0; x < stride; x += 1) {
      const value = raw[y * (stride + 1) + 1 + x];
      const left = x >= channels ? row[x - channels] : 0;
      const up = previous[x];
      const upLeft = x >= channels ? previous[x - channels] : 0;
      let predicted = 0;
      if (filter === 1) predicted = left;
      else if (filter === 2) predicted = up;
      else if (filter === 3) predicted = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        predicted = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      row[x] = (value + predicted) & 0xff;
    }
    for (let x = 0; x < width; x += 1) {
      pixels.set([row[x * channels], row[x * channels + 1], row[x * channels + 2], 255], (y * width + x) * 4);
    }
    previous = row;
  }
  return { width, height, pixels };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  let crc = 0xffffffff;
  for (const byte of body) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, body.length + 4);
  return out;
}

/** Every frame laid end to end as one looping APNG at 30 frames a second. */
export function animatedPng(images) {
  const { width, height } = images[0];
  const scanlines = (image) => {
    const raw = Buffer.alloc((width * 4 + 1) * height);
    for (let y = 0; y < height; y += 1) {
      image.pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
    }
    return deflateSync(raw, { level: 9 });
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const control = Buffer.alloc(8);
  control.writeUInt32BE(images.length, 0);
  control.writeUInt32BE(0, 4);
  const parts = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('acTL', control)];
  let sequence = 0;
  images.forEach((image, index) => {
    const frame = Buffer.alloc(26);
    frame.writeUInt32BE(sequence++, 0);
    frame.writeUInt32BE(width, 4);
    frame.writeUInt32BE(height, 8);
    frame.writeUInt32BE(0, 12);
    frame.writeUInt32BE(0, 16);
    frame.writeUInt16BE(1, 20);
    frame.writeUInt16BE(30, 22);
    frame[24] = 0;
    frame[25] = 0;
    parts.push(chunk('fcTL', frame));
    const data = scanlines(image);
    if (index === 0) {
      parts.push(chunk('IDAT', data));
    } else {
      const numbered = Buffer.alloc(data.length + 4);
      numbered.writeUInt32BE(sequence++, 0);
      data.copy(numbered, 4);
      parts.push(chunk('fdAT', numbered));
    }
  });
  parts.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}
