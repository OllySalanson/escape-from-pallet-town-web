import {
  SOUND_EFFECTS,
  type SoundChannel,
  type SoundEffect,
  type SoundEffectName,
  type SoundTone,
} from './soundEffects';

type AudioContextFactory = () => AudioContext | null;

export interface PlayedSound {
  readonly name: SoundEffectName;
  /** AudioContext time, in seconds. */
  readonly at: number;
}

/** One sounding effect: everything it scheduled, behind one gain so it can be cut as a unit. */
interface Voice {
  readonly channel: SoundChannel;
  readonly gain: GainNode;
  readonly sources: Set<AudioScheduledSourceNode>;
  readonly logged: PlayedSound;
}

/** Two requests for the same effect closer together than this are one event. */
export const RETRIGGER_GUARD_S = 0.05;
const CUT_TIME_CONSTANT_S = 0.005;
/** How far ahead of the audio clock a cursor blip is scheduled. See `play()`. */
export const UI_LEAD_S = 0.04;
const PLAY_LOG_LIMIT = 64;

export type AudioTheme = 'title' | 'overworld' | 'battle';

interface ThemeDefinition {
  readonly melody: readonly number[];
  readonly bass: readonly number[];
  readonly noteDuration: number;
}

const THEMES: Record<AudioTheme, ThemeDefinition> = {
  title: {
    melody: [523, 659, 784, 1047, 784, 659, 587, 698],
    bass: [131, 131, 147, 147],
    noteDuration: 0.16,
  },
  overworld: {
    melody: [392, 440, 523, 587, 523, 440, 392, 330, 349, 392, 440, 523, 440, 392, 349, 330],
    bass: [98, 98, 110, 110, 87, 87, 98, 98],
    noteDuration: 0.14,
  },
  battle: {
    melody: [659, 784, 698, 831, 784, 698, 659, 587, 659, 784, 880, 784, 698, 659, 587, 523],
    bass: [165, 165, 147, 147, 131, 131, 147, 147],
    noteDuration: 0.11,
  },
};

const DEFAULT_VOLUME = 0.55;

/** Temporary playtesting measure: looping themes stay silent. Set to false to bring the music back. */
const SILENCE_BACKGROUND_THEMES: boolean = true;

/**
 * A small Web Audio wrapper for the game's synthesized music and effects.
 * Call activate from a user input handler before requesting audio playback.
 */
export class AudioManager {
  private context: AudioContext | null = null;
  private isThemePlaying = false;
  private muted = false;
  private volume = DEFAULT_VOLUME;
  private theme: AudioTheme = 'title';
  private nextThemeStart = 0;
  private readonly themeSources = new Set<AudioScheduledSourceNode>();
  private readonly voices = new Set<Voice>();
  private readonly lastPlayedAt = new Map<SoundEffectName, number>();
  private readonly played: PlayedSound[] = [];
  private noiseBuffer: AudioBuffer | null = null;
  private readonly contextFactory: AudioContextFactory;
  private themeTimer: number | null = null;
  private masterGain: GainNode | null = null;

  public constructor(contextFactory: AudioContextFactory = createBrowserAudioContext) {
    this.contextFactory = contextFactory;
  }

  public get isMuted(): boolean {
    return this.muted;
  }

  public get currentTheme(): AudioTheme {
    return this.theme;
  }

  public get currentVolume(): number {
    return this.volume;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;

    if (muted) {
      this.stopTheme();
      this.stopEffects();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    if (!this.muted) {
      void this.startTheme();
    }
    return this.muted;
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.updateMasterGain();
  }

  /**
   * Creates and resumes the AudioContext. Invoke only from a user gesture.
   */
  public async activate(): Promise<boolean> {
    if (this.context === null) {
      this.context = this.contextFactory();
    }

    if (this.context === null) {
      return false;
    }

    this.createMasterGain();
    try {
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }
      return this.context.state === 'running';
    } catch {
      return false;
    }
  }

