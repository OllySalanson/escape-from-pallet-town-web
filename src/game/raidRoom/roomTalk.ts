import type { GridPosition } from '../movement/gridMovement';
import { isPlayerId } from '../harbour/harbourProtocol';

/**
 * Talking in a raid room (the owner's pick, 13 Oct): six quick phrases and a
 * ping, and no typed chat.
 *
 * A phrase is a number into a fixed list, so nothing anybody sends is words of
 * their own and there is nothing to filter: a message that is not one of the
 * six is not a message. A ping marks the tile the sender is standing on, for
 * everybody, for a while, so "over here" can be followed across a map too big
 * to see. Both go over the room's channel (`HarbourWire.signal`) and are said
 * on the sender's name plate and the friend chip.
 *
 * Talk is paced at both ends: a browser says at most one phrase a second and a
 * half and pings at most once in three seconds, and a browser that hears faster
 * than that from somebody drops the extra - so a room cannot be flooded, even by
 * a browser that ignores its own pacing.
 *
 * Phaser-free; `WorldScene` draws it.
 */

/** The phrases, by number: the keys 1 to 6 while the list is open. */
export const ROOM_PHRASES = [
  'OVER HERE!',
  'HUNTER COMING!',
  'FOUND SOMETHING!',
  'WAIT FOR ME',
  'HEADING OUT',
  'THANKS!',
] as const;

/** The least time between two phrases from one player, said or heard. */
export const SAY_EVERY_MS = 1_500;

/** The least time between two pings from one player, sent or heard. */
export const PING_EVERY_MS = 3_000;

/** How long a phrase stays on its speaker's plate. */
export const PHRASE_SHOWN_MS = 4_000;

/** How long a ping's mark stays on the map. */
export const PING_SHOWN_MS = 15_000;

/** How long the phrase list stays open untouched. */
export const TALK_LIST_OPEN_MS = 6_000;

/** The largest tile a ping may mark: the same bound a figure's step has (`raidProtocol.ts`). */
const MAX_TILE = 2047;

export type TalkSignal =
  | { readonly kind: 'say'; readonly from: string; readonly phrase: number }
  | { readonly kind: 'ping'; readonly from: string; readonly tile: GridPosition };

export function encodeTalk(signal: TalkSignal): Record<string, unknown> {
  return signal.kind === 'say'
    ? { k: 's', u: signal.from, n: signal.phrase }
    : { k: 'g', u: signal.from, x: signal.tile.x, y: signal.tile.y };
}

const isTile = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_TILE;

/** A phrase or ping heard from another browser, or null if it is anything else. */
export function readTalk(payload: unknown): TalkSignal | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const { k, u, n, x, y } = payload as Record<string, unknown>;
  if (!isPlayerId(u)) {
    return null;
  }
  if (k === 's') {
    return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < ROOM_PHRASES.length
      ? { kind: 'say', from: u, phrase: n }
      : null;
  }
  if (k === 'g') {
    return isTile(x) && isTile(y) ? { kind: 'ping', from: u, tile: { x, y } } : null;
  }
  return null;
}

/** What one browser has heard said and pinged, and when - its own included. */
export class TalkBoard {
  private readonly phrases = new Map<string, { readonly phrase: number; readonly at: number }>();
  private readonly marks = new Map<string, { readonly tile: GridPosition; readonly at: number }>();

  /** Takes a phrase or ping, unless its sender is talking faster than the room allows. Returns whether it was taken. */
  public hear(signal: TalkSignal, now: number): boolean {
    if (signal.kind === 'say') {
      const last = this.phrases.get(signal.from);
      if (last && now - last.at < SAY_EVERY_MS) {
        return false;
      }
      this.phrases.set(signal.from, { phrase: signal.phrase, at: now });
      return true;
    }
    const last = this.marks.get(signal.from);
    if (last && now - last.at < PING_EVERY_MS) {
      return false;
    }
    this.marks.set(signal.from, { tile: { ...signal.tile }, at: now });
    return true;
  }

  /** The phrase a player is saying now, if any. */
  public saying(id: string, now: number): string | null {
    const said = this.phrases.get(id);
    return said && now - said.at < PHRASE_SHOWN_MS ? ROOM_PHRASES[said.phrase] ?? null : null;
  }

  /** Every ping still showing, by who sent it. */
  public pings(now: number): ReadonlyMap<string, GridPosition> {
    const showing = new Map<string, GridPosition>();
    for (const [id, mark] of this.marks) {
      if (now - mark.at < PING_SHOWN_MS) {
        showing.set(id, mark.tile);
      }
    }
    return showing;
  }

  /** Somebody left: what they said and marked goes with them. */
  public forget(id: string): void {
    this.phrases.delete(id);
    this.marks.delete(id);
  }

  public clear(): void {
    this.phrases.clear();
    this.marks.clear();
  }
}
