import type { Direction, GridPosition } from '../movement/gridMovement';
import { isPartnerSpecies, type PartnerSpeciesId } from '../base/partner';

/**
 * What the players in THE HARBOUR tell each other, and the one rule for reading
 * it: **nothing heard is believed beyond drawing it**.
 *
 * Every browser in the harbour sends where its own player walks, and draws
 * everybody else where they say they are. A message comes from another
 * player's browser, so it is untrusted input: it is read through
 * `readHarbourMove` and `readHarbourPresence`, which take only the shapes the
 * game sends - a known place, a short path of whole tiles on a map no bigger
 * than the format allows, a facing - and drop anything else whole. The one
 * thing a move carries beyond where its player walked is the kind of Pokemon
 * at their heel, read only as one of the partners the game has walking art
 * for (`base/partner.ts`), so all it can ever do is pick which of those
 * pictures is drawn: a kind this browser has no art for is not drawn, and the
 * steps are still believed. A message never carries a name: the name over a
 * figure is the one on that player's door, asked of the database by id
 * (`harbour_names`), so the word filter the database runs is the only one
 * that decides what anybody reads.
 *
 * Phaser-free and network-free, so the rules are tested here; the channel is
 * `harbourLink.ts` and the figures `harbourFigures.ts`.
 */

/** The private Realtime channel every player in the harbour is on. */
export const HARBOUR_TOPIC = 'harbour';

/** The broadcast event a step travels on. */
export const HARBOUR_MOVE_EVENT = 'move';

/** The most steps one message carries: a few hundred milliseconds of walking. */
export const HARBOUR_PATH_MAX = 8;

/**
 * How long a browser gathers its own steps before sending them: one message
 * for every two steps of walking, which keeps a busy harbour inside the free
 * plan's message allowance and is still well under half a second behind.
 */
export const HARBOUR_SEND_EVERY_MS = 300;

/** The largest place a figure may stand in: a map file's limit, with room to spare. */
const MAX_TILE = 255;

/** The rooms of the harbour everybody shares, by `rooms.ts` id. */
export const SHARED_HARBOUR_ROOMS = ['oaks-lab', 'pokemon-centre', 'brocks-workshop', 'bills-cottage'] as const;

/**
 * Where in the harbour a figure stands. The yard and the four keepers' rooms are
 * one place for everybody; a player's own house is theirs, so it is named by
 * whose it is - two players each at home are in two different houses.
 */
export type HarbourPlace = 'yard' | (typeof SHARED_HARBOUR_ROOMS)[number] | `house:${string}`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Whether this is an id a player could have: the shape Supabase gives one. */
export function isPlayerId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/** The place a player's own house is, downstairs or up. */
export function housePlace(ownerId: string, upstairs = false): HarbourPlace {
  return `house:${ownerId}${upstairs ? ':up' : ''}`;
}

/** Whether a string is a place the game sends. */
export function isHarbourPlace(value: unknown): value is HarbourPlace {
  if (typeof value !== 'string') {
    return false;
  }
  if (value === 'yard' || (SHARED_HARBOUR_ROOMS as readonly string[]).includes(value)) {
    return true;
  }
  const house = /^house:(.+?)(:up)?$/.exec(value);
  return house !== null && isPlayerId(house[1]);
}

/**
 * One message: who walked, where, along which tiles, facing which way at the
 * end - and the partner walking at their heel, if they have one.
 */
export interface HarbourMove<P extends string = HarbourPlace> {
  readonly from: string;
  readonly place: P;
  readonly path: readonly GridPosition[];
  readonly facing: Direction;
  readonly partner?: PartnerSpeciesId;
}

/** What goes on the wire for a move: short keys, whole numbers. */
export function encodeHarbourMove(move: HarbourMove): Record<string, unknown> {
  return {
    u: move.from,
    p: move.place,
    s: move.path.slice(-HARBOUR_PATH_MAX).map((tile) => [tile.x, tile.y]),
    f: move.facing,
    ...(move.partner ? { k: move.partner } : {}),
  };
}

const FACINGS: readonly Direction[] = ['up', 'down', 'left', 'right'];

function isTileNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_TILE;
}

/** A move heard from another browser, or null if it is anything but one the game sends. */
export function readHarbourMove(payload: unknown): HarbourMove | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const { u, p, s, f, k } = payload as Record<string, unknown>;
  if (!isPlayerId(u) || !isHarbourPlace(p) || typeof f !== 'string' || !FACINGS.includes(f as Direction)) {
    return null;
  }
  if (!Array.isArray(s) || s.length === 0 || s.length > HARBOUR_PATH_MAX) {
    return null;
  }
  const path: GridPosition[] = [];
  for (const step of s) {
    if (!Array.isArray(step) || step.length !== 2 || !isTileNumber(step[0]) || !isTileNumber(step[1])) {
      return null;
    }
    path.push({ x: step[0], y: step[1] });
  }
  const move: HarbourMove = { from: u, place: p, path, facing: f as Direction };
  // A partner is only ever one the game can draw; anything else leaves the player walking alone.
  return typeof k === 'string' && isPartnerSpecies(k) ? { ...move, partner: k } : move;
}

/** The broadcast event a nudge travels on. */
export const HARBOUR_NUDGE_EVENT = 'nudge';

/**
 * A nudge: one browser telling another "look now" - that it has knocked at its
 * door, so the owner asks the database at once rather than at its next look.
 * It is a hint and nothing more: a nudge that is not true costs one question.
 *
 * A nudge may also say that a knock is `gone` - the knocker stopped knocking -
 * so the owner is not asked about somebody who has walked off. It names the
 * knock by its id, which only the knocker and the owner hold, and all it can
 * do is take a question down.
 */
export interface HarbourNudge {
  readonly from: string;
  readonly to: string;
  readonly gone?: string;
}

export function encodeHarbourNudge(nudge: HarbourNudge): Record<string, unknown> {
  return nudge.gone ? { u: nudge.from, t: nudge.to, g: nudge.gone } : { u: nudge.from, t: nudge.to };
}

/** A nudge heard from another browser, or null if it is anything else. */
export function readHarbourNudge(payload: unknown): HarbourNudge | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const { u, t, g } = payload as Record<string, unknown>;
  if (!isPlayerId(u) || !isPlayerId(t)) {
    return null;
  }
  // A knock id is the same shape as a player's; anything else is only "look now".
  return isPlayerId(g) ? { from: u, to: t, gone: g } : { from: u, to: t };
}

/** What a player says about themselves on joining: only where they are. */
export function encodeHarbourPresence(place: HarbourPlace): Record<string, unknown> {
  return { p: place };
}

/** The place a presence says, or null if it says anything else. */
export function readHarbourPresence(payload: unknown): HarbourPlace | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const { p } = payload as Record<string, unknown>;
  return isHarbourPlace(p) ? p : null;
}