  public async startTheme(theme: AudioTheme = this.theme): Promise<void> {
    if (this.theme !== theme) {
      this.stopTheme();
      this.theme = theme;
    }

    if (this.muted || this.isThemePlaying || !(await this.activate()) || this.context === null) {
      return;
    }

    if (SILENCE_BACKGROUND_THEMES) {
      return;
    }

    this.isThemePlaying = true;
    this.nextThemeStart = this.context.currentTime + 0.05;
    this.scheduleThemeMeasure();
    const measureDuration = THEMES[this.theme].melody.length * THEMES[this.theme].noteDuration;
    this.themeTimer = window.setInterval(
      () => this.scheduleThemeMeasure(),
      Math.max(250, measureDuration * 1000 - 100),
    );
  }

  public stopTheme(): void {
    this.isThemePlaying = false;

    if (this.themeTimer !== null) {
      window.clearInterval(this.themeTimer);
      this.themeTimer = null;
    }

    for (const source of this.themeSources) {
      source.stop();
    }
    this.themeSources.clear();
  }

  /**
   * Plays one effect from `SOUND_EFFECTS` by name. This is the only way an
   * effect is ever sounded, so the three rules that keep a busy moment from
   * turning into noise are all here rather than at forty call sites:
   *
   * - a channel says one thing at a time, so starting an effect cuts whatever
   *   its channel was still sounding;
   * - the cursor never talks over the game: anything that is not `ui` cuts
   *   `ui`, which is what keeps the blip of the key that advanced a line from
   *   landing on top of the hit that line describes, and a fanfare cuts
   *   everything because it is the last word on what just happened;
   * - one event is one sound: the same effect asked for twice inside
   *   `RETRIGGER_GUARD_S` sounds once.
   *
   * Returns whether it sounded.
   */
  public play(name: SoundEffectName): boolean {
    const context = this.context;
    if (this.muted || context === null || this.masterGain === null || context.state !== 'running') {
      return false;
    }

    const now = context.currentTime;
    const last = this.lastPlayedAt.get(name);
    if (last !== undefined && now - last < RETRIGGER_GUARD_S) {
      return false;
    }
    this.lastPlayedAt.set(name, now);

    const effect: SoundEffect = SOUND_EFFECTS[name];
    for (const voice of [...this.voices]) {
      if (
        voice.channel === effect.channel ||
        (voice.channel === 'ui' && effect.channel !== 'ui') ||
        effect.channel === 'fanfare'
      ) {
        this.cutVoice(voice, now);
      }
    }

    // The cursor starts a breath late. The browser's audio clock runs ahead of
    // the frame that is asking, so a blip started "now" has already sounded for
    // a few milliseconds by the time the game effect that replaces it, later in
    // the same frame, can cut it - which is a click. Started just ahead of the
    // clock, it is cut before it begins.
    const startsAt = now + (effect.channel === 'ui' || effect.yields ? UI_LEAD_S : 0);
    const gain = context.createGain();
    gain.gain.setValueAtTime(1, now);
    gain.connect(this.masterGain);
    const logged: PlayedSound = { name, at: startsAt };
    const voice: Voice = { channel: effect.channel, gain, sources: new Set(), logged };
    this.voices.add(voice);
    for (const tone of effect.tones) {
      this.scheduleEffectTone(context, voice, tone, startsAt);
    }

    this.played.push(logged);
    if (this.played.length > PLAY_LOG_LIMIT) {
      this.played.shift();
    }
    return true;
  }

  /**
   * What has sounded lately, oldest first, in AudioContext seconds. It exists
   * so "nothing plays twice for one event" can be checked against a played
   * raid rather than argued from the code.
   */
  public get recentlyPlayed(): readonly PlayedSound[] {
    return this.played;
  }

