import { readFile, readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { WINDOW_BORDER, WINDOW_CREAM, drawPixelWindow, toCssColor } from './pixelWindow';

const SCENES = new URL('../scenes/', import.meta.url);

interface DrawnRect {
  readonly colour: number;
  readonly alpha: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function recorder(): { rects: DrawnRect[]; graphics: Parameters<typeof drawPixelWindow>[0] } {
  const rects: DrawnRect[] = [];
  let colour = 0;
  let alpha = 1;
  const graphics = {
    fillStyle: (value: number, a = 1) => {
      colour = value;
      alpha = a;
    },
    fillRect: (x: number, y: number, width: number, height: number) => {
      rects.push({ colour, alpha, x, y, width, height });
    },
  };
  return { rects, graphics: graphics as unknown as Parameters<typeof drawPixelWindow>[0] };
}

describe('the drawn window frame', () => {
  it('is one pixel of border on every side, at any size', () => {
    const { rects, graphics } = recorder();

    drawPixelWindow(graphics, { x: 8, y: 174, width: 304, height: 64 }, { fill: WINDOW_CREAM });

    const border = rects.filter((rect) => rect.colour === WINDOW_BORDER);
    expect(border).toHaveLength(4);
    // The defect this replaces: a 32x32 texture stretched to 304x64 painted a
    // 19px smear down the right and along the bottom and nothing at all on the
    // left. Every edge here is exactly one pixel and none of them is missing.
    expect(border.map((rect) => Math.min(rect.width, rect.height))).toEqual([1, 1, 1, 1]);
    expect(border.filter((rect) => rect.x === 8)).toHaveLength(1);
    expect(border.filter((rect) => rect.x === 8 + 304 - 1)).toHaveLength(1);
    expect(rects.filter((rect) => rect.colour === WINDOW_CREAM)).toHaveLength(1);
  });

  it('leaves the four corner pixels clear, so the window reads as chamfered', () => {
    const { rects, graphics } = recorder();

    drawPixelWindow(graphics, { x: 0, y: 0, width: 20, height: 10 }, { fill: WINDOW_CREAM });

    const covers = (x: number, y: number): boolean =>
      rects.some(
        (rect) => x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height,
      );
    for (const [x, y] of [
      [0, 0],
      [19, 0],
      [0, 9],
      [19, 9],
    ]) {
      expect(covers(x, y), `corner ${x},${y} is painted`).toBe(false);
    }
  });

  it('is what every panel in the game is drawn with, textures included', async () => {
    const files = (await readdir(SCENES)).filter(
      (name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
    );

    for (const file of files) {
      const source = await readFile(new URL(file, SCENES), 'utf8');
      // The battle dialogue was the last panel still stretching
      // `dialog-plain.png`. Nothing may go back to a textured frame: at any size
      // other than the texture's own, the border smears.
      expect(source, `${file} stretches a panel texture`).not.toContain('backgroundTexture');
    }
  });

  it('draws the battle dialogue in the same cream window as the rest of the game', async () => {
    const battle = await readFile(new URL('BattleScene.ts', SCENES), 'utf8');
    const dialogue = battle.slice(battle.indexOf('this.dialog = new DialogBox('));

    expect(dialogue).toContain('pixelWindow: true');
    expect(dialogue).toContain('backgroundColor: WINDOW_CREAM');
    expect(dialogue).toContain('borderColor: WINDOW_BORDER');
    expect(dialogue).toContain('color: WINDOW_INK');
    // The 22px text inset only existed to clear the stretched texture's painted
    // edge, so it goes with the texture rather than living on as a magic number.
    expect(dialogue.slice(0, dialogue.indexOf('onComplete'))).not.toContain('paddingHorizontal');
  });

  it('keeps the ink dark enough to read on cream', () => {
    expect(toCssColor(WINDOW_CREAM)).toBe('#ebeac5');
    expect(toCssColor(WINDOW_BORDER)).toBe('#171717');
  });
});
