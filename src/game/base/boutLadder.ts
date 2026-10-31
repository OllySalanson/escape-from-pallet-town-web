import { HUNTER_RIVALS, type HunterRivalId } from '../world/hunters';

/**
 * The one thing a bout for show in THE RAID ARENA leaves behind it, written by the
 * hall and never by the fight (`arenaBouts.ts`): who has been beaten in a row. It
 * stands apart from that file because the save reads it, and the fight's own
 * helpers read the save.
 */

/** Who has been beaten in a row since the last loss, and how many times the player has gone through all five. */
export interface BoutRecord {
  readonly beaten: readonly HunterRivalId[];
  readonly ladders: number;
}

export const NO_BOUTS: BoutRecord = { beaten: [], ladders: 0 };

/** What a bout comes to on the ladder, and whether that was the fifth in a row. */
export function afterBout(record: BoutRecord | undefined, rival: HunterRivalId, won: boolean): { readonly record: BoutRecord; readonly ladderDone: boolean } {
  const held = record ?? NO_BOUTS;
  if (!won) {
    return { record: { beaten: [], ladders: held.ladders }, ladderDone: false };
  }
  const beaten = [...new Set([...held.beaten, rival])];
  return beaten.length >= HUNTER_RIVALS.length
    ? { record: { beaten: [], ladders: held.ladders + 1 }, ladderDone: true }
    : { record: { beaten, ladders: held.ladders }, ladderDone: false };
}

/** A record out of a save, or nothing if what is stored is not one. */
export function readBouts(value: unknown): BoutRecord | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { beaten, ladders } = value as { beaten?: unknown; ladders?: unknown };
  const known = new Set<string>(HUNTER_RIVALS.map((rival) => rival.id));
  return {
    beaten: Array.isArray(beaten) ? [...new Set(beaten.filter((id): id is HunterRivalId => typeof id === 'string' && known.has(id)))] : [],
    ladders: Number.isInteger(ladders) && (ladders as number) >= 0 ? (ladders as number) : 0,
  };
}
