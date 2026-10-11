/**
 * The letters the world scenes are played with, and the words the HUDs name
 * them by. One table, read by both the scene that binds a key and the hint that
 * names it, so a hint can never teach a key that does something else.
 *
 * Playtest 43 (a player who knew neither Pokemon nor extraction games) walked
 * the base with no hint at all about which keys to press, and never learned
 * that B opens the pack - so the raid in which a Potion would have saved the
 * team was lost with three in it. A key nothing on the screen names is a key
 * nobody presses, so a key is named until it has been used once
 * (`raidProgress.keysLearned`), and then gets out of the way.
 */

/** The raid's letter keys, by what they do. `WorldScene.bindControls` binds these. */
export const RAID_KEY_LETTERS = {
  objectives: 'O',
  look: 'L',
  bag: 'B',
  party: 'P',
} as const;

export type RaidKeyId = keyof typeof RAID_KEY_LETTERS;

/** What each raid key is called on the HUD, in the order the hint row lists them. */
export const RAID_KEY_WORDS: readonly (readonly [RaidKeyId, string])[] = [
  ['objectives', 'GUIDE'],
  ['look', 'LOOK'],
  ['bag', 'BAG'],
  ['party', 'TEAM'],
];

/** The two keys the raid screen is *read* with, named whenever the objective is news. */
export const READING_KEYS: readonly RaidKeyId[] = ['objectives', 'look'];

/** What the yard teaches until it has been done: walking, and the look. */
export type YardKeyId = 'walk' | 'look';

export const YARD_KEY_WORDS: readonly (readonly [YardKeyId, string, string])[] = [
  ['walk', 'ARROWS', 'WALK'],
  ['look', RAID_KEY_LETTERS.look, 'LOOK'],
];

/** Every key the save can have learned, in one list (`raidProgress.keysLearned`). */
export const LEARNABLE_KEYS = ['walk', 'objectives', 'look', 'bag', 'party'] as const;
export type LearnableKeyId = (typeof LEARNABLE_KEYS)[number];

export function isLearnableKey(value: unknown): value is LearnableKeyId {
  return typeof value === 'string' && (LEARNABLE_KEYS as readonly string[]).includes(value);
}

/** One key as the HUDs write it: `[B] BAG`. */
export function keyHint(key: string, word: string): string {
  return `[${key}] ${word}`;
}

/**
 * The raid keys to name: the reading pair while the objective is news, and
 * every key not yet used, in the table's order and each once.
 */
export function raidKeysToName(
  showDetail: boolean,
  learned: ReadonlySet<string>,
): readonly RaidKeyId[] {
  return RAID_KEY_WORDS.map(([id]) => id).filter(
    (id) => (showDetail && READING_KEYS.includes(id)) || !learned.has(id),
  );
}

export function raidKeyHintLine(keys: readonly RaidKeyId[]): string {
  return RAID_KEY_WORDS.filter(([id]) => keys.includes(id))
    .map(([id, word]) => keyHint(RAID_KEY_LETTERS[id], word))
    .join('  ');
}

/** What the yard says while nothing else is to be said: the keys not yet used. */
export function yardKeyHintLine(learned: ReadonlySet<string>): string {
  return YARD_KEY_WORDS.filter(([id]) => !learned.has(id))
    .map(([, key, word]) => keyHint(key, word))
    .join('   ');
}
