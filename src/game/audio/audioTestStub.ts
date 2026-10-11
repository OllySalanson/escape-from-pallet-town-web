/**
 * A Web Audio stand-in that records what was scheduled, for tests that need to
 * know what would have sounded without a browser to sound it in.
 */
export interface StubSource {
  readonly kind: 'oscillator' | 'noise';
  frequency: number;
  started: boolean;
  /** The time `stop()` was last asked for; a cut voice is stopped early. */
  stopAt: number | null;
  /** When `start()` was asked for, in context seconds. */
  startAt: number | null;
  /** A sample's playback rate, set only for a buffer played as a recording (a cry). */
  rate: number | null;
}

/** One gain node's automation, in the order it was asked for. */
export interface StubGain {
  readonly events: { readonly kind: 'set' | 'target' | 'cancel'; readonly value: number; readonly at: number }[];
  /** The node's own `connect` target, so a test can tell the music bus from the master. */
  connectedTo: unknown;
}

export interface StubContext {
  readonly context: AudioContext;
  readonly sources: StubSource[];
  /** Every gain node made, in creation order: master, then music, then a voice each. */
  readonly gains: StubGain[];
  /** Moves the context clock, in seconds. */
  advance(seconds: number): void;
}

export function createStubAudioContext(): StubContext {
  const sources: StubSource[] = [];
  const param = (onSet?: (value: number) => void) => ({
    setValueAtTime: (value: number) => onSet?.(value),
    exponentialRampToValueAtTime: () => undefined,
    setTargetAtTime: () => undefined,
    cancelScheduledValues: () => undefined,
  });
  const gains: StubGain[] = [];
  const node = () => ({ connect: (target: unknown) => target });
  const gainNode = () => {
    const record: StubGain = { events: [], connectedTo: undefined };
    gains.push(record);
    return {
      connect: (target: unknown) => {
        record.connectedTo = target;
        return target;
      },
      gain: {
        setValueAtTime: (value: number, at: number) => record.events.push({ kind: 'set', value, at }),
        exponentialRampToValueAtTime: () => undefined,
        setTargetAtTime: (value: number, at: number) => record.events.push({ kind: 'target', value, at }),
        cancelScheduledValues: (at: number) => record.events.push({ kind: 'cancel', value: 0, at }),
      },
    };
  };
  const source = (kind: StubSource['kind']) => {
    const record: StubSource = { kind, frequency: 0, started: false, stopAt: null, startAt: null, rate: null };
    sources.push(record);
    return {
      ...node(),
      type: 'square',
      loop: false,
      buffer: null,
      frequency: param((value) => {
        record.frequency = value;
      }),
      playbackRate: param((value) => {
        record.rate = value;
      }),
      onended: null,
      start: (when = 0) => {
        record.started = true;
        record.startAt = when;
      },
      stop: (when: number) => {
        record.stopAt = when;
      },
    };
  };

  const context = {
    state: 'running',
    currentTime: 0,
    sampleRate: 8000,
    destination: {},
    resume: () => Promise.resolve(),
    createGain: gainNode,
    createBiquadFilter: () => ({ ...node(), type: 'lowpass', frequency: param() }),
    createBuffer: (_channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    }),
    createOscillator: () => source('oscillator'),
    createBufferSource: () => source('noise'),
    // A "decoded" file is as many seconds long as it has bytes at 1000 a
    // second, so a test chooses a cry's length by the size of what it fetches.
    decodeAudioData: (bytes: ArrayBuffer) => Promise.resolve({ duration: bytes.byteLength / 1000 }),
  };

  return {
    context: context as unknown as AudioContext,
    sources,
    gains,
    advance: (seconds) => {
      context.currentTime += seconds;
    },
  };
}
