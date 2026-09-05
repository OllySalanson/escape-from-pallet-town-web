type AudioContextFactory = () => AudioContext | null;

const THEME_NOTES = [262, 330, 392, 523, 392, 330, 294, 349] as const;
const THEME_NOTE_DURATION = 0.16;

/**
 * A small Web Audio wrapper for the game's synthesized music and effects.
 * Call activate from a user input handler before requesting audio playback.
 */
export class AudioManager {
  private context: AudioContext | null = null;
  private isThemePlaying = false;
  private muted = false;
  private nextThemeStart = 0;
  private readonly activeSources = new Set<AudioScheduledSourceNode>();
  private readonly contextFactory: AudioContextFactory;
  private themeTimer: number | null = null;

  public constructor(contextFactory: AudioContextFactory = createBrowserAudioContext) {
    this.contextFactory = contextFactory;
  }

  public get isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;

    if (muted) {
      this.stopTheme();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
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

    try {
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }
      return this.context.state === 'running';
    } catch {
      return false;
    }
  }

  public async startTheme(): Promise<void> {
    if (this.muted || this.isThemePlaying || !(await this.activate()) || this.context === null) {
      return;
    }

    this.isThemePlaying = true;
    this.nextThemeStart = this.context.currentTime + 0.05;
    this.scheduleThemeMeasure();
    this.themeTimer = window.setInterval(() => this.scheduleThemeMeasure(), 1000);
  }

  public stopTheme(): void {
    this.isThemePlaying = false;

    if (this.themeTimer !== null) {
      window.clearInterval(this.themeTimer);
      this.themeTimer = null;
    }

    for (const source of this.activeSources) {
      source.stop();
    }
    this.activeSources.clear();
  }

  public playSelect(): void {
    this.playTone(659, 0.05, 'square', 0.035);
  }

  public playConfirm(): void {
    this.playTone(523, 0.07, 'square', 0.045);
    this.playTone(784, 0.12, 'square', 0.04, 0.06);
  }

  public playBump(): void {
    this.playTone(110, 0.08, 'triangle', 0.05);
  }

  private scheduleThemeMeasure(): void {
    if (!this.isThemePlaying || this.muted || this.context === null) {
      return;
    }

    const context = this.context;
    this.nextThemeStart = Math.max(this.nextThemeStart, context.currentTime + 0.03);

    for (const frequency of THEME_NOTES) {
      this.playToneAt(frequency, THEME_NOTE_DURATION, 'square', 0.018, this.nextThemeStart);
      this.nextThemeStart += THEME_NOTE_DURATION;
    }
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

    this.playToneAt(frequency, duration, wave, volume, this.context.currentTime + delay);
  }

  private playToneAt(
    frequency: number,
    duration: number,
    wave: OscillatorType,
    volume: number,
    startTime: number,
  ): void {
    if (this.context === null) {
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
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.onended = () => this.activeSources.delete(oscillator);
    this.activeSources.add(oscillator);
    oscillator.start(startTime);
    oscillator.stop(endTime + 0.01);
  }
}

function createBrowserAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return new window.AudioContext();
}

export const audioManager = new AudioManager();
