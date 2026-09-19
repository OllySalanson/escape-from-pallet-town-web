/**
 * The game's whole sound-effect vocabulary, as data.
 *
 * Every effect is a handful of square, triangle, sawtooth and noise voices -
 * the four things a Game Boy could say - so there are no audio files to ship,
 * licence or wait on. It lives here rather than inside `AudioManager` for the
 * reason battle wording lives in `battlePresentation.ts`: a sound cannot be
 * reviewed from a diff, but its length, its loudness, the channel it takes and
 * whether it can be told apart from its neighbours can all be held by a test
 * that never opens an AudioContext.
 */

/**
 * Which voice an effect takes. A channel sounds one effect at a time - starting
 * one cuts whatever that channel was still saying - which is how the hardware
 * this is modelled on kept a busy moment from stacking into noise, and it is
 * the only mixing rule the game has. See `AudioManager.play()`.
 */
export type SoundChannel = 'ui' | 'world' | 'battle' | 'alert' | 'fanfare';

export type SoundWave = 'square' | 'triangle' | 'sawtooth' | 'noise';

export interface SoundTone {
  /** Pitch in Hz. For `noise` it is the low-pass cutoff, so it reads as brightness. */
  readonly frequency: number;
  /** Seconds. */
  readonly duration: number;
  readonly wave: SoundWave;
  /** Peak gain before the master volume. */
  readonly volume: number;
  /** Seconds after the effect starts. */
  readonly delay?: number;
  /** Glide to this pitch over the tone's length - the hardware's sweep. */
  readonly slideTo?: number;
}

export interface SoundEffect {
  readonly channel: SoundChannel;
  /** The player-facing moment this belongs to, as shown on the sound board. */
  readonly moment: string;
  readonly tones: readonly SoundTone[];
  /**
   * Gives way, unheard, to anything that replaces it in the same frame. Every
   * `ui` effect does; this is for the rare game sound that is only a default.
   */
  readonly yields?: boolean;
}

const sq = (frequency: number, duration: number, volume: number, delay = 0): SoundTone => ({
  frequency,
  duration,
  wave: 'square',
  volume,
  delay,
});

const tri = (frequency: number, duration: number, volume: number, delay = 0): SoundTone => ({
  frequency,
  duration,
  wave: 'triangle',
  volume,
  delay,
});

const saw = (frequency: number, duration: number, volume: number, delay = 0): SoundTone => ({
  frequency,
  duration,
  wave: 'sawtooth',
  volume,
  delay,
});

const noise = (cutoff: number, duration: number, volume: number, delay = 0): SoundTone => ({
  frequency: cutoff,
  duration,
  wave: 'noise',
  volume,
  delay,
});

const sweep = (tone: SoundTone, slideTo: number): SoundTone => ({ ...tone, slideTo });

/** Evenly spaced notes of one voice: the shape most of these effects have. */
const run = (
  frequencies: readonly number[],
  duration: number,
  volume: number,
  spacing: number,
  wave: Exclude<SoundWave, 'noise'> = 'square',
): SoundTone[] =>
  frequencies.map((frequency, index) => ({
    frequency,
    duration,
    wave,
    volume,
    delay: index * spacing,
  }));

