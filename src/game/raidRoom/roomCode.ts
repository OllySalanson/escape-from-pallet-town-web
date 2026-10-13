/**
 * A raid room's code: what one friend reads out and the other types.
 *
 * Four consonants, because a code is read aloud over a call and typed on a
 * phone keyboard: no digit to mistake for a letter, and no vowel, so no code
 * ever spells a word. The database hands them out and holds the same rule
 * (`supabase/migrations/*_raid_rooms.sql`); this is the game's copy, for
 * tidying what is typed before it is sent.
 */

export const ROOM_CODE_LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';

export const ROOM_CODE_LENGTH = 4;

/** What is typed, as a code: capitals, only the letters a code is made of, at most four. */
export function typedRoomCode(raw: string): string {
  return [...raw.toUpperCase()]
    .filter((letter) => ROOM_CODE_LETTERS.includes(letter))
    .join('')
    .slice(0, ROOM_CODE_LENGTH);
}

/** Whether this is a whole code. */
export function isRoomCode(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length === ROOM_CODE_LENGTH &&
    [...value].every((letter) => ROOM_CODE_LETTERS.includes(letter))
  );
}

/** The private Realtime channel a room's players walk on. */
export function raidTopic(code: string): string {
  return `raid:${code}`;
}
