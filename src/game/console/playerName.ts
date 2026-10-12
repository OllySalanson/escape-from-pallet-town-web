import { isCleanName } from '../world/wordFilter';

/**
 * The name a player goes by on the house console, and on every Pallet Town
 * leaderboard it shows.
 *
 * It is typed by the player, once, and kept on this device. It is the console
 * games' own rule exactly - Pallet Blocks cleans a name to capitals, digits and
 * `. ! ? ' -` with single spaces, ten at most (its README, `cleanName`) - so the
 * name on our board and the name in the game's title bar are always one name,
 * and every character in it is one Orange Kid draws. The database holds a name
 * to the same rule (`supabase/migrations/*_console_leaderboards.sql`), so a
 * browser that skips this is refused there instead.
 *
 * Names are shown to everybody who plays, children included, so a name also
 * passes the same word filter a player map's names do (`world/wordFilter.ts`),
 * which the database repeats.
 */

/** The longest name a board shows, and the longest a console game accepts. */
export const PLAYER_NAME_MAX_LENGTH = 10;

/** Every character a name may hold: what the pixel font draws and the games accept. */
const NAME_CHARACTER = /[A-Z0-9 .!?'-]/;

/**
 * What is left of a name as it is typed: capitals, only the characters a name
 * may hold, no run of spaces, and no more than ten. Leading spaces go; one
 * trailing space is kept, because it is the space before the next word.
 */
export function typedPlayerName(raw: string): string {
  return [...raw.toUpperCase()]
    .filter((character) => NAME_CHARACTER.test(character))
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/^ /, '')
    .slice(0, PLAYER_NAME_MAX_LENGTH);
}

/** A typed name made final: as typed, with no space at either end. */
export function cleanPlayerName(raw: string): string {
  return typedPlayerName(raw).trim();
}

export type PlayerNameCheck =
  | { readonly ok: true; readonly name: string }
  | { readonly ok: false; readonly problem: 'empty' | 'unkind' };

/** Whether a typed name can go on a board, and what to say if it cannot. */
export function checkPlayerName(raw: string): PlayerNameCheck {
  const name = cleanPlayerName(raw);
  if (!name) {
    return { ok: false, problem: 'empty' };
  }
  return isCleanName(name) ? { ok: true, name } : { ok: false, problem: 'unkind' };
}

/** What the console says about a name it refused. */
export function playerNameProblemLine(problem: 'empty' | 'unkind'): string {
  return problem === 'empty'
    ? 'Type a name first: letters and numbers, up to ten.'
    : 'Not that name. Everybody who plays sees the boards - pick another.';
}

/**
 * Where this device keeps the name: its own key, never inside a save. Names
 * started again when they became one each (`names/`, the owner's call for the
 * alpha), so this is a new key and a name kept under the old one is not read.
 */
export const PLAYER_NAME_STORAGE_KEY = 'escape-from-pallet-town.player.name';

type NameStore = Pick<Storage, 'getItem' | 'setItem'>;

function deviceStorage(): NameStore | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * The name this device plays under, or null if nobody has typed one yet. A
 * stored name is checked again on the way out, so a name the rules have since
 * tightened against is asked for afresh rather than posted and refused.
 */
export function loadPlayerName(store: NameStore | undefined = deviceStorage()): string | null {
  try {
    const stored = store?.getItem(PLAYER_NAME_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    const check = checkPlayerName(stored);
    return check.ok && check.name === stored ? check.name : null;
  } catch {
    return null;
  }
}

/** Keeps the name for next time. A browser that cannot store asks again next time. */
export function savePlayerName(name: string, store: NameStore | undefined = deviceStorage()): void {
  try {
    store?.setItem(PLAYER_NAME_STORAGE_KEY, name);
  } catch {
    // Nothing kept: the name is still used for this sitting.
  }
}
