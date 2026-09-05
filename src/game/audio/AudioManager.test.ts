import { describe, expect, it } from 'vitest';
import { AudioManager } from './AudioManager';

describe('AudioManager', () => {
  it('tracks mute state without creating an AudioContext', () => {
    let factoryCalls = 0;
    const audio = new AudioManager(() => {
      factoryCalls += 1;
      return null;
    });

    expect(audio.isMuted).toBe(false);
    expect(audio.toggleMute()).toBe(true);
    expect(audio.isMuted).toBe(true);
    audio.setMuted(false);
    expect(audio.isMuted).toBe(false);
    expect(factoryCalls).toBe(0);
  });

  it('safely declines activation when Web Audio is unavailable', async () => {
    const audio = new AudioManager(() => null);

    await expect(audio.activate()).resolves.toBe(false);
  });
});
