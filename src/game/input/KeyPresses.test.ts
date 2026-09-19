import { describe, expect, it, vi } from 'vitest';

/** Phaser's own rule, including the part that loses the press: up clears it. */
class FakeKey {
  public isDown = false;
  public justDown = false;
  private listener: (() => void) | undefined;
  public on(_event: string, listener: () => void): this {
    this.listener = listener;
    return this;
  }
  public down(): void {
    this.isDown = true;
    this.justDown = true;
    this.listener?.();
  }
  public up(): void {
    this.isDown = false;
    this.justDown = false;
  }
}

vi.mock('phaser', () => ({
  default: {
    Input: {
      Keyboard: {
        JustDown: (key: FakeKey): boolean => {
          const was = key.justDown;
          key.justDown = false;
          return was;
        },
      },
    },
  },
}));

import { KeyPresses } from './KeyPresses';

type Key = Parameters<KeyPresses['justPressed']>[0];

const watched = (): { key: FakeKey; presses: KeyPresses; frame: { now: number } } => {
  const frame = { now: 1 };
  const presses = new KeyPresses(() => frame.now);
  const key = new FakeKey();
  presses.watch([key as unknown as Key]);
  return { key, presses, frame };
};

describe('key presses', () => {
  it('sees a press that is already up again when the frame reads it', () => {
    const { key, presses } = watched();
    key.down();
    key.up();
    expect(presses.justPressed(key as unknown as Key)).toBe(true);
  });

  it('answers a held press once, not once for the flag and once for the latch', () => {
    const { key, presses, frame } = watched();
    key.down();
    expect(presses.justPressed(key as unknown as Key)).toBe(true);
    expect(presses.justPressed(key as unknown as Key)).toBe(false);
    frame.now += 1;
    expect(presses.justPressed(key as unknown as Key)).toBe(false);
  });

  it('does not keep a short press for a later frame to act on', () => {
    const { key, presses, frame } = watched();
    key.down();
    key.up();
    frame.now += 1;
    expect(presses.justPressed(key as unknown as Key)).toBe(false);
  });
});