  private scheduleThemeMeasure(): void {
    if (!this.isThemePlaying || this.muted || this.context === null) {
      return;
    }

    const context = this.context;
    this.nextThemeStart = Math.max(this.nextThemeStart, context.currentTime + 0.03);

    const definition = THEMES[this.theme];
    const measureStart = this.nextThemeStart;
    for (const frequency of definition.melody) {
      this.playToneAt(
        frequency,
        definition.noteDuration * 0.88,
        'square',
        0.032,
        this.nextThemeStart,
        this.themeSources,
      );
      this.nextThemeStart += definition.noteDuration;
    }

    definition.bass.forEach((frequency, index) => {
      this.playToneAt(
        frequency,
        definition.noteDuration * 1.75,
        'triangle',
        0.028,
        measureStart + index * definition.noteDuration * 2,
        this.themeSources,
      );
    });
  }

  private stopEffects(): void {
    const now = this.context?.currentTime ?? 0;
    for (const voice of [...this.voices]) {
      this.cutVoice(voice, now);
    }
  }

  /** Fades a voice out over a few milliseconds: an abrupt stop is a click. */
  private cutVoice(voice: Voice, now: number): void {
    this.voices.delete(voice);
    // Cut before it began, it was never heard - and the log is a record of
    // what was heard.
    if (now < voice.logged.at) {
      const index = this.played.indexOf(voice.logged);
      if (index >= 0) {
        this.played.splice(index, 1);
      }
    }
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0, now, CUT_TIME_CONSTANT_S);
    for (const source of voice.sources) {
      source.onended = null;
      source.stop(now + CUT_TIME_CONSTANT_S * 6);
    }
    voice.sources.clear();
  }

  private scheduleEffectTone(
    context: AudioContext,
    voice: Voice,
    tone: SoundTone,
    effectStart: number,
  ): void {
    const startTime = effectStart + (tone.delay ?? 0);
    const endTime = startTime + tone.duration;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, startTime);
    envelope.gain.exponentialRampToValueAtTime(tone.volume, startTime + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, endTime);
    envelope.connect(voice.gain);

    let source: AudioScheduledSourceNode;
    if (tone.wave === 'noise') {
      const noise = context.createBufferSource();
      noise.buffer = this.noiseBufferFor(context);
      noise.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(tone.frequency, startTime);
      noise.connect(filter).connect(envelope);
      source = noise;
    } else {
      const oscillator = context.createOscillator();
      oscillator.type = tone.wave;
      oscillator.frequency.setValueAtTime(tone.frequency, startTime);
      if (tone.slideTo !== undefined) {
        oscillator.frequency.exponentialRampToValueAtTime(tone.slideTo, endTime);
      }
      oscillator.connect(envelope);
      source = oscillator;
    }

    source.onended = () => {
      voice.sources.delete(source);
      if (voice.sources.size === 0) {
        this.voices.delete(voice);
      }
    };
    voice.sources.add(source);
    source.start(startTime);
    source.stop(endTime + 0.01);
  }

  /** One second of white noise, made once: the fourth Game Boy voice. */
  private noiseBufferFor(context: AudioContext): AudioBuffer {
    if (this.noiseBuffer === null) {
      const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const samples = buffer.getChannelData(0);
      // A fixed sequence rather than Math.random, so the rustle the captain
      // auditions is the rustle that ships.
      let seed = 0x2f6e2b1;
      for (let index = 0; index < samples.length; index += 1) {
        seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
        samples[index] = seed / 0x80000000;
      }
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }

  private playToneAt(
    frequency: number,
    duration: number,
    wave: OscillatorType,
    volume: number,
    startTime: number,
    sources: Set<AudioScheduledSourceNode>,
  ): void {
    if (this.context === null || this.masterGain === null) {
      return;
    }

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const endTime = startTime + duration;

    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);
    oscillator.connect(gain).connect(this.masterGain);
    oscillator.onended = () => sources.delete(oscillator);
    sources.add(oscillator);
    oscillator.start(startTime);
    oscillator.stop(endTime + 0.01);
  }

  private createMasterGain(): void {
    if (this.context === null || this.masterGain !== null) {
      return;
    }

    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);
    this.updateMasterGain();
  }

  private updateMasterGain(): void {
    if (this.context === null || this.masterGain === null) {
      return;
    }

    this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.context.currentTime);
  }
}

function createBrowserAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return new window.AudioContext();
}

export const audioManager = new AudioManager();
