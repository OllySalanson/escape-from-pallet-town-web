import { isPlayerId } from '../harbour/harbourProtocol';

/**
 * A boss beaten in a raid room (the owner's pick, 13 Oct): **the door opens for
 * everybody that raid, and the win counts for whoever fought.**
 *
 * The winner's own raid does what a raid alone always did - the win is written
 * to their save, the gear is theirs, the doors stay open for them for good. It
 * also says so on the room's channel (`won`), and in every other member's raid
 * the keeper steps aside and their doors stand open for the rest of that raid,
 * and nothing is written to that member's save: they did not win it. A player
 * who drops in after the fight is told again, because every member says their
 * wins to whoever arrives.
 *
 * A `won` is believed only as far as a door this map has for that boss: a
 * message naming anybody else opens nothing. Phaser-free; `WorldScene` opens the
 * doors (`openedDoorKeys`, `trainersForCurrentMap`).
 */

/** A boss id as the game writes one (`world/trainers.ts`). */
const BOSS_ID = /^[a-z0-9-]{1,48}$/;

export interface WonSignal {
  readonly from: string;
  readonly bossId: string;
}

export function encodeWon(signal: WonSignal): Record<string, unknown> {
  return { k: 'w', u: signal.from, b: signal.bossId };
}

/** A win heard from another browser, or null if it is anything else. */
export function readWon(payload: unknown): WonSignal | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const { k, u, b } = payload as Record<string, unknown>;
  return k === 'w' && isPlayerId(u) && typeof b === 'string' && BOSS_ID.test(b) ? { from: u, bossId: b } : null;
}

/** The doors a room's wins open on one map: only bosses that map has a door for. */
export function roomOpenedDoors(won: ReadonlyMap<string, string>, bossesWithDoors: readonly string[]): readonly string[] {
  return [...won.keys()].filter((bossId) => bossesWithDoors.includes(bossId));
}
