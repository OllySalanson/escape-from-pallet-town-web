import type { Direction, GridPosition } from '../movement/gridMovement';
import { isPlayerId } from '../harbour/harbourProtocol';
import { HUNTER_RIVALS, type HunterRivalId } from '../world/hunters';

/**
 * One hunter for a raid room (the owner's pick, 13 Oct): every player on the
 * room's map is hunted by the same rival, which chases whoever of them is
 * nearest.
 *
 * There is no server to run it, so one browser does: the **keeper**, the
 * player with the lowest id among those on the map and not in a fight. The
 * keeper runs the hunter exactly as a raid alone does (`world/hunter.ts`) - it
 * only chooses its quarry among everybody, and steps when its quarry steps -
 * and says where it is whenever that changes. Everybody else draws the hunter
 * where the keeper says and runs none of their own. When the keeper leaves or
 * goes into a fight, the next takes over from the last state it heard, so the
 * hunter carries on rather than starting again.
 *
 * A catch is the caught player's own: their browser sees the hunter beside
 * them and fights it as it always has - their team, their clock, the hunter
 * mirroring *their* party (`hunterTeamFor`). While anybody fights it, it holds
 * where it stands (`busy`), and the fight's end is said (`after`): fled, and
 * where it fell back to and how long it searches; or beaten, and it is beaten
 * for the whole room.
 *
 * Nothing heard is believed beyond the hunter it describes: the worst a lying
 * browser can do is put the hunter somewhere, which is the keeper's to do
 * anyway. A catch is still asked of the player's own tile in their own world,
 * so no message can start a fight in somebody else's browser.
 *
 * Phaser-free and network-free; `WorldScene` is the glue.
 */

/** The hunter as the room shares it. */
export interface SharedHunter {
  readonly spawned: boolean;
  readonly defeated: boolean;
  readonly position: GridPosition | null;
  readonly facing: Direction;
  /** Raid time left before a hunter that lost the trail picks it back up. */
  readonly searchMs: number;
  /** Who is hunting: the keeper's rival, so everybody sees and fights the same one. */
  readonly rivalId: HunterRivalId;
}

/** What one browser tells the others about the hunter. */
export type HunterSignal =
  /** The keeper: where the hunter is now. */
  | { readonly kind: 'hunter'; readonly from: string; readonly hunter: SharedHunter }
  /** A player went into a fight (`withHunter`: the hunter's own), or (`busy` false) came out of one. */
  | { readonly kind: 'busy'; readonly from: string; readonly busy: boolean; readonly withHunter: boolean }
  /** A fight with the hunter ended, and this is the hunter it left. */
  | { readonly kind: 'after'; readonly from: string; readonly hunter: SharedHunter };

/** The largest tile a hunter may stand on: the same bound a figure's step has (`raidProtocol.ts`). */
const MAX_TILE = 2047;
/** The longest search window a message may say: longer than any `HUNTER_SEARCH_MS`. */
const MAX_SEARCH_MS = 120_000;
const FACINGS: readonly Direction[] = ['up', 'down', 'left', 'right'];
const RIVAL_IDS: readonly string[] = HUNTER_RIVALS.map((rival) => rival.id);

function encodeHunter(hunter: SharedHunter): Record<string, unknown> {
  return {
    s: hunter.spawned ? 1 : 0,
    d: hunter.defeated ? 1 : 0,
    x: hunter.position?.x ?? -1,
    y: hunter.position?.y ?? -1,
    f: hunter.facing,
    q: Math.round(hunter.searchMs),
    r: hunter.rivalId,
  };
}

/** What goes on the wire for a signal: short keys, whole numbers. */
export function encodeHunterSignal(signal: HunterSignal): Record<string, unknown> {
  switch (signal.kind) {
    case 'hunter':
      return { k: 'h', u: signal.from, ...encodeHunter(signal.hunter) };
    case 'after':
      return { k: 'a', u: signal.from, ...encodeHunter(signal.hunter) };
    case 'busy':
      return { k: 'b', u: signal.from, b: signal.busy ? 1 : 0, h: signal.withHunter ? 1 : 0 };
  }
}

const isFlag = (value: unknown): value is 0 | 1 => value === 0 || value === 1;
const isCoordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= -1 && value <= MAX_TILE;

