/** Drawing primitives shared by the tileset tools. No dependency, on purpose. */
import { GLYPHS, GLYPH_HEIGHT, GLYPH_WIDTH } from './glyphs.mjs';
import { TILE_SIZE } from './tileSheet.mjs';

export function canvas(width, height, colour = [0, 0, 0]) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data[i * 4] = colour[0];
    data[i * 4 + 1] = colour[1];
    data[i * 4 + 2] = colour[2];
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

export function plot(image, x, y, colour, alpha = 255) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const i = (y * image.width + x) * 4;
  const k = alpha / 255;
  image.data[i] = Math.round(image.data[i] * (1 - k) + colour[0] * k);
  image.data[i + 1] = Math.round(image.data[i + 1] * (1 - k) + colour[1] * k);
  image.data[i + 2] = Math.round(image.data[i + 2] * (1 - k) + colour[2] * k);
  image.data[i + 3] = 255;
}

export function box(image, x0, y0, width, height, colour, alpha = 255) {
  for (let y = y0; y < y0 + height; y += 1) {
    for (let x = x0; x < x0 + width; x += 1) plot(image, x, y, colour, alpha);
  }
}

export function label(image, value, x0, y0, scale, colour) {
  let cursor = x0;
  for (const character of String(value).toUpperCase()) {
    const glyph = GLYPHS[character] ?? GLYPHS[' '];
    for (let row = 0; row < GLYPH_HEIGHT; row += 1) {
      for (let column = 0; column < GLYPH_WIDTH; column += 1) {
        if (glyph[row][column] !== '1') continue;
        box(image, cursor + column * scale, y0 + row * scale, scale, scale, colour);
      }
    }
    cursor += (GLYPH_WIDTH + 1) * scale;
  }
}

/** Multiplies by a 0xRRGGBB tint, the way Phaser tints a tile. */
export function blit(destination, source, sx, sy, width, height, dx, dy, tint) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = ((sy + y) * source.width + sx + x) * 4;
      const alpha = source.data[i + 3];
      if (!alpha) continue;
      let r = source.data[i];
      let g = source.data[i + 1];
      let b = source.data[i + 2];
      if (tint !== undefined) {
        r = Math.round((r * ((tint >> 16) & 0xff)) / 255);
        g = Math.round((g * ((tint >> 8) & 0xff)) / 255);
        b = Math.round((b * (tint & 0xff)) / 255);
      }
      plot(destination, dx + x, dy + y, [r, g, b], alpha);
    }
  }
}

export function drawTile(destination, sheet, index, tileX, tileY, tint) {
  if (index < 0) return;
  const columns = sheet.width / TILE_SIZE;
  blit(
    destination,
    sheet,
    (index % columns) * TILE_SIZE,
    Math.floor(index / columns) * TILE_SIZE,
    TILE_SIZE,
    TILE_SIZE,
    tileX * TILE_SIZE,
    tileY * TILE_SIZE,
    tint,
  );
}

export function upscale(image, zoom) {
  const out = canvas(image.width * zoom, image.height * zoom);
  for (let y = 0; y < out.height; y += 1) {
    for (let x = 0; x < out.width; x += 1) {
      const i = (Math.floor(y / zoom) * image.width + Math.floor(x / zoom)) * 4;
      const j = (y * out.width + x) * 4;
      out.data[j] = image.data[i];
      out.data[j + 1] = image.data[i + 1];
      out.data[j + 2] = image.data[i + 2];
      out.data[j + 3] = 255;
    }
  }
  return out;
}
