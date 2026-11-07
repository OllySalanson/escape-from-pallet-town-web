import {
  ARENA_KEY_LETTERS,
  FEEDBACK_KEY,
  HOME_KEY_LETTERS,
  MUTE_KEY,
  PACK_TURN_KEY,
  RAID_KEY_LETTERS,
  ROOM_KEY_LETTERS,
  TELESCOPE_KEY_LETTERS,
} from '../input/keyBindings';

/**
 * Every key a book in THE GREAT LIBRARY may teach, by what it does, and the
 * key as the game writes it in a hint (`[B]`).
 *
 * A book names a key only through this table (`{key:pack}` in its text,
 * `bookText.ts`), and a letter the game binds from a table of its own is read
 * from that table (`input/keyBindings.ts`), so a book cannot go on teaching a
 * key after the game has moved it. The few the scenes bind by name rather than
 * from a table - SPACE, ENTER, ESC, BACKSPACE, the arrows - are written here
 * once, beside where each is bound.
 */
export const LIBRARY_CONTROLS = {
  /** Walking, and moving a cursor: every scene's `createCursorKeys`. */
  walk: 'ARROWS',
  /** Walking too: `BaseScene.bindControls` and `WorldScene.bindControls` add W, A, S and D. */
  wasd: 'W A S D',
  /** Talk, read, open, choose: the `interact` keys in `BaseScene` and `WorldScene`, `confirmKey` in `BattleScene`. */
  interact: 'SPACE',
  /** The other choosing key, and the one a pack is laid out with (`ui/gridArranging.ts`). */
  confirm: 'ENTER',
  /** Back out of a screen, skip talk, put a piece back where it was. */
  back: 'ESC',
  /** A fight's back key beside ESC, and what stops an evolution (`BattleScene.backKey`). */
  battleBack: 'BACKSPACE',
  look: RAID_KEY_LETTERS.look,
  /** O: Professor Oak on the radio in a raid, the favours list at home - the same question. */
  oak: RAID_KEY_LETTERS.objectives,
  /** B: the pack in a raid, YOUR THINGS at home. */
  pack: RAID_KEY_LETTERS.bag,
  /** P: the team in a raid, YOUR TEAM at home. */
  team: RAID_KEY_LETTERS.party,
  say: ROOM_KEY_LETTERS.talk,
  ping: ROOM_KEY_LETTERS.ping,
  decorate: HOME_KEY_LETTERS.decorate,
  turnPiece: HOME_KEY_LETTERS.turn,
  boxBack: HOME_KEY_LETTERS.boxBack,
  boxNext: HOME_KEY_LETTERS.boxNext,
  putAway: HOME_KEY_LETTERS.putAway,
  coin: ARENA_KEY_LETTERS.coin,
  telescopeBack: TELESCOPE_KEY_LETTERS.wayBack,
  telescopeNext: TELESCOPE_KEY_LETTERS.wayNext,
  telescopeCloser: TELESCOPE_KEY_LETTERS.closer,
  packTurn: PACK_TURN_KEY,
  mute: MUTE_KEY,
  feedback: FEEDBACK_KEY,
} as const;

export type LibraryControl = keyof typeof LIBRARY_CONTROLS;

export function isLibraryControl(name: string): name is LibraryControl {
  return Object.hasOwn(LIBRARY_CONTROLS, name);
}
