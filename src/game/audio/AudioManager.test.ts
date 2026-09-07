import { describe, expect, it } from 'vitest';
import { AudioManager } from './AudioManager';

interface StubContext {
  readonly context: AudioContext;
  readonly oscillators: { frequency: number; started: boolean }[];
}

function createStubAudioContext(): StubContext {
  const oscillators: { frequency: number; started: boolean }[] = [];

  const createGain = () => {
    const node = {
      gain: {
        setValueAtTime: () => undefined,
        exponentialRampToValueAtTime: () => undefined,
      },
      connect: (target: unknown) => target,
    };
    return node;
  };

  const context = {
    state: 'running',
    currentTime: 0,
    destination: {},
    resume: () => Promise.resolve(),
    createGain,
    createOscillator: () => {
      const record = { frequency: 0, started: false };
      oscillators.push(record);
      return {
        type: 'square',
        frequency: {
          setValueAtTime: (value: number) => {
            record.frequency = value;
          },
        },
        connect: (target: unknown) => target,
        onended: null,
        start: () => {
          record.started = true;
        },
        stop: () => undefined,
      };
    },
  };

  return { context: context as unknown as AudioContext, oscillators };
}

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

  it('selects themes and clamps volume without Web Audio', async () => {
    const audio = new AudioManager(() => null);

    await audio.startTheme('battle');
    audio.setVolume(2);
    expect(audio.currentTheme).toBe('battle');
    expect(audio.currentVolume).toBe(1);

    audio.setVolume(-1);
    expect(audio.currentVolume).toBe(0);
  });

  it('keeps background themes silent while playtesting', async () => {
    const stub = createStubAudioContext();
    const audio = new AudioManager(() => stub.context);

    await expect(audio.activate()).resolves.toBe(true);
    await audio.startTheme('overworld');
    await audio.startTheme('battle');

    expect(audio.currentTheme).toBe('battle');
    expect(stub.oscillators).toHaveLength(0);
  });

  it('still plays sound effects while background themes are silenced', async () => {
    const stub = createStubAudioContext();
    const audio = new AudioManager(() => stub.context);

    await audio.activate();
    await audio.startTheme('overworld');
    audio.playLootPickup();

    expect(stub.oscillators).toHaveLength(3);
    expect(stub.oscillators.every((oscillator) => oscillator.started)).toBe(true);

    audio.playLowHpWarning();
    expect(stub.oscillators).toHaveLength(5);
  });

  it('mutes sound effects when muted and resumes them when unmuted', async () => {
    const stub = createStubAudioContext();
    const audio = new AudioManager(() => stub.context);

    await audio.activate();
    audio.setMuted(true);
    audio.playLootPickup();
    expect(stub.oscillators).toHaveLength(0);

    expect(audio.toggleMute()).toBe(false);
    audio.playLootPickup();
    expect(stub.oscillators).toHaveLength(3);
  });
});
