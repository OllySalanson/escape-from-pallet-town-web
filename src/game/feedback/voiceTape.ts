/**
 * The voice half of a feedback message: press TALK once and it records, press
 * it again (or SEND) and it stops.
 *
 * The owner's ruling on the plan board (2026-10-10): not hold-to-talk. "Press
 * once and that will record all the way until you press it again. Or you
 * click the send button." So the tape runs until it is told to stop, up to
 * `MAX_VOICE_MS` in all, and pressing TALK after a stop records another clip
 * onto the end rather than over what was said.
 *
 * The microphone is open only while it is recording. Stopping releases it -
 * the browser's own "recording" light goes out - and a clip added later asks
 * for it again. Nothing is heard by anything before the player presses TALK.
 *
 * Clips are recorded in the browser's own compressed format at a speech
 * bitrate (`VOICE_BITS_PER_SECOND`, about 180 KB a minute), and turned into
 * text on the owner's PC, never in the browser - see the plan, decision 3.
 */

/** All the tape there is, across every clip of one message. */
export const MAX_VOICE_MS = 5 * 60 * 1000;

/** The most clips one message may hold: the lab names them voice-1 to voice-20. */
export const MAX_VOICE_CLIPS = 20;

/** When the timer turns red and the panel says how much is left. */
export const VOICE_WARNING_MS = MAX_VOICE_MS - 30 * 1000;

/** Speech, not music: 24 kb/s Opus is clear speech at about 180 KB a minute. */
export const VOICE_BITS_PER_SECOND = 24_000;

/**
 * How full the meter is for a peak amplitude (0 to 1): on a decibel scale, as a
 * recorder's meter is, because the browser's noise suppression leaves speech
 * quiet and a linear meter barely moved for a soft voice. -54 dB and below is
 * empty, -12 dB and above is full.
 */
export function meterLevel(peak: number): number {
  const decibels = 20 * Math.log10(Math.max(peak, 1e-6));
  return Math.min(1, Math.max(0, (decibels + 54) / 42));
}

/** What a recording looks like to the panel, which only draws it. */
export interface TapeReading {
  readonly recording: boolean;
  /** Every clip so far plus the one being recorded. */
  readonly totalMs: number;
  readonly clips: number;
  /** 0 to 1: how loud the microphone is now, for the meter. */
  readonly level: number;
}

/** The tape is running low: the timer turns red. */
export function tapeIsLow(totalMs: number): boolean {
  return totalMs >= VOICE_WARNING_MS;
}

/** The tape is used up: recording stops by itself, keeping what it has. */
export function tapeIsFull(totalMs: number): boolean {
  return totalMs >= MAX_VOICE_MS;
}

/** `m:ss`, the way the raid clock counts. */
export function tapeTime(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** The first format this browser can record, in the order a server and a PC both read best. */
export function chooseVoiceFormat(isSupported: (type: string) => boolean): string | null {
  const candidates = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm'];
  return candidates.find((type) => isSupported(type)) ?? null;
}

export type StartResult = 'recording' | 'refused' | 'unsupported' | 'full';

/**
 * A browser's microphone and recorder, held only between TALK and its stop.
 * `now` is injectable so the timing can be read in a test.
 */
export class VoiceTape {
  private readonly finished: Blob[] = [];
  private finishedMs = 0;
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private audio: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private samples: Float32Array<ArrayBuffer> | null = null;
  /** The meter's last reading, which falls away rather than dropping to nothing between words. */
  private held = 0;
  private startedAt = 0;
  private stopping: Promise<void> | null = null;
  private readonly now: () => number;

  public constructor(now: () => number = () => performance.now()) {
    this.now = now;
  }

  /** Whether this browser can record at all. */
  public static supported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.mediaDevices?.getUserMedia === 'function' &&
      typeof MediaRecorder !== 'undefined' &&
      chooseVoiceFormat((type) => MediaRecorder.isTypeSupported(type)) !== null
    );
  }

  public get clips(): readonly Blob[] {
    return this.finished;
  }

  public get recordedMs(): number {
    return this.finishedMs;
  }

  public reading(): TapeReading {
    const running = this.recorder !== null && this.stopping === null;
    return {
      recording: running,
      totalMs: this.finishedMs + (running ? this.now() - this.startedAt : 0),
      clips: this.finished.length,
      level: running ? this.level() : 0,
    };
  }

  public async start(): Promise<StartResult> {
    if (this.recorder) {
      return 'recording';
    }
    if (tapeIsFull(this.finishedMs) || this.finished.length >= MAX_VOICE_CLIPS) {
      return 'full';
    }
    if (!VoiceTape.supported()) {
      return 'unsupported';
    }
    const format = chooseVoiceFormat((type) => MediaRecorder.isTypeSupported(type))!;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      return 'refused';
    }
    const recorder = new MediaRecorder(stream, { mimeType: format, audioBitsPerSecond: VOICE_BITS_PER_SECOND });
    const chunks: Blob[] = [];
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    });
    const startedAt = this.now();
    this.stopping = null;
    this.stream = stream;
    this.recorder = recorder;
    this.startedAt = startedAt;
    this.listen(stream);
    recorder.addEventListener('stop', () => {
      const clip = new Blob(chunks, { type: recorder.mimeType || format });
      if (clip.size > 0) {
        this.finished.push(clip);
        this.finishedMs = Math.min(MAX_VOICE_MS, this.finishedMs + (this.now() - startedAt));
      }
      // A recorder that stopped on its own - the microphone unplugged, or its
      // permission taken back - is a clip that ended, not a tape still running.
      if (this.recorder === recorder && this.stopping === null) {
        this.release();
      }
    });
    recorder.start();
    return 'recording';
  }

  /** Stops the clip being recorded, keeps it, and lets go of the microphone. */
  public stop(): Promise<void> {
    const recorder = this.recorder;
    if (!recorder) {
      return Promise.resolve();
    }
    this.stopping ??= new Promise<void>((resolve) => {
      recorder.addEventListener('stop', () => resolve(), { once: true });
      recorder.stop();
    }).then(() => this.release());
    return this.stopping;
  }

  /** Throws every clip away and lets go of the microphone. */
  public async discard(): Promise<void> {
    await this.stop();
    this.finished.length = 0;
    this.finishedMs = 0;
  }

  private release(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.audio?.close().catch(() => undefined);
    this.stream = null;
    this.recorder = null;
    this.audio = null;
    this.analyser = null;
    this.samples = null;
    this.held = 0;
    this.stopping = null;
  }

  private listen(stream: MediaStream): void {
    try {
      this.audio = new AudioContext();
      this.analyser = this.audio.createAnalyser();
      this.analyser.fftSize = 256;
      this.samples = new Float32Array(new ArrayBuffer(this.analyser.fftSize * 4));
      this.audio.createMediaStreamSource(stream).connect(this.analyser);
      // A context made outside a click starts suspended and hears nothing.
      void this.audio.resume().catch(() => undefined);
    } catch {
      this.audio = null;
      this.analyser = null;
    }
  }

  private level(): number {
    if (!this.analyser || !this.samples) {
      return 0;
    }
    this.analyser.getFloatTimeDomainData(this.samples);
    let peak = 0;
    for (const sample of this.samples) {
      peak = Math.max(peak, Math.abs(sample));
    }
    // One reading is a few milliseconds of sound and a voice is not steady, so
    // a meter of raw readings flickers between words. Peaks are held and let
    // fall a fifth a reading, the way a recorder's needle falls back.
    this.held = Math.max(meterLevel(peak), this.held * 0.8);
    return this.held;
  }
}
