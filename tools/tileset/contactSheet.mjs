/**
 * The contact sheet: a tile sheet you can actually read.
 *
 * A tile sheet is 16px squares in a grid, which is unreadable at its own size
 * and unaddressable without the index printed on it. This renders any sheet
 * zoomed, gridded and numbered, so a person - or a vision-capable agent - can
 * look at cell 612 and see what tile 612 is. It is deliberately general: point
 * it at a different sheet and it prints that one, which is the whole reason the
 * catalogue can be re-derived if the art is ever replaced.
 *
 *   node tools/tileset/contactSheet.mjs <sheet.png> <out.png> [zoom]
 */
import { readPng, writePng, TILE_SIZE } from './tileSheet.mjs';
import { box, canvas, label, plot } from './draw.mjs';

const BACKDROP = [22, 24, 30];
const CHECKER_A = [46, 49, 58];
const CHECKER_B = [60, 64, 75];
const LABEL_BAR = [12, 13, 17];
const LABEL_INK = [255, 214, 92];
const HEADER_INK = [120, 214, 255];
const GRID = [86, 92, 106];

const [, , source = 'public/assets/Overworld.png', target = 'docs/tilesets/overworld-contact-sheet.png', zoomArgument = '4'] =
  process.argv;
const zoom = Number(zoomArgument);
const sheet = readPng(source);
const columns = sheet.width / TILE_SIZE;
const rows = sheet.height / TILE_SIZE;

const cell = TILE_SIZE * zoom;
const labelHeight = 5 * 2 + 4;
const stride = cell + labelHeight + 2;
const margin = 26;
const image = canvas(margin + columns * stride, margin + rows * stride, BACKDROP);

for (let row = 0; row < rows; row += 1) {
  for (let column = 0; column < columns; column += 1) {
    const index = row * columns + column;
    const left = margin + column * stride;
    const top = margin + row * stride;

    box(image, left, top, cell, labelHeight, LABEL_BAR);
    label(image, index, left + 2, top + 2, 2, LABEL_INK);

    const art = top + labelHeight;
    for (let y = 0; y < cell; y += 1) {
      for (let x = 0; x < cell; x += 1) {
        const sx = column * TILE_SIZE + Math.floor(x / zoom);
        const sy = row * TILE_SIZE + Math.floor(y / zoom);
        const i = (sy * sheet.width + sx) * 4;
        const checker = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? CHECKER_A : CHECKER_B;
        plot(image, left + x, art + y, checker);
        const alpha = sheet.data[i + 3];
        if (alpha > 0) {
          plot(image, left + x, art + y, [sheet.data[i], sheet.data[i + 1], sheet.data[i + 2]], alpha);
        }
      }
    }
    box(image, left, top + stride - 2, cell, 2, GRID);
    box(image, left + cell, top, 2, stride, GRID);
  }
}

for (let column = 0; column < columns; column += 1) {
  label(image, column, margin + column * stride + 2, 6, 3, HEADER_INK);
}
for (let row = 0; row < rows; row += 1) {
  label(image, row, 2, margin + row * stride + Math.floor(stride / 2) - 7, 3, HEADER_INK);
}

writePng(target, image);
console.log(`${target}  ${image.width}x${image.height}  ${columns}x${rows} tiles at ${zoom}x`);
