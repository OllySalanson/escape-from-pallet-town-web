import { describe, expect, it } from 'vitest';
import { AudioManager, RETRIGGER_GUARD_S } from './AudioManager';
import { createStubAudioContext } from './audioTestStub';
import { SOUND_EFFECTS, SOUND_EFFECT_NAMES } from './soundEffects';

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
    expect(stub.sources).toHaveLength(0);
  });

  it('still plays sound effects while background themes are silenced', async () => {
    const stub = createStubAudioContext();
    const audio = new AudioManager(() => stub.context);

    await audio.activate();
    await audio.startTheme('overworld');
    audio.play('lootPickup');

    expect(stub.sources).toHaveLength(3);
    expect(stub.sources.every((oscillator) => oscillator.started)).toBe(true);

    audio.play('lowHp');
    expect(stub.sources).toHaveLength(5);
  });

  it('mutes sound effects when muted and resumes them when unmuted', async () => {
    const stub = createStubAudioContext();
    const audio = new AudioManager(() => stub.context);

    await audio.activate();
    audio.setMuted(true);
    audio.play('lootPickup');
    expect(stub.sources).toHaveLength(0);

    expect(audio.toggleMute()).toBe(false);
    audio.play('lootPickup');
    expect(stub.sources).toHaveLength(3);
  });

  it('sounds every effect in the vocabulary by name', async () => {
    for (const name of SOUND_EFFECT_NAMES) {
      const stub = createStubAudioContext();
      const audio = new AudioManager(() => stub.context);
      await audio.activate();

      expect(audio.play(name), name).toBe(true);
      expect(stub.sources, name).toHaveLength(SOUND_EFFECTS[name].tones.length);
      expect(stub.sources.every((source) => source.started), name).toBe(true);
      expect(audio.recentlyPlayed.map((played) => played.name)).toEqual([name]);
    }
  });

  it('sounds one event once, however many times it is asked for', async () => {
    const stub = createStubAudioContext();
    const audio = new AudioManager(() => stub.context);
    await audio.activate();

    expect(audio.play('encounter')).toBe(true);
    expect(audio.play('encounter')).toBe(false);
    stub.advance(RETRIGGER_GUARD_S / 2);
    expect(audio.play('encounter')).toBe(false);
    expect(stub.sources).toHaveLength(SOUND_EFFECTS.encounter.tones.length);

    // Later is a different event.
    stub.advance(RETRIGGER_GUARD_S);
    expect(audio.play('encounter')).toBe(true);
  });

  it('lets a channel say one thing at a time', async () => {
    const stub = createStubAudioContext();
    const audio = new AudioManager(() => stub.context);
    await audio.activate();

    audio.play('faint');
    const faint = [...stub.sources];
    const scheduledEnd = faint.map((source) => source.stopAt);
    stub.advance(0.1);
    audio.play('hitPhysical');

    // Every voice of the faint was pulled in to stop now rather than when it was due.
    faint.forEach((source, index) => {
      if (scheduledEnd[index]! > 0.2) {
        expect(source.stopAt).toBeLessThan(scheduledEnd[index]!);
      }
      expect(source.stopAt).toBeLessThan(0.2);
    });
  });

  it('never lets the cursor talk over the game, and lets it talk under a fanfare', async () => {
    const stub = createStubAudioContext();
    const audio = new AudioManager(() => stub.context);
    await audio.activate();

    // The key that advanced the line, then the hit the line describes.
    audio.play('confirm');
    const confirm = [...stub.sources];
    audio.play('hitPhysical');
    expect(confirm.every((source) => source.stopAt! < 0.05)).toBe(true);
    // Replaced before it was heard, so it is not on the record of what was.
    expect(audio.recentlyPlayed.map((played) => played.name)).toEqual(['hitPhysical']);

    stub.advance(1);
    audio.play('levelUp');
    const fanfare = stub.sources.slice(-SOUND_EFFECTS.levelUp.tones.length);
    const due = fanfare.map((source) => source.stopAt);
    audio.play('confirm');
    expect(fanfare.map((source) => source.stopAt)).toEqual(due);
  });

  it('cuts everything for a fanfare', async () => {
    const stub = createStubAudioContext();
    const audio = new AudioManager(() => stub.context);
    await audio.activate();

    audio.play('hunterArrival');
    const arrival = [...stub.sources];
    audio.play('extract');
    expect(arrival.every((source) => source.stopAt! < 0.05)).toBe(true);
  });

  it('cuts whatever is sounding when muted', async () => {
    const stub = createStubAudioContext();
    const audio = new AudioManager(() => stub.context);
    await audio.activate();

    audio.play('clockExpired');
    audio.setMuted(true);
    expect(stub.sources.every((source) => source.stopAt! < 0.05)).toBe(true);
  });

  it('lets the grass rustle give way to what the step found, unheard', async () => {
    const stub = createStubAudioContext();
    const audio = new AudioManager(() => stub.context);
    await audio.activate();

    audio.play('grassRustle');
    audio.play('encounter');
    expect(audio.recentlyPlayed.map((played) => played.name)).toEqual(['encounter']);

    stub.advance(1);
    audio.play('grassRustle');
    stub.advance(1);
    expect(audio.recentlyPlayed.map((played) => played.name)).toEqual(['encounter', 'grassRustle']);
  });
});