export const SOUND_EFFECTS = {
  // --- ui: the cursor and its answers ------------------------------------
  select: {
    channel: 'ui',
    moment: 'Cursor moves / a menu button is chosen',
    tones: [sq(659, 0.05, 0.06)],
  },
  confirm: {
    channel: 'ui',
    moment: 'A choice is committed; dialogue advances in battle',
    tones: [sq(523, 0.07, 0.07), sq(784, 0.12, 0.06, 0.06)],
  },
  cancel: {
    channel: 'ui',
    moment: 'Back, close, walk away',
    tones: [sq(392, 0.06, 0.055), sq(294, 0.1, 0.05, 0.05)],
  },
  denied: {
    channel: 'ui',
    moment: 'The game says no: bag full, exit locked, loadout refused, no PP',
    tones: [sq(156, 0.07, 0.055), sq(156, 0.09, 0.055, 0.1)],
  },
  textAdvance: {
    channel: 'ui',
    moment: 'Overworld dialogue moves to its next line',
    tones: [sq(740, 0.035, 0.04)],
  },
  menuOpen: {
    channel: 'ui',
    moment: 'Bag, party or field guide opens over the raid',
    tones: [tri(440, 0.05, 0.06), tri(659, 0.07, 0.06, 0.04)],
  },
  menuClose: {
    channel: 'ui',
    moment: 'Bag, party or field guide closes',
    tones: [tri(659, 0.05, 0.06), tri(440, 0.07, 0.06, 0.04)],
  },

  // --- world: what the raid map says back --------------------------------
  bump: {
    channel: 'world',
    moment: 'Walking into something solid',
    tones: [tri(110, 0.08, 0.05)],
  },
  grassRustle: {
    channel: 'world',
    moment: 'A step enters tall grass - the only footstep, because it is the only ground with a risk on it',
    tones: [noise(2600, 0.05, 0.045), noise(1800, 0.06, 0.035, 0.045)],
    // The step that enters the grass is often the step that finds something in it.
    yields: true,
  },
  warp: {
    channel: 'world',
    moment: 'Passing through a door or a map edge',
    tones: [sweep(tri(330, 0.16, 0.06), 660)],
  },
  lootPickup: {
    channel: 'world',
    moment: 'Loose loot picked up',
    tones: run([523, 659, 784], 0.06, 0.06, 0.045),
  },
  cacheOpen: {
    channel: 'world',
    moment: 'A marked cache is opened for its reward',
    tones: [noise(900, 0.06, 0.05), ...run([392, 523, 659, 784], 0.07, 0.06, 0.05).map(later(0.06))],
  },
  landmarkWorked: {
    channel: 'world',
    moment: 'A landmark is worked - the sluice wheel turns, a station answers',
    tones: [tri(196, 0.09, 0.07), tri(262, 0.09, 0.07, 0.09), sq(392, 0.16, 0.05, 0.18)],
  },
  contractStop: {
    channel: 'world',
    moment: 'A contract stop is made',
    tones: [sq(784, 0.07, 0.06), sq(1047, 0.07, 0.06, 0.07), sq(784, 0.07, 0.05, 0.14), sq(1319, 0.18, 0.06, 0.21)],
  },
  heal: {
    channel: 'world',
    moment: 'Medicine used, or the recovery bay restores a Pokemon',
    tones: [sweep(tri(523, 0.22, 0.06), 1047), sq(1319, 0.06, 0.04, 0.2), sq(1568, 0.1, 0.04, 0.26)],
  },
  deploy: {
    channel: 'world',
    moment: 'The final check is confirmed and the raid drops in',
    tones: [saw(131, 0.1, 0.06), saw(196, 0.1, 0.06, 0.09), sq(262, 0.1, 0.06, 0.18), sq(392, 0.22, 0.065, 0.27)],
  },
  encounter: {
    channel: 'world',
    moment: 'The tall grass produces a wild Pokemon',
    tones: run([262, 330, 392, 523], 0.07, 0.07, 0.06),
  },

  // --- alert: things that are coming for you -----------------------------
  trainerSpotted: {
    channel: 'alert',
    moment: 'A trainer sees you, or you accept their challenge',
    tones: [sq(988, 0.06, 0.07), sq(1319, 0.18, 0.07, 0.06)],
  },
  hunterArrival: {
    channel: 'alert',
    moment: 'The rival hunter enters the raid',
    tones: [saw(147, 0.16, 0.07), saw(139, 0.16, 0.07, 0.16), sq(110, 0.3, 0.065, 0.32)],
  },
  hunterNear: {
    channel: 'alert',
    moment: 'The hunter closes to within a few tiles',
    tones: [tri(82, 0.09, 0.09), tri(82, 0.12, 0.075, 0.14)],
  },
  hunterContact: {
    channel: 'alert',
    moment: 'The hunter catches you',
    tones: [saw(220, 0.07, 0.08), saw(220, 0.07, 0.08, 0.09), sq(165, 0.24, 0.07, 0.18)],
  },
  hunterResume: {
    channel: 'alert',
    moment: 'The hunter stops searching and is back on your trail',
    tones: [sq(294, 0.07, 0.06), sq(277, 0.07, 0.06, 0.1), sq(294, 0.12, 0.06, 0.2)],
  },
  clockUrgent: {
    channel: 'alert',
    moment: 'The raid clock crosses into its urgent tier',
    tones: run([784, 784, 784], 0.08, 0.065, 0.16),
  },
  clockEnraged: {
    channel: 'alert',
    moment: 'The clock runs out of patience and the raid turns hostile',
    tones: run([880, 831, 880, 831], 0.08, 0.06, 0.1, 'sawtooth'),
  },

  // --- battle ------------------------------------------------------------
  battleStart: {
    channel: 'battle',
    moment: 'A trainer or hunter fight opens',
    tones: run([196, 247, 294, 392], 0.06, 0.06, 0.05, 'sawtooth'),
  },
  sendOut: {
    channel: 'battle',
    moment: 'A Pokemon is sent out or switched in',
    tones: [noise(3200, 0.05, 0.04), sweep(sq(523, 0.12, 0.055, 0.03), 784)],
  },
  hitPhysical: {
    channel: 'battle',
    moment: 'A physical move lands',
    tones: [noise(1200, 0.07, 0.07), saw(180, 0.05, 0.07), sq(90, 0.1, 0.06, 0.025)],
  },
  hitSpecial: {
    channel: 'battle',
    moment: 'A special move lands',
    tones: [sweep(sq(880, 0.14, 0.06), 220), noise(4200, 0.1, 0.035, 0.03)],
  },
  statusMove: {
    channel: 'battle',
    moment: 'A status move is used',
    tones: run([440, 554, 440, 554], 0.05, 0.05, 0.05, 'triangle'),
  },
  criticalHit: {
    channel: 'battle',
    moment: 'A critical hit',
    tones: [saw(220, 0.06, 0.1), sq(440, 0.08, 0.075, 0.035), tri(110, 0.14, 0.075, 0.055)],
  },
  superEffective: {
    channel: 'battle',
    moment: "It's super effective",
    tones: [noise(5000, 0.05, 0.04), sq(659, 0.05, 0.065), sq(988, 0.12, 0.065, 0.05)],
  },
  notVeryEffective: {
    channel: 'battle',
    moment: "It's not very effective",
    tones: [tri(247, 0.1, 0.07), tri(196, 0.14, 0.06, 0.08)],
  },
  noEffect: {
    channel: 'battle',
    moment: 'The move does not affect the target',
    tones: [tri(147, 0.2, 0.06)],
  },
  miss: {
    channel: 'battle',
    moment: 'An attack misses',
    tones: [sweep(tri(700, 0.12, 0.045), 300)],
  },
  statUp: {
    channel: 'battle',
    moment: 'A stat rises',
    tones: run([440, 554, 659], 0.05, 0.055, 0.05),
  },
  statDown: {
    channel: 'battle',
    moment: 'A stat falls',
    tones: run([659, 554, 440], 0.05, 0.06, 0.05, 'triangle'),
  },
  statusApplied: {
    channel: 'battle',
    moment: 'Poison, burn, sleep, paralysis, freeze or confusion takes hold',
    tones: run([311, 294, 277], 0.08, 0.055, 0.08),
  },
  statusDamage: {
    channel: 'battle',
    moment: 'A status or confusion costs HP',
    tones: [saw(233, 0.06, 0.06), noise(1500, 0.06, 0.04, 0.02)],
  },
  lowHp: {
    // Not `battle`: it fires on the same frame as the hit that caused it, and
    // on the hit's own channel it would cut the hit off.
    channel: 'alert',
    moment: 'Your Pokemon drops into critical HP',
    // Held back a beat so the hit is heard and then the alarm, not both at once.
    tones: [sq(880, 0.08, 0.07, 0.14), sq(880, 0.08, 0.07, 0.3)],
  },
  faint: {
    channel: 'battle',
    moment: 'A Pokemon faints',
    tones: run([523, 440, 349, 262], 0.13, 0.065, 0.1),
  },
  ballThrow: {
    channel: 'battle',
    moment: 'A Poke Ball is thrown',
    tones: [sweep(tri(400, 0.18, 0.06), 1200)],
  },
  ballShake: {
    channel: 'battle',
    moment: 'The ball shakes',
    tones: [sq(196, 0.04, 0.06), tri(147, 0.07, 0.07, 0.04)],
  },
  ballBreak: {
    channel: 'battle',
    moment: 'The Pokemon breaks free',
    tones: [noise(3000, 0.1, 0.06), sweep(saw(330, 0.14, 0.055, 0.02), 165)],
  },
  flee: {
    channel: 'battle',
    moment: 'An escape succeeds',
    tones: run([659, 523, 392, 330], 0.04, 0.055, 0.04),
  },
  xpGain: {
    channel: 'battle',
    moment: 'Experience is awarded',
    tones: [sweep(tri(392, 0.2, 0.045), 784)],
  },

  // --- fanfare: the raid keeps score -------------------------------------
  levelUp: {
    channel: 'fanfare',
    moment: 'A Pokemon grows a level',
    tones: run([523, 659, 784, 1047], 0.11, 0.07, 0.09),
  },
  moveLearned: {
    channel: 'fanfare',
    moment: 'A new move is learned',
    tones: [sq(1047, 0.08, 0.06), sq(1319, 0.08, 0.06, 0.08), sq(1568, 0.2, 0.06, 0.16), tri(523, 0.3, 0.05, 0.16)],
  },
  catchSuccess: {
    channel: 'fanfare',
    moment: 'The catch holds',
    tones: [...run([587, 740, 880], 0.08, 0.065, 0.08), sq(1175, 0.28, 0.065, 0.24), tri(294, 0.28, 0.05, 0.24)],
  },
  victory: {
    channel: 'fanfare',
    moment: 'A trainer or the hunter is beaten',
    tones: [sq(523, 0.07, 0.065), sq(523, 0.07, 0.065, 0.09), sq(523, 0.07, 0.065, 0.18), sq(659, 0.1, 0.065, 0.27), sq(784, 0.26, 0.07, 0.38), tri(196, 0.26, 0.05, 0.38)],
  },
  extract: {
    channel: 'fanfare',
    moment: 'Extraction - the haul is out',
    tones: run([392, 523, 659, 784, 1047], 0.1, 0.075, 0.055),
  },
  contractBanked: {
    channel: 'fanfare',
    moment: 'The result screen confirms a banked contract',
    tones: [sq(659, 0.08, 0.06), sq(784, 0.08, 0.06, 0.09), sq(1047, 0.08, 0.06, 0.18), sq(1319, 0.24, 0.065, 0.27), tri(330, 0.3, 0.05, 0.27)],
  },
  clockExpired: {
    channel: 'fanfare',
    moment: 'The raid clock hits zero',
    tones: [tri(440, 0.18, 0.08), tri(440, 0.18, 0.08, 0.2), tri(440, 0.18, 0.08, 0.4), saw(110, 0.3, 0.06, 0.6)],
  },
  wipe: {
    channel: 'fanfare',
    moment: 'The last Pokemon falls and the raid is lost',
    tones: run([330, 262, 196], 0.14, 0.08, 0.09, 'sawtooth'),
  },
  lossTaken: {
    channel: 'fanfare',
    moment: 'The defeat line-up: what you carried is taken',
    tones: [sweep(saw(196, 0.22, 0.06), 98), noise(700, 0.12, 0.04, 0.05)],
  },
  secureHeld: {
    channel: 'fanfare',
    moment: 'The defeat line-up: the secure slot held',
    tones: [tri(392, 0.08, 0.06), sq(587, 0.2, 0.055, 0.08)],
  },
} as const satisfies Record<string, SoundEffect>;

export type SoundEffectName = keyof typeof SOUND_EFFECTS;

export const SOUND_EFFECT_NAMES = Object.keys(SOUND_EFFECTS) as SoundEffectName[];

function later(seconds: number): (tone: SoundTone) => SoundTone {
  return (tone) => ({ ...tone, delay: (tone.delay ?? 0) + seconds });
}

/** How long an effect sounds for, start to silence, in seconds. */
export function soundEffectLength(effect: SoundEffect): number {
  return Math.max(...effect.tones.map((tone) => (tone.delay ?? 0) + tone.duration));
}
