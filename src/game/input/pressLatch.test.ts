import { describe, expect, it } from 'vitest';
import { PressLatch } from './pressLatch';

describe('press latch', () => {
  it('still shows a press to the frame that processed it, though the key is already up', () => {
    const latch = new PressLatch<'left' | 'right'>();
    latch.press('left', 12);
    expect(latch.wasPressedOn('left', 12)).toBe(true);
    expect(latch.wasPressedOn('right', 12)).toBe(false);
  });

  it('does not keep a press for a later frame to walk on', () => {
    const latch = new PressLatch<'left'>();
    latch.press('left', 12);
    expect(latch.wasPressedOn('left', 13)).toBe(false);
    latch.press('left', 13);
    latch.clear();
    expect(latch.wasPressedOn('left', 13)).toBe(false);
  });

  it('answers a consumed press once', () => {
    const latch = new PressLatch<'space'>();
    latch.press('space', 4);
    expect(latch.consume('space', 4)).toBe(true);
    expect(latch.consume('space', 4)).toBe(false);
    latch.press('space', 4);
    expect(latch.consume('space', 5)).toBe(false);
  });
});
