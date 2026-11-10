import { isPlayerId } from '../harbour/harbourProtocol';

/**
 * Loot to whoever steps on it first, in a raid room (the owner's pick, 13 Oct).
 *
 * Everybody in a room lays the same ground on its map from the room's own seed
 * (`generateRoomLoot`), and the database decides who picks each piece up
 * (`take_raid_loot`): the first claim holds, under a lock, so two players
 * stepping on one piece at once never both carry it out. A step onto a piece is
 * a claim; the piece is collected - into the pack, with its line - only once
 * the database says it is this player's, which on a network is a few hundred
 * milliseconds and never anything a player waits on. Whoever wins says so on
 * the room's channel (`took`), so everybody else sees it go at once; a player
 * who drops in late asks the database for what is already gone.
 *
 * The ledger here is what this browser knows; nothing in it is believed beyond
 * taking a piece off the map. A lying `took` can only hide a piece from one
 * screen - stepping on it still asks the database.
 */

/** A piece's key as the database holds a claim's (`raid_room_loot.loot_id`), and as the room's channel carries it. */
const LOOT_KEY = /^[A-Za-z0-9:_-]{1,80}$/;

export function isLootId(value: unknown): value is string {
  return typeof value === 'string' && LOOT_KEY.test(value);
}

/**
 * A piece's id as the room knows it. The database takes a claim's id only in
 * `LOOT_KEY`'s letters, and a map drawn as a file - Greystone Vale, the one
 * map in play - names its pieces `greystone-vale/spot-31`: every claim on the
 * vale was refused ("That is not a piece of loot."), heard as no answer, and
 * nothing in a friend raid could ever be picked up, while on the tab-to-tab
 * stand-in, which asks nothing of an id, every winner's `took` was thrown away
 * as malformed (the bug hunt of 9 Nov). So the slash is written `:s` and a
 * colon `:c`, which undoes exactly (`gameLootId`), and the game's own ids,
 * which the ledger and the map are keyed by, never change.
 */
export function roomLootKey(lootId: string): string {
  return lootId.replaceAll(':', ':c').replaceAll('/', ':s');
}

/** The game's id of a piece, from the key the room knows it by (`roomLootKey`). */
export function gameLootId(key: string): string {
  return key.replace(/:([cs])/g, (_, code: string) => (code === 's' ? '/' : ':'));
}

/** The signal a winner sends: who took which piece. */
export interface TookSignal {
  readonly from: string;
  readonly lootId: string;
}

export function encodeTook(signal: TookSignal): Record<string, unknown> {
  return { k: 't', u: signal.from, l: signal.lootId };
}

export function readTook(payload: unknown): TookSignal | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const { k, u, l } = payload as Record<string, unknown>;
  return k === 't' && isPlayerId(u) && isLootId(l) ? { from: u, lootId: l } : null;
}

/** Who holds which piece of the room's loot, as this browser has heard. */
export class LootLedger {
  private readonly holders = new Map<string, string>();
  private readonly claiming = new Set<string>();
  private readonly lost = new Set<string>();
  private readonly tried = new Set<string>();

  /** Who holds a piece, if anybody yet. */
  public holder(lootId: string): string | undefined {
    return this.holders.get(lootId);
  }

  /** Whether a claim on this piece is on its way. */
  public isClaiming(lootId: string): boolean {
    return this.claiming.has(lootId);
  }

  /** A claim is on its way. Returns false if one already is, or the piece is held. */
  public claim(lootId: string): boolean {
    if (this.claiming.has(lootId) || this.holders.has(lootId)) {
      return false;
    }
    this.claiming.add(lootId);
    return true;
  }

  /** The database's answer to this browser's own claim. `holder` null: no answer, so it may be claimed again. */
  public answered(lootId: string, holder: string | null, me: string): void {
    this.claiming.delete(lootId);
    if (holder === null) {
      return;
    }
    this.holders.set(lootId, holder);
    if (holder !== me) {
      this.lost.add(lootId);
    }
  }

  /** Somebody took a piece: heard on the channel, or read from the database. */
  public heard(lootId: string, holder: string): void {
    if (!this.holders.has(lootId)) {
      this.holders.set(lootId, holder);
    }
  }

  /** Whether this browser claimed a piece and somebody else had it first. Asked once. */
  public lostTheRace(lootId: string): boolean {
    return this.lost.delete(lootId);
  }

  /** Whether this browser has already tried to collect a piece it holds; true the first time it asks. */
  public firstTry(lootId: string): boolean {
    if (this.tried.has(lootId)) {
      return false;
    }
    this.tried.add(lootId);
    return true;
  }

  public clear(): void {
    this.holders.clear();
    this.claiming.clear();
    this.lost.clear();
    this.tried.clear();
  }
}
