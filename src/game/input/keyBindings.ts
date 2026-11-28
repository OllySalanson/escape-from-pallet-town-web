/**
 * The letters the world scenes are played with, and the words the HUDs name
 * them by. One table, read by both the scene that binds a key and the hint that
 * names it, so a hint can never teach a key that does something else.
 *
 * Playtest 43 (a player who knew neither Pokemon nor extraction games) walked
 * the base with no hint at all about which keys to press, and never learned
 * that B opens the pack - so the raid in which a Potion would have saved the
 * team was lost with three in it. A key nothing names is a key nobody presses.
 * The overworld is FireRed's screen and names no key on it (the harbour audit,
 * 27 Nov 2026), so the keys are named on the controls bar beside the game
 * (`ui/controlsBar.ts`), always, read off these tables. A key used once is
 * still written down (`raidProgress.keysLearned`): a newcomer's one line on
 * the screen, `[ARROWS] WALK`, goes once it has been done.
 */

/** The raid's letter keys, by what they do. `WorldScene.bindControls` binds these. */
export const RAID_KEY_LETTERS = {
  objectives: 'O',
  look: 'L',
  bag: 'B',
  party: 'P',
  map: 'M',
} as const;

export type RaidKeyId = keyof typeof RAID_KEY_LETTERS;

/** What each raid key is called on the controls bar, in the order it lists them. */
export const RAID_KEY_WORDS: readonly (readonly [RaidKeyId, string])[] = [
  ['objectives', 'OAK'],
  ['look', 'LOOK'],
  // PACK, never BAG: the screen B opens is headed PACK, and every refusal for
  // room sends the player to "drop something from the PACK" (`world/loot.ts`).
  ['bag', 'PACK'],
  ['party', 'TEAM'],
  // THE MAP (`ui/MapScreen.ts`): the whole of the place, fog where nobody has walked.
  ['map', 'MAP'],
];

/**
 * A raid room's keys (`raidRoom/roomTalk.ts`): T opens the list of phrases, the
 * number keys say one, and G pings the tile stood on. `WorldScene.bindControls`
 * binds these. THE HARBOUR's quick phrases are on the same T
 * (`harbour/harbourPhrases.ts`, `BaseScene.bindControls`).
 */
export const ROOM_KEY_LETTERS = {
  talk: 'T',
  ping: 'G',
} as const;

/**
 * What the yard teaches until it has been done: walking, the look, the
 * favours list - on O, the key the raid's field guide is on, because it is the
 * same question asked at home: what am I out for (`hub/favourList.ts`) - and
 * the quick phrases, on T as in a raid room.
 */
export type YardKeyId = 'walk' | 'look' | 'favours' | 'things' | 'team' | 'dex' | 'map' | 'talk';

/**
 * THE POKéDEX's key anywhere in the harbour (`scenes/PokedexScene.ts`): X, the
 * last letter of DEX, because D walks east and every other letter of the word
 * is somebody's already. The house's own X (`HOME_KEY_LETTERS.putAway`) is
 * only read while a piece is being decorated with, when this one is not.
 */
export const POKEDEX_KEY = 'X';

/**
 * YOUR THINGS is on B, the raid's pack key, because it is the same question
 * asked at home: what have I got (`scenes/ThingsScene.ts`). YOUR TEAM is on P,
 * the raid's party key, for the same reason: who am I taking (`scenes/TeamScene.ts`).
 */
export const YARD_KEY_WORDS: readonly (readonly [YardKeyId, string, string])[] = [
  ['walk', 'ARROWS', 'WALK'],
  ['look', RAID_KEY_LETTERS.look, 'LOOK'],
  ['favours', RAID_KEY_LETTERS.objectives, 'FAVOURS'],
  ['things', RAID_KEY_LETTERS.bag, 'THINGS'],
  ['team', RAID_KEY_LETTERS.party, 'TEAM'],
  ['dex', POKEDEX_KEY, 'DEX'],
  ['map', RAID_KEY_LETTERS.map, 'MAP'],
  ['talk', ROOM_KEY_LETTERS.talk, 'SAY'],
];

/**
 * THE BOLTHOLE's keys (`base/decorateMode.ts`): H (for house - F is
 * FEEDBACK everywhere) picks the house up to decorate it, and while it is
 * being decorated R turns a piece, Q and E walk the box and X puts a piece
 * away. `BaseScene.bindControls` binds these.
 */
export const HOME_KEY_LETTERS = {
  decorate: 'H',
  turn: 'R',
  boxBack: 'Q',
  boxNext: 'E',
  putAway: 'X',
} as const;

