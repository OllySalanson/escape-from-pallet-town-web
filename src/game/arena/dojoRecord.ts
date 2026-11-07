/**
 * The one thing THE BATTLE ARENA keeps of a bout (`dojoCounter.ts`), written by
 * the room as the player comes back to it and never by the fight: how many were
 * won and lost, which of the dojo's regulars and Black Belts have been beaten at
 * least once, and where the player stands on the class ladder (`classes.ts`) -
 * their class, the run of wins in it, and whether AARON has been beaten. It
 * stands apart from the counter because the save reads it, and the counter
 * reads the species tables. Phaser-free, optional in the save with no version
 * bump: absent is a player who has never fought there, in POKé BALL class.
 */

/** The four classes, lowest first (`classes.ts` says who is in each). */
export const DOJO_CLASS_IDS = ['poke-ball', 'great-ball', 'ultra-ball', 'master-ball'] as const;
export type DojoClassId = (typeof DOJO_CLASS_IDS)[number];

export interface DojoRecord {
  readonly wins: number;
  readonly losses: number;
  /** Everybody beaten at least once, by id (`bot:` a regular, `belt:` a Black Belt), in the order first beaten. */
  readonly beaten: readonly string[];
  /** The class the player is in; absent is POKé BALL, where everybody starts. It never drops. */
  readonly classId?: DojoClassId;
  /** The regulars beaten in a row in this class, by id: lost when a bout is lost, cleared on moving up. */
  readonly streak?: readonly string[];
  /** AARON, the head of MASTER BALL class, beaten: the top of the ladder. */
  readonly topped?: boolean;
}

export const NO_DOJO_BOUTS: DojoRecord = { wins: 0, losses: 0, beaten: [] };

/** The most opponents the record keeps names for: far more than the dojo will ever hold. */
const MOST_BEATEN = 64;

/** The most a run in a row is kept to: the record only ever needs three. */
const MOST_STREAK = 12;

/** The class a record is in. */
export function classOf(record: DojoRecord | undefined): DojoClassId {
  return record?.classId ?? 'poke-ball';
}

/** The tally of a bout alone: won or lost, and who has been beaten. The class ladder is `classes.ts`. */
export function afterDojoBout(record: DojoRecord | undefined, opponent: string, won: boolean): DojoRecord {
  const held = record ?? NO_DOJO_BOUTS;
  return won
    ? {
        ...held,
        wins: held.wins + 1,
        beaten: held.beaten.includes(opponent) ? held.beaten : [...held.beaten, opponent].slice(0, MOST_BEATEN),
      }
    : { ...held, losses: held.losses + 1 };
}

/** An opponent's id as the record will keep it: a harbour regular's or a Black Belt's, short and plain. */
export function isDojoOpponentId(value: unknown): value is string {
  return typeof value === 'string' && /^(bot|belt):[a-z0-9-]{1,24}$/.test(value);
}

export function isDojoClassId(value: unknown): value is DojoClassId {
  return typeof value === 'string' && (DOJO_CLASS_IDS as readonly string[]).includes(value);
}

const count = (value: unknown): number => (Number.isInteger(value) && (value as number) >= 0 ? (value as number) : 0);

const ids = (value: unknown, most: number): readonly string[] =>
  Array.isArray(value) ? [...new Set(value.filter(isDojoOpponentId))].slice(0, most) : [];

/** A record out of a save, or nothing if what is stored is not one. */
export function readDojoRecord(value: unknown): DojoRecord | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { wins, losses, beaten, classId, streak, topped } = value as Record<string, unknown>;
  const regularsOnly = ids(streak, MOST_STREAK).filter((id) => id.startsWith('bot:'));
  return {
    wins: count(wins),
    losses: count(losses),
    beaten: ids(beaten, MOST_BEATEN),
    ...(isDojoClassId(classId) && classId !== 'poke-ball' ? { classId } : {}),
    ...(regularsOnly.length > 0 ? { streak: regularsOnly } : {}),
    ...(topped === true ? { topped: true } : {}),
  };
}

/** The class a player shows on their name plate in the harbour: theirs once they have fought in the dojo, else none. */
export function shownClass(record: DojoRecord | undefined): DojoClassId | null {
  return record && record.wins + record.losses > 0 ? classOf(record) : null;
}
