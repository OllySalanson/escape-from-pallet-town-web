import { describe, expect, it } from 'vitest';
import { roomOffset, roomPictureFrame, roomPictureMark, roomPictureMarkup, roomScaleFor } from './roomPicture';
import type { BuiltRoom } from '../base/rooms';

const room = {
  room: { id: 'bills-cottage', width: 10, height: 8, keeper: { id: 'bill', name: 'BILL', design: 'bill', position: { x: 4, y: 3 }, facing: 'down' } },
} as unknown as BuiltRoom;

describe("a keeper's room as a picture", () => {
  it('is the room at one game pixel a source pixel, centred on the keeper', () => {
    expect(roomPictureFrame(room)).toEqual({ width: 160, height: 128, focusX: 72, focusY: 64 });
  });

  it('stands the keeper on their own tile and paints the room into a canvas named for it', () => {
    const markup = roomPictureMarkup(room, 'Bill in his cottage');
    expect(markup).toContain('data-room-picture="bills-cottage"');
    expect(markup).toContain('--kx:64;--ky:48');
    expect(markup).toContain('aria-label="BILL"');
  });

  it('rings a bay in gold only while its card is the one the cursor is on', () => {
    expect(roomPictureMark('beacon', { x: 1, y: 2, width: 3, height: 2 }, false)).toContain(' hidden');
    expect(roomPictureMark('beacon', { x: 1, y: 2, width: 3, height: 2 }, true)).toContain('data-shown-by="beacon" style="--mx:16;--my:32;--mw:48;--mh:32"');
  });
});

describe('a room fitted to its box', () => {
  it('is drawn whole, at the largest whole scale that fits, or at half in a box too small for one', () => {
    // A 240x192 room in a 400x200 stage fits at 1x and not at 2x.
    expect(roomScaleFor({ width: 400, height: 200 }, { width: 240, height: 192 })).toBe(1);
    // A small room in a big box goes up a whole step, not a fraction, and stays whole.
    expect(roomScaleFor({ width: 400, height: 300 }, { width: 160, height: 128 })).toBe(2);
    // Too small a box for even one: half, still whole.
    expect(roomScaleFor({ width: 200, height: 100 }, { width: 160, height: 128 })).toBe(0.5);
    // ...and a third where half is still too big: never cut.
    expect(roomScaleFor({ width: 136, height: 72 }, { width: 320, height: 208 })).toBe(1 / 3);
  });

  it('is centred in its box', () => {
    expect(roomOffset(400, 240)).toBe(80);
    expect(roomOffset(200, 192)).toBe(4);
  });
});