/** THE RAID ARENA's one letter: a coin over the rail (`base/pitCoins.ts`). `BaseScene.bindControls` binds it. */
export const ARENA_KEY_LETTERS = {
  coin: 'C',
} as const;

/**
 * The telescope's own letters (`base/valeOverview.ts`), bound with the rest by
 * `BaseScene.bindControls`. Q and E are the house's already, which walk a list
 * there too. The arrows and W, A, S and D pan it, as they walk everywhere else.
 */
export const TELESCOPE_KEY_LETTERS = {
  wayBack: 'Q',
  wayNext: 'E',
  closer: 'Z',
} as const;

/** THE MAP's one letter (`ui/MapScreen.ts`): Z, the telescope's closer, for close up and the whole place. */
export const CHART_ZOOM_KEY = TELESCOPE_KEY_LETTERS.closer;

/**
 * Three keys that work on every screen they are named on: N turns the sound
 * off and on (`BaseScene`, `WorldScene` and `BattleScene` bind it) - it was M
 * until M was THE MAP, the captain's key for it (25 Nov 2026) - F opens
 * the FEEDBACK panel (`feedback/feedbackDesk.ts`), and R turns a piece being
 * laid out in a pack (`ui/gridArranging.ts`). Named here so the books in THE
 * GREAT LIBRARY (`library/controls.ts`) teach the key that is bound.
 */
export const MUTE_KEY = 'N';
export const FEEDBACK_KEY = 'F';
export const PACK_TURN_KEY = 'R';

/** What the rail says about it until it has been done once, and only to somebody with a coin to toss. */
export function coinKeyHint(learned: ReadonlySet<string>): string {
  return learned.has('coin') ? '' : keyHint(ARENA_KEY_LETTERS.coin, 'TOSS A COIN');
}

/**
 * The phrase list as a raid room's chip shows it while T holds it open: each
 * phrase beside the number key that says it, bracketed as every other key the
 * HUD names. Written bare, Orange Kid's narrow 1 and its round O ran together
 * and "1 OVER HERE!" read "10VER HERE!".
 */
export function phraseListLines(phrases: readonly string[]): string[] {
  return phrases.map((phrase, index) => keyHint(String(index + 1), phrase));
}

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
export const LEARNABLE_KEYS = ['walk', 'objectives', 'look', 'bag', 'party', 'map', 'decorate', 'talk', 'ping', 'favours', 'things', 'team', 'dex', 'coin'] as const;
export type LearnableKeyId = (typeof LEARNABLE_KEYS)[number];

export function isLearnableKey(value: unknown): value is LearnableKeyId {
  return typeof value === 'string' && (LEARNABLE_KEYS as readonly string[]).includes(value);
}

/** One key as the HUDs write it: `[B] PACK`. */
export function keyHint(key: string, word: string): string {
  return `[${key}] ${word}`;
}

/**
 * What the yard would say while nothing else is to be said: the keys not yet
 * used. It is offered on the controls bar beside the game rather than written
 * on the harbour (`BaseScene.showMoment`), except a newcomer's `[ARROWS] WALK`.
 */
export function yardKeyHintLine(learned: ReadonlySet<string>, walkingOnly = false): string {
  return YARD_KEY_WORDS.filter(([id]) => !learned.has(id) && (!walkingOnly || id === 'walk'))
    .map(([, key, word]) => keyHint(key, word))
    .join('   ');
}

/**
 * What the player's own house says while nothing else is to be said: the
 * decorate key, always. It was named only until decorating had been done
 * once, so a piece bought or found afterwards came home to a house that never
 * said how to get it out of the box - and the explorer run, which has learned
 * every key, never named it at all (the captain bought furniture with tickets
 * and found none of it at home). Knocking on somebody else's door is the sign
 * in the front garden (`base/baseMap.ts`, `KNOCK_SIGN`), read like any sign.
 */
export function houseKeyHintLine(): string {
  return keyHint(HOME_KEY_LETTERS.decorate, 'DECORATE');
}

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
        ? // The box named here too: a newcomer saw only the table, and five more pieces waited in a box nothing mentioned (the critic tour).
          ['[SPACE] PICK UP', ...turn, keyHint(HOME_KEY_LETTERS.putAway, 'PUT AWAY'), box, keyHint(HOME_KEY_LETTERS.decorate, 'DONE')]
        : ['[SPACE] TAKE OUT', box, keyHint(HOME_KEY_LETTERS.decorate, 'DONE')];
  return keys.join('  ');
}
