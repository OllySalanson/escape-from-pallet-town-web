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

/**
 * THE BOLTHOLE's keys (`base/decorateMode.ts`): H picks the house up to
 * decorate it, and while it is being decorated R turns a piece, Q and E walk
 * the box and X puts a piece away. `BaseScene.bindControls` binds these.
 */
export const HOME_KEY_LETTERS = {
  decorate: 'H',
  turn: 'R',
  boxBack: 'Q',
  boxNext: 'E',
  putAway: 'X',
  knock: 'K',
} as const;

/**
 * A raid room's keys (`raidRoom/roomTalk.ts`): T opens the list of phrases, the
 * number keys say one, and G pings the tile stood on. `WorldScene.bindControls`
 * binds these.
 */
export const ROOM_KEY_LETTERS = {
  talk: 'T',
  ping: 'G',
} as const;

/** What a raid room's chip teaches until each has been done once. */
export function roomKeyHintLine(learned: ReadonlySet<string>): string {
  return [
    learned.has('talk') ? '' : keyHint(ROOM_KEY_LETTERS.talk, 'SAY'),
    learned.has('ping') ? '' : keyHint(ROOM_KEY_LETTERS.ping, 'PING'),
  ]
    .filter(Boolean)
    .join('  ');
}

/** Every key the save can have learned, in one list (`raidProgress.keysLearned`). */
export const LEARNABLE_KEYS = ['walk', 'objectives', 'look', 'bag', 'party', 'decorate', 'knock', 'talk', 'ping'] as const;
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

/**
 * What the player's own house says while nothing else is to be said: decorating
 * and knocking on somebody else's door, each until it has been done once.
 */
export function houseKeyHintLine(learned: ReadonlySet<string>, canKnock = true): string {
  return [
    learned.has('decorate') ? '' : keyHint(HOME_KEY_LETTERS.decorate, 'DECORATE'),
    learned.has('knock') || !canKnock ? '' : keyHint(HOME_KEY_LETTERS.knock, 'KNOCK'),
  ]
    .filter(Boolean)
    .join('   ');
}

/** What the step outside THE BOLTHOLE's door says: the way to somebody else's door. */
export const KNOCK_FROM_THE_STEP_HINT = keyHint(HOME_KEY_LETTERS.knock, 'KNOCK ON A DOOR');

/**
 * The keys while decorating, for what the player can do now: put down what is
 * in their hands, pick up what is under the cursor, or take something out of
 * the box. TURN is named only for a piece that has another way round
 * (`turns`): a table, a desk or a mat has one, and R does nothing to it.
 */
export function decorateKeyHintLine(now: 'holding' | 'on-a-piece' | 'on-the-floor', turns: boolean): string {
  const box = `[${HOME_KEY_LETTERS.boxBack}][${HOME_KEY_LETTERS.boxNext}] BOX`;
  const turn = turns ? [keyHint(HOME_KEY_LETTERS.turn, 'TURN')] : [];
  const keys =
    now === 'holding'
      ? ['[SPACE] PUT DOWN', ...turn, box, keyHint(HOME_KEY_LETTERS.putAway, 'PUT AWAY')]
      : now === 'on-a-piece'
        ? ['[SPACE] PICK UP', ...turn, keyHint(HOME_KEY_LETTERS.putAway, 'PUT AWAY'), keyHint(HOME_KEY_LETTERS.decorate, 'DONE')]
        : ['[SPACE] TAKE OUT', box, keyHint(HOME_KEY_LETTERS.decorate, 'DONE')];
  return keys.join('  ');
}
