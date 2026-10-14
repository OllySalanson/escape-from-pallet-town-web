import { describe, expect, it } from 'vitest';
import { tabOverGame } from './feedbackTabCover';

const GAME = { width: 400, height: 256 };
const CANVAS = { left: 0, top: 0, width: 1200, height: 768 };

describe('the FEEDBACK tab over the game', () => {
  it('is the strip of the screen it covers, in game pixels, rounded outward', () => {
    expect(tabOverGame({ left: 1170, top: 328, width: 30, height: 112 }, CANVAS, GAME)).toEqual({
      x: 390,
      y: 109,
      width: 10,
      height: 38,
    });
  });

  it('is only the part over the canvas when the canvas is centred in a wider window', () => {
    const centred = { left: 100, top: 0, width: 1200, height: 768 };
    expect(tabOverGame({ left: 1290, top: 328, width: 30, height: 112 }, centred, GAME)).toEqual({
      x: 396,
      y: 109,
      width: 4,
      height: 38,
    });
  });

  it('covers nothing when it stands in the margin beside the canvas, or is not drawn', () => {
    const narrow = { left: 0, top: 0, width: 1200, height: 768 };
    expect(tabOverGame({ left: 1250, top: 328, width: 30, height: 112 }, narrow, GAME)).toBeNull();
    expect(tabOverGame(null, CANVAS, GAME)).toBeNull();
    expect(tabOverGame({ left: 0, top: 0, width: 0, height: 0 }, CANVAS, GAME)).toBeNull();
  });
});
