import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SOUND_EFFECTS,
  SOUND_EFFECT_NAMES,
  ducksMusic,
  soundEffectLength,
  type SoundChannel,
  type SoundEffect,
} from './soundEffects';

/** The longest an effect on each channel may sound, in seconds. */
const LONGEST: Record<SoundChannel, number> = {
  // The cursor is heard hundreds of times a session.
  ui: 0.25,
  world: 0.55,
  battle: 0.6,
  alert: 0.7,
  // A fanfare is the last word on something, and still has to be over before
  // the player has read the line it goes with.
  fanfare: 1,
};

const effects = SOUND_EFFECT_NAMES.map((name) => [name, SOUND_EFFECTS[name] as SoundEffect] as const);

/** The loudest the effect's voices ever add up to. */
function peakGain(effect: SoundEffect): number {
  return Math.max(
    ...effect.tones.map((tone) => {
      const at = (tone.delay ?? 0) + 0.01;
      return effect.tones
        .filter((other) => (other.delay ?? 0) <= at && at < (other.delay ?? 0) + other.duration)
        .reduce((total, other) => total + other.volume, 0);
    }),
  );
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : [];
  });
}

describe('the sound-effect vocabulary', () => {
  it.each(effects)('%s is short enough for its channel', (_name, effect) => {
    expect(effect.tones.length).toBeGreaterThan(0);
    expect(soundEffectLength(effect)).toBeLessThanOrEqual(LONGEST[effect.channel]);
  });

  it.each(effects)('%s ends: nothing in it can outlive the scene that asked for it', (_name, effect) => {
    for (const tone of effect.tones) {
      expect(Number.isFinite(tone.duration)).toBe(true);
      expect(tone.duration).toBeGreaterThan(0);
      expect(tone.delay ?? 0).toBeGreaterThanOrEqual(0);
    }
  });

  it.each(effects)('%s stays inside a comfortable loudness', (_name, effect) => {
    for (const tone of effect.tones) {
      expect(tone.volume).toBeGreaterThan(0);
      expect(tone.volume).toBeLessThanOrEqual(0.1);
    }
    expect(peakGain(effect)).toBeLessThanOrEqual(0.22);
  });

  it.each(effects)('%s stays where a laptop speaker can say it and an ear can bear it', (_name, effect) => {
    for (const tone of effect.tones) {
      for (const frequency of [tone.frequency, tone.slideTo ?? tone.frequency]) {
        expect(frequency).toBeGreaterThanOrEqual(80);
        expect(frequency).toBeLessThanOrEqual(tone.wave === 'noise' ? 6000 : 1600);
      }
    }
  });

  it('gives every moment a sound of its own', () => {
    const signature = (effect: SoundEffect): string =>
      effect.tones
        .map((tone) => `${tone.wave}:${tone.frequency}>${tone.slideTo ?? ''}@${tone.delay ?? 0}`)
        .join('|');
    const seen = new Map<string, string>();
    for (const [name, effect] of effects) {
      const key = signature(effect);
      expect(seen.get(key), `${name} sounds exactly like ${seen.get(key)}`).toBeUndefined();
      seen.set(key, name);
    }
  });

  it('keeps the footstep the quietest thing the map says, and nothing but noise', () => {
    // Filtered noise carries about a third of the level a tone of the same gain
    // does (measured: the rustle peaks near 0.015 against the cursor's 0.030),
    // so being under every other world effect on paper is comfortably under on air.
    const loudest = (effect: SoundEffect) => Math.max(...effect.tones.map((tone) => tone.volume));
    const rustle: SoundEffect = SOUND_EFFECTS.grassRustle;
    expect(rustle.tones.every((tone) => tone.wave === 'noise')).toBe(true);
    for (const [name, effect] of effects) {
      if (name !== 'grassRustle' && effect.channel === 'world') {
        expect(loudest(effect), name).toBeGreaterThan(loudest(rustle));
      }
    }
  });

  it('describes every effect for the sound board', () => {
    for (const [, effect] of effects) {
      expect(effect.moment.length).toBeGreaterThan(8);
    }
  });

  it('has no effect that nothing in the game plays', () => {
    const game = sourceFiles(join(__dirname, '..'))
      .filter((path) => !path.endsWith('soundEffects.ts') && !path.endsWith('TestLabScene.ts'))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    for (const name of SOUND_EFFECT_NAMES) {
      expect(game.includes(`'${name}'`), `${name} is defined but never played`).toBe(true);
    }
  });

  it('leaves music out of it: no scene reaches past play() for a tone of its own', () => {
    for (const path of sourceFiles(join(__dirname, '..', 'scenes'))) {
      const source = readFileSync(path, 'utf8');
      expect(source, path).not.toMatch(/createOscillator|new AudioContext/);
    }
  });

  it('ducks the music only for a fanfare and the one-off alert stings', () => {
    const ducking = effects.filter(([, effect]) => ducksMusic(effect)).map(([name]) => name);
    for (const [name, effect] of effects) {
      if (effect.channel === 'fanfare') {
        expect(ducking, name).toContain(name);
      }
      if (effect.channel === 'ui' || effect.channel === 'world' || effect.channel === 'battle') {
        expect(ducking, `${name} would duck the music on every step`).not.toContain(name);
      }
    }
    // The rhythmic alerts would hold the music down for a whole chase.
    for (const name of ['hunterNear', 'clockUrgent', 'lowHp'] as const) {
      expect(ducking).not.toContain(name);
    }
  });
});
