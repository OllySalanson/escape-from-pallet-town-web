type AudioContextFactory = () => AudioContext | null;

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
  private readonly effectSources = new Set<AudioScheduledSourceNode>();
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

  public playSelect(): void {
    this.playTone(659, 0.05, 'square', 0.06);
  }

  public playConfirm(): void {
    this.playTone(523, 0.07, 'square', 0.07);
    this.playTone(784, 0.12, 'square', 0.06, 0.06);
  }

  public playCancel(): void {
    this.playTone(392, 0.06, 'square', 0.055);
    this.playTone(294, 0.1, 'square', 0.05, 0.05);
  }

  public playBump(): void {
    this.playTone(110, 0.08, 'triangle', 0.05);
  }

  public playAttackHit(): void {
    this.playTone(180, 0.05, 'sawtooth', 0.08);
    this.playTone(90, 0.1, 'square', 0.065, 0.025);
  }

  public playStrongHit(): void {
    this.playTone(220, 0.06, 'sawtooth', 0.1);
    this.playTone(440, 0.08, 'square', 0.075, 0.035);
    this.playTone(110, 0.14, 'triangle', 0.075, 0.055);
  }

  public playFaint(): void {
    [523, 440, 349, 262].forEach((frequency, index) =>
      this.playTone(frequency, 0.13, 'square', 0.065, index * 0.1),
    );
  }

  public playLowHpWarning(): void {
    this.playTone(880, 0.08, 'square', 0.07);
    this.playTone(880, 0.08, 'square', 0.07, 0.16);
  }

  public playLevelUp(): void {
    [523, 659, 784, 1047].forEach((frequency, index) =>
      this.playTone(frequency, 0.11, 'square', 0.07, index * 0.09),
    );
  }

  public playEncounter(): void {
    [262, 330, 392, 523].forEach((frequency, index) =>
      this.playTone(frequency, 0.07, 'square', 0.07, index * 0.06),
    );
  }

  public playLootPickup(): void {
    [523, 659, 784].forEach((frequency, index) =>
      this.playTone(frequency, 0.06, 'square', 0.06, index * 0.045),
    );
  }

  public playExtract(): void {
    [392, 523, 659, 784, 1047].forEach((frequency, index) =>
      this.playTone(frequency, 0.1, 'square', 0.075, index * 0.055),
    );
  }

  public playWipe(): void {
    [330, 262, 196].forEach((frequency, index) =>
      this.playTone(frequency, 0.14, 'sawtooth', 0.08, index * 0.09),
    );
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
    for (const source of this.effectSources) {
      source.stop();
    }
    this.effectSources.clear();
  }

  private playTone(
    frequency: number,
    duration: number,
    wave: OscillatorType,
    volume: number,
    delay = 0,
  ): void {
    if (this.muted || this.context === null || this.context.state !== 'running') {
      return;
    }

    this.playToneAt(
      frequency,
      duration,
      wave,
      volume,
      this.context.currentTime + delay,
      this.effectSources,
    );
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
