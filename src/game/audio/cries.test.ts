import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AudioManager } from './AudioManager';
import { createStubAudioContext } from './audioTestStub';
import { CRY_SPECIES_COUNT, cryPlaybackRate, hasCry } from './cries';
import { SOUND_EFFECTS, SOUND_EFFECT_NAMES, isCryEffect, soundEffectLength } from './soundEffects';

const CRY_DIRECTORY = join(__dirname, '..', '..', '..', 'public', 'assets', 'cries');

/** A fake cry file this many seconds long, as the stub decodes it (1000 bytes a second). */
const cryOf = (seconds: number): ArrayBuffer => new ArrayBuffer(Math.round(seconds * 1000));

/** An activated manager whose cries are fetched from a table rather than the network. */
async function crying(lengths: Record<number, number> = {}) {
  const stub = createStubAudioContext();
  const fetched: number[] = [];
  const audio = new AudioManager(
    () => stub.context,
    (dexId) => {
      fetched.push(dexId);
      return Promise.resolve(cryOf(lengths[dexId] ?? 0.5));
    },
  );
  await audio.activate();
  return { stub, audio, fetched };
}

const crySources = (stub: ReturnType<typeof createStubAudioContext>) =>
  stub.sources.filter((source) => source.rate !== null);

describe("FireRed's cries, as shipped", () => {
  it('ships one cry for each of the 151, and nothing else', () => {
    const files = readdirSync(CRY_DIRECTORY).sort((a, b) => parseInt(a) - parseInt(b));
    expect(files).toEqual(Array.from({ length: CRY_SPECIES_COUNT }, (_, index) => `${index + 1}.wav`));
  });

  it.each(Array.from({ length: CRY_SPECIES_COUNT }, (_, index) => index + 1))(
    'cry %i is a plain mono 8-bit WAVE no longer than FireRed lets a cry sound',
    (dexId) => {
      const bytes = readFileSync(join(CRY_DIRECTORY, `${dexId}.wav`));
      expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
      expect(bytes.toString('ascii', 8, 16)).toBe('WAVEfmt ');
      expect(bytes.readUInt16LE(20)).toBe(1); // PCM
      expect(bytes.readUInt16LE(22)).toBe(1); // mono
      const rate = bytes.readUInt32LE(24);
      expect(rate).toBe(10512); // the GBA's own
      expect(bytes.readUInt16LE(34)).toBe(8);
      expect(bytes.toString('ascii', 36, 40)).toBe('data');
      const samples = bytes.readUInt32LE(40);
      expect(samples / rate).toBeGreaterThan(0.1);
      expect(samples / rate).toBeLessThanOrEqual(2.34);
    },
  );

  it('knows which Pokemon have a cry', () => {
    expect(hasCry(1)).toBe(true);
    expect(hasCry(151)).toBe(true);
    expect(hasCry(0)).toBe(false);
    expect(hasCry(152)).toBe(false);
    expect(hasCry(1.5)).toBe(false);
  });
});

describe('the cry effects', () => {
  const cryEffects = SOUND_EFFECT_NAMES.flatMap((name) => {
    const effect = SOUND_EFFECTS[name];
    return isCryEffect(effect) ? [[name, effect] as const] : [];
  });

  it('are an ordinary cry and a faint, at the pitches FireRed plays them at', () => {
    expect(Object.fromEntries(cryEffects.map(([name, effect]) => [name, effect.cryPitch]))).toEqual({
      cry: 15360,
      faintCry: 14440,
    });
    expect(cryPlaybackRate(SOUND_EFFECTS.cry.cryPitch)).toBe(1);
    // 920 FireRed units is three and a half semitones down.
    expect(cryPlaybackRate(SOUND_EFFECTS.faintCry.cryPitch)).toBeCloseTo(0.8125, 4);
  });

  it.each(cryEffects)('%s stands in with a tone effect when its sample is not there', (_name, effect) => {
    const standIn = SOUND_EFFECTS[effect.standIn as keyof typeof SOUND_EFFECTS];
    expect(standIn).toBeDefined();
    expect(isCryEffect(standIn)).toBe(false);
  });
});

