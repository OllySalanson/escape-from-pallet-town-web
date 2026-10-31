import { describe, expect, it } from 'vitest';
import { SPEECH_TAIL, bubbleSeat, overlaps } from './speechBubble';

describe('a speech bubble\'s seat', () => {
  const WIDTH = 60;
  const HEIGHT = 13;
  const boxAt = (x: number, tipY: number) => ({ x, y: Math.round(tipY - SPEECH_TAIL - HEIGHT + 1), width: WIDTH, height: HEIGHT + SPEECH_TAIL });

  it('is centred over the speaker with nothing in the way', () => {
    expect(bubbleSeat(100, 50, WIDTH, HEIGHT, null, [])).toEqual({ x: 70, tipY: 50 });
  });

  it('stays over the place it is in', () => {
    expect(bubbleSeat(10, 50, WIDTH, HEIGHT, 200, []).x).toBe(0);
    expect(bubbleSeat(195, 50, WIDTH, HEIGHT, 200, []).x).toBe(140);
  });

  it('slides beside a bubble already seated, its tail still on its own speaker', () => {
    const other = boxAt(70, 50);
    const seat = bubbleSeat(135, 50, WIDTH, HEIGHT, null, [other]);
    expect(seat.tipY).toBe(50);
    expect(seat.x).toBe(130);
    expect(overlaps(boxAt(seat.x, seat.tipY), other)).toBe(false);
  });

  it('is lifted over one it cannot get beside', () => {
    const other = boxAt(70, 50);
    const seat = bubbleSeat(100, 50, WIDTH, HEIGHT, null, [other]);
    expect(seat.tipY).toBeLessThan(50);
    expect(overlaps(boxAt(seat.x, seat.tipY), other)).toBe(false);
  });
});
