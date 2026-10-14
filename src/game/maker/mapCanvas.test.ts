import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../worldMap';
import { blankMap } from './draft';
import { drawMap, layersFor } from './mapCanvas';

/**
 * A canvas that remembers every pixel filled, in the colour it was filled
 * with: enough to read a mark's glyph back off the picture the maker draws.
 */
function recordingContext(): { context: CanvasRenderingContext2D; inked: Map<string, string> } {
  const inked = new Map<string, string>();
  const canvas = { width: 0, height: 0 };
  const context = {
    canvas,
    fillStyle: '',
    imageSmoothingEnabled: true,
    save: () => undefined,
    restore: () => undefined,
    beginPath: () => undefined,
    rect: () => undefined,
    clip: () => undefined,
    translate: () => undefined,
    scale: () => undefined,
    drawImage: () => undefined,
    fillRect(x: number, y: number, width: number, height: number) {
      for (let py = y; py < y + height; py += 1) {
        for (let px = x; px < x + width; px += 1) {
          inked.set(`${px},${py}`, String(this.fillStyle));
        }
      }
    },
  };
  return { context: context as unknown as CanvasRenderingContext2D, inked };
}

/** The glyph inside a tile's frame, as rows of `#` and `.`, trimmed to what is inked in `colour`. */
function glyphOn(
  inked: Map<string, string>,
  tile: { x: number; y: number },
  colour: string,
): string[] {
  const rows: string[] = [];
  for (let y = 1; y < TILE_SIZE - 1; y += 1) {
    let row = '';
    for (let x = 1; x < TILE_SIZE - 1; x += 1) {
      row +=
        inked.get(`${tile.x * TILE_SIZE + x},${tile.y * TILE_SIZE + y}`) === colour ? '#' : '.';
    }
    rows.push(row);
  }
  const used = rows.filter((row) => row.includes('#'));
  const left = Math.min(...used.map((row) => row.indexOf('#')));
  const right = Math.max(...used.map((row) => row.lastIndexOf('#')));
  return used.map((row) => row.slice(left, right + 1));
}

describe('the map maker marks', () => {
  it('draws an exit as a way out, an arrow pointing up, never a cross (playtest 39 B1)', () => {
    const file = {
      ...blankMap(20, 16, 'Mark Test'),
      exits: [{ x: 6, y: 6, name: 'North Stile', opens: { when: 'always' } as const }],
      dropIns: [{ x: 10, y: 10, name: 'South Road' }],
    };
    const { context, inked } = recordingContext();
    drawMap(context, file, layersFor(file), undefined);
    const frameColour = inked.get(`${6 * TILE_SIZE},${6 * TILE_SIZE}`) ?? '';
    const glyph = glyphOn(inked, { x: 6, y: 6 }, frameColour);
    const widths = glyph.map((row) => row.split('#').length - 1);
    // The point is one pixel in the middle of the top row, and the head widens
    // from there: the shape the game's own open-exit tile is drawn with.
    expect(glyph[0]).toBe(
      `${'.'.repeat((glyph[0].length - 1) / 2)}#${'.'.repeat((glyph[0].length - 1) / 2)}`,
    );
    expect(widths[1]).toBeGreaterThan(widths[0]);
    // A cross inks both top corners; an arrow inks neither.
    expect(glyph[0][0]).toBe('.');
    expect(glyph[0][glyph[0].length - 1]).toBe('.');
    // And it is the drop-in's arrow's opposite: a way in points down onto its tile.
    const dropInColour = inked.get(`${10 * TILE_SIZE},${10 * TILE_SIZE}`) ?? '';
    const dropIn = glyphOn(inked, { x: 10, y: 10 }, dropInColour);
    expect(dropIn[dropIn.length - 1]).toMatch(/^\.*#\.*$/);
  });
});