describe('AudioManager sounding a cry', () => {
  it("plays the species' own sample, at the effect's speed", async () => {
    const { stub, audio, fetched } = await crying({ 16: 0.6 });
    await audio.loadCries([16]);

    expect(fetched).toEqual([16]);
    expect(audio.play('faintCry', { species: 16 })).toBe(true);
    expect(crySources(stub)).toHaveLength(1);
    expect(crySources(stub)[0].rate).toBeCloseTo(cryPlaybackRate(14440));
    expect(audio.recentlyPlayed).toEqual([{ name: 'faintCry', at: 0, species: 16 }]);
  });

  it('sounds its stand-in, and fetches the cry for next time, when the sample has not arrived', async () => {
    const { stub, audio, fetched } = await crying();

    expect(audio.play('faintCry', { species: 19 })).toBe(true);
    expect(crySources(stub)).toHaveLength(0);
    expect(audio.recentlyPlayed.map((played) => played.name)).toEqual(['faint']);
    expect(fetched).toEqual([19]);

    await audio.loadCries([19]);
    expect(audio.hasCryReady(19)).toBe(true);
  });

  it('says nothing for a cry with nobody to cry it', async () => {
    const { audio } = await crying();
    expect(audio.play('cry')).toBe(false);
    expect(audio.play('cry', { species: 999 })).toBe(false);
    expect(audio.recentlyPlayed).toEqual([]);
  });

  it('fetches each cry once, however often it is asked for', async () => {
    const { audio, fetched } = await crying();
    await Promise.all([audio.loadCries([4, 4, 7]), audio.loadCries([7])]);
    await audio.loadCries([4]);
    expect(fetched.sort()).toEqual([4, 7]);
  });

  it('fetches before the first gesture and decodes once there is a context to decode in', async () => {
    const stub = createStubAudioContext();
    let factoryCalls = 0;
    const audio = new AudioManager(
      () => {
        factoryCalls += 1;
        return stub.context;
      },
      () => Promise.resolve(cryOf(0.4)),
    );
    await audio.loadCries([25]);
    expect(factoryCalls).toBe(0);
    expect(audio.hasCryReady(25)).toBe(false);

    await audio.activate();
    await Promise.resolve();
    expect(audio.hasCryReady(25)).toBe(true);
  });

  it("is heard after the ball's pop that lets the Pokemon out, not on top of it", async () => {
    const { stub, audio } = await crying();
    await audio.loadCries([4]);

    audio.play('sendOut');
    audio.play('cry', { species: 4 });

    const pop = soundEffectLength(SOUND_EFFECTS.sendOut);
    expect(crySources(stub)[0].startAt).toBeCloseTo(pop);
    // And the pop is not cut for it: a cry waits, it does not interrupt. The
    // gains are the master, the music bus, then one a voice - the pop's.
    expect(stub.gains[2].events.some((event) => event.kind === 'cancel')).toBe(false);
  });

  it('follows the fanfare that says a catch held', async () => {
    const { stub, audio } = await crying();
    await audio.loadCries([16]);

    audio.play('catchSuccess');
    audio.play('cry', { species: 16 });

    expect(crySources(stub)[0].startAt).toBeCloseTo(soundEffectLength(SOUND_EFFECTS.catchSuccess));
  });

  it('lets two Pokemon sent out together cry one after the other', async () => {
    const { stub, audio } = await crying({ 1: 0.7, 4: 0.5 });
    await audio.loadCries([1, 4]);

    expect(audio.play('cry', { species: 1 })).toBe(true);
    expect(audio.play('cry', { species: 4 })).toBe(true);

    const [first, second] = crySources(stub);
    expect(first.startAt).toBe(0);
    expect(first.stopAt).toBeNull();
    expect(second.startAt).toBeCloseTo(0.7);
  });

  it('cries a slower faint for longer, and the next cry waits for all of it', async () => {
    const { stub, audio } = await crying({ 19: 0.5, 16: 0.5 });
    await audio.loadCries([19, 16]);

    audio.play('faintCry', { species: 19 });
    audio.play('cry', { species: 16 });

    expect(crySources(stub)[1].startAt).toBeCloseTo(0.5 / cryPlaybackRate(14440));
  });

  it('is cut by a fanfare, which is the last word on what just happened', async () => {
    const { stub, audio } = await crying();
    await audio.loadCries([16]);

    audio.play('cry', { species: 16 });
    stub.advance(0.1);
    audio.play('victory');

    expect(crySources(stub)[0].stopAt).not.toBeNull();
  });

  it('is not cut by a hit, which is a different channel', async () => {
    const { stub, audio } = await crying();
    await audio.loadCries([16]);

    audio.play('cry', { species: 16 });
    stub.advance(0.1);
    audio.play('hitPhysical');

    expect(crySources(stub)[0].stopAt).toBeNull();
  });

  it('is one cry for one event, but two Pokemon are two events', async () => {
    const { audio } = await crying();
    await audio.loadCries([1, 4]);

    expect(audio.play('cry', { species: 1 })).toBe(true);
    expect(audio.play('cry', { species: 1 })).toBe(false);
    expect(audio.play('cry', { species: 4 })).toBe(true);
  });

  it('stays silent while muted', async () => {
    const { audio } = await crying();
    await audio.loadCries([1]);
    audio.setMuted(true);
    expect(audio.play('cry', { species: 1 })).toBe(false);
  });
});
