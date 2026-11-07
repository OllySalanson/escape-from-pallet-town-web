/**
 * The one thing THE BATTLE ARENA keeps of a bout (`dojoCounter.ts`), written by
 * the room as the player comes back to it and never by the fight: how many were
 * won and lost, and which of the dojo's regulars have been beaten at least once.
 * It stands apart from the counter because the save reads it, and the counter
 * reads the species tables. Phaser-free, optional in the save with no version
 * bump: absent is a player who has never fought there.
 */

export interface DojoRecord {
  readonly wins: number;
  readonly losses: number;
  /** Every regular beaten at least once, by their harbour id, in the order first beaten. */
  readonly beaten: readonly string[];
}

export const NO_DOJO_BOUTS: DojoRecord = { wins: 0, losses: 0, beaten: [] };

/** The most opponents the record keeps names for: far more than the dojo will ever hold. */
const MOST_BEATEN = 64;

/** What a bout comes to. */
export function afterDojoBout(record: DojoRecord | undefined, opponent: string, won: boolean): DojoRecord {
  const held = record ?? NO_DOJO_BOUTS;
  return won
    ? {
        wins: held.wins + 1,
        losses: held.losses,
        beaten: held.beaten.includes(opponent) ? held.beaten : [...held.beaten, opponent].slice(0, MOST_BEATEN),
      }
    : { wins: held.wins, losses: held.losses + 1, beaten: held.beaten };
}

/** An opponent's id as the record will keep it: a harbour regular's, short and plain. */
export function isDojoOpponentId(value: unknown): value is string {
  return typeof value === 'string' && /^bot:[a-z0-9-]{1,24}$/.test(value);
}

const count = (value: unknown): number => (Number.isInteger(value) && (value as number) >= 0 ? (value as number) : 0);

/** A record out of a save, or nothing if what is stored is not one. */
export function readDojoRecord(value: unknown): DojoRecord | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { wins, losses, beaten } = value as { wins?: unknown; losses?: unknown; beaten?: unknown };
  return {
    wins: count(wins),
    losses: count(losses),
    beaten: Array.isArray(beaten) ? [...new Set(beaten.filter(isDojoOpponentId))].slice(0, MOST_BEATEN) : [],
  };
}