function readHunter(body: Record<string, unknown>): SharedHunter | null {
  const { s, d, x, y, f, q, r } = body;
  if (!isFlag(s) || !isFlag(d) || !isCoordinate(x) || !isCoordinate(y) || typeof f !== 'string' || !FACINGS.includes(f as Direction)) {
    return null;
  }
  if (typeof q !== 'number' || !Number.isFinite(q) || q < 0 || q > MAX_SEARCH_MS) {
    return null;
  }
  if (typeof r !== 'string' || !RIVAL_IDS.includes(r)) {
    return null;
  }
  const placed = x >= 0 && y >= 0;
  if ((x < 0) !== (y < 0)) {
    return null;
  }
  return {
    spawned: s === 1,
    defeated: d === 1,
    position: placed ? { x, y } : null,
    facing: f as Direction,
    searchMs: q,
    rivalId: r as HunterRivalId,
  };
}

/** A hunter signal heard from another browser, or null if it is anything but one the game sends. */
export function readHunterSignal(payload: unknown): HunterSignal | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const body = payload as Record<string, unknown>;
  if (!isPlayerId(body.u)) {
    return null;
  }
  if (body.k === 'b') {
    return isFlag(body.b) && isFlag(body.h)
      ? { kind: 'busy', from: body.u, busy: body.b === 1, withHunter: body.h === 1 }
      : null;
  }
  if (body.k === 'h' || body.k === 'a') {
    const hunter = readHunter(body);
    return hunter ? { kind: body.k === 'h' ? 'hunter' : 'after', from: body.u, hunter } : null;
  }
  return null;
}

/** The keeper: the lowest id among the players on the map who are not in a fight, this one included. */
export function hunterKeeper(me: string, othersOnMap: readonly string[], busy: ReadonlySet<string>, meBusy = false): string {
  const free = [...(meBusy ? [] : [me]), ...othersOnMap.filter((id) => !busy.has(id))].sort();
  return free[0] ?? me;
}

/** Whoever of these players is nearest the hunter, by tiles; a tie goes to the lowest id. */
export function nearestQuarry<T extends { readonly id: string; readonly tile: GridPosition }>(
  hunter: GridPosition,
  players: readonly T[],
): T | null {
  let best: T | null = null;
  let bestDistance = Infinity;
  for (const player of [...players].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const distance = Math.abs(player.tile.x - hunter.x) + Math.abs(player.tile.y - hunter.y);
    if (distance < bestDistance) {
      best = player;
      bestDistance = distance;
    }
  }
  return best;
}

/** What a browser has heard of the room's hunter: its latest state, and who is in a fight. */
export class HunterBoard {
  private latestHeard: { readonly hunter: SharedHunter; readonly from: string; readonly at: number; readonly after: boolean } | null =
    null;
  private readonly fights = new Map<string, boolean>();
  /** Counts every word heard or said, so "newer" never depends on two arriving in different frames. */
  private count = 0;

  public hear(signal: HunterSignal): void {
    if (signal.kind === 'busy') {
      if (signal.busy) {
        this.fights.set(signal.from, signal.withHunter);
      } else {
        this.fights.delete(signal.from);
      }
      return;
    }
    // A fight's end is also the fighter coming out of it.
    if (signal.kind === 'after') {
      this.fights.delete(signal.from);
    }
    this.count += 1;
    this.latestHeard = { hunter: signal.hunter, from: signal.from, at: this.count, after: signal.kind === 'after' };
  }

  /** This browser's own word on the hunter, kept as the latest so a handover starts from it. */
  public said(hunter: SharedHunter, from: string): void {
    this.count += 1;
    this.latestHeard = { hunter, from, at: this.count, after: false };
  }

  /** Somebody left the room: whatever fight they were in is over for the hunter. */
  public forget(id: string): void {
    this.fights.delete(id);
  }

  /** The hunter as last heard of, from whom, and in what order (`at` only ever grows). */
  public get latest(): { readonly hunter: SharedHunter; readonly from: string; readonly at: number; readonly after: boolean } | null {
    return this.latestHeard;
  }

  /** Everybody in a fight now. */
  public get busy(): ReadonlySet<string> {
    return new Set(this.fights.keys());
  }

  /** Whether anybody is fighting the hunter itself, which holds it where it stands. */
  public get hunterHeld(): boolean {
    return [...this.fights.values()].some((withHunter) => withHunter);
  }

  public clear(): void {
    this.latestHeard = null;
    this.fights.clear();
  }
}
