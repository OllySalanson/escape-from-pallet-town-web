import { isPlayerId } from '../harbour/harbourProtocol';
import { isRoomCode, typedRoomCode, ROOM_CODE_LENGTH, ROOM_CODE_LETTERS, ROOM_SIZE } from './roomCode';

/**
 * Making, joining and leaving a raid room: the three things only the database
 * may decide (`supabase/migrations/*_raid_rooms.sql`). The game asks; whatever
 * comes back is what the room is.
 */

/** A room this browser holds: its code, its map, and who made it. */
export interface HeldRoom {
  readonly code: string;
  readonly mapId: string;
  /** Whether this player made the room or was let into it. */
  readonly role: 'host' | 'guest';
  /** This player's id, as the room's channel knows them. */
  readonly me: string;
  /** Who made the room, by the name on their door; null for the one who made it. */
  readonly hostName: string | null;
  /** The room's own seed, which lays the ground everybody in it shares (`generateRoomLoot`). */
  readonly seed: number;
}

/** What the database said to a claim on a piece of the room's loot. */
export type LootClaim =
  | { readonly outcome: 'yours' }
  | { readonly outcome: 'taken'; readonly by: string | null }
  | { readonly outcome: 'unreachable' };

export type RoomAnswer =
  | { readonly ok: true; readonly room: HeldRoom }
  | { readonly ok: false; readonly reason: string };

export interface RaidRoomService {
  /** A new room on this map, made under this player's name. */
  open(mapId: string, name: string): Promise<RoomAnswer>;
  /** Into the room with this code, under this player's name. */
  join(code: string, name: string): Promise<RoomAnswer>;
  /** Out of the room. Never fails: a room nobody answers for closes on its own within the hour. */
  leave(code: string): Promise<void>;
  /** Claims one piece of the room's loot: the first claim holds. */
  takeLoot(code: string, lootId: string): Promise<LootClaim>;
  /** Every piece already taken in the room, and by whom. */
  lootTaken(code: string): Promise<ReadonlyMap<string, string>>;
}

/** Said when the database could not be reached, or said nothing the game understands. */
export const ROOM_UNREACHABLE = 'Pallet Town is not answering. Check your connection and try again.';

/** Said for a code no open room has. */
export const ROOM_NOT_FOUND = 'No room has that code. Check it with your friend.';

/** Said for a room that already has four players in it (`ROOM_SIZE`). */
export const ROOM_FULL = 'That room is full: four players is a room.';

/**
 * The live service: the game's one anonymous sign-in, a named house (the
 * harbour's identity, which writes the name only when it is new to the
 * device), then the database's own functions. A refusal the database words -
 * "One room at a time." - is said as it is worded.
 */
export function liveRoomService(): RaidRoomService {
  const seenAs = async (name: string): Promise<string | null> => {
    const { liveIdentity } = await import('../harbour/harbour');
    return liveIdentity().seenAs(name);
  };
  return {
    async open(mapId, name) {
      try {
        const me = await seenAs(name);
        if (!me) {
          return { ok: false, reason: ROOM_UNREACHABLE };
        }
        const { supabase } = await import('../maker/supabaseClient');
        const db = await supabase();
        const { data, error } = await db.rpc('open_raid_room', { map_id: mapId });
        if (error) {
          return { ok: false, reason: worded(error.message) };
        }
        if (!isRoomCode(data)) {
          return { ok: false, reason: ROOM_UNREACHABLE };
        }
        const seed = await db.rpc('raid_room_seed', { room_code: data });
        return typeof seed.data === 'number'
          ? { ok: true, room: { code: data, mapId, role: 'host', me, hostName: null, seed: seed.data } }
          : { ok: false, reason: ROOM_UNREACHABLE };
      } catch {
        return { ok: false, reason: ROOM_UNREACHABLE };
      }
    },
    async join(code, name) {
      try {
        const me = await seenAs(name);
        if (!me) {
          return { ok: false, reason: ROOM_UNREACHABLE };
        }
        const { supabase } = await import('../maker/supabaseClient');
        const db = await supabase();
        const { data, error } = await db.rpc('join_raid_room', { room_code: code });
        if (error) {
          return { ok: false, reason: worded(error.message) };
        }
        const seed = data?.[0]?.outcome === 'joined' ? await db.rpc('raid_room_seed', { room_code: code }) : null;
        return joinAnswer(data?.[0], code, me, typeof seed?.data === 'number' ? seed.data : null);
      } catch {
        return { ok: false, reason: ROOM_UNREACHABLE };
      }
    },
    async leave(code) {
      try {
        const { supabase } = await import('../maker/supabaseClient');
        await (await supabase()).rpc('leave_raid_room', { room_code: code });
      } catch {
        // Closed on its own within the hour.
      }
    },
    async takeLoot(code, lootId) {
      try {
        const { supabase } = await import('../maker/supabaseClient');
        const { data, error } = await (await supabase()).rpc('take_raid_loot', { room_code: code, loot_id: lootId });
        const row = data?.[0];
        if (error || !row) {
          return { outcome: 'unreachable' };
        }
        return row.outcome === 'yours' ? { outcome: 'yours' } : { outcome: 'taken', by: row.taker_uid };
      } catch {
        return { outcome: 'unreachable' };
      }
    },
    async lootTaken(code) {
      try {
        const { supabase } = await import('../maker/supabaseClient');
        const { data } = await (await supabase()).rpc('raid_loot_taken', { room_code: code });
        return new Map((data ?? []).map((row) => [row.loot_id, row.taker_uid] as const));
      } catch {
        return new Map();
      }
    },
  };
}

/** What the database said to a join, as a room or a reason. */
export function joinAnswer(
  row: { readonly outcome: string; readonly map_id: string | null; readonly host_uid: string | null; readonly host_name: string | null } | undefined,
  code: string,
  me: string,
  seed: number | null,
): RoomAnswer {
  if (!row || row.outcome === 'no-room') {
    return { ok: false, reason: ROOM_NOT_FOUND };
  }
  if (row.outcome === 'full') {
    return { ok: false, reason: ROOM_FULL };
  }
  if (row.outcome !== 'joined' || !row.map_id || !isPlayerId(row.host_uid) || !row.host_name || seed === null) {
    return { ok: false, reason: ROOM_UNREACHABLE };
  }
  return {
    ok: true,
    room: {
      code,
      mapId: row.map_id,
      role: row.host_uid === me ? 'host' : 'guest',
      me,
      hostName: row.host_uid === me ? null : row.host_name,
      seed,
    },
  };
}

/**
 * A database refusal as a player reads it: the project's own sentences are
 * short and written for players; anything that is not one is said as the
 * connection trouble it most likely is.
 */
export function worded(message: string | undefined): string {
  if (message && message.length <= 80 && /^[A-Z][A-Za-z ,.'-]*\.(?: [A-Z][A-Za-z ,.'-]*\.)?$/.test(message)) {
    return message;
  }
  return ROOM_UNREACHABLE;
}

/** Where the local stand-in keeps its rooms: shared by every tab of the browser. */
export const LOCAL_ROOMS_KEY = 'eptw-raid-rooms-local';

interface LocalRoom {
  readonly mapId: string;
  readonly host: string;
  readonly hostName: string;
  readonly seed: number;
  members: string[];
  /** Loot taken, by piece id: whose it is. */
  taken?: Record<string, string>;
}

/**
 * The local stand-in, for test mode only: rooms in the browser's own storage,
 * so two tabs of one browser can make and join one without the network. The
 * id is the tab's, as the harbour's stand-in gives it.
 */
export function localRoomService(me: () => Promise<string>): RaidRoomService {
  const read = (): Record<string, LocalRoom> => {
    try {
      return JSON.parse(window.localStorage.getItem(LOCAL_ROOMS_KEY) ?? '{}') as Record<string, LocalRoom>;
    } catch {
      return {};
    }
  };
  const write = (rooms: Record<string, LocalRoom>): void => {
    window.localStorage.setItem(LOCAL_ROOMS_KEY, JSON.stringify(rooms));
  };
  return {
    async open(mapId, name) {
      const id = await me();
      const rooms = read();
      for (const room of Object.values(rooms)) {
        room.members = room.members.filter((member) => member !== id);
      }
      let code: string;
      do {
        code = Array.from(
          { length: ROOM_CODE_LENGTH },
          () => ROOM_CODE_LETTERS[Math.floor(Math.random() * ROOM_CODE_LETTERS.length)],
        ).join('');
      } while (rooms[code]?.members.length);
      const seed = Math.floor(Math.random() * 2_147_483_647);
      rooms[code] = { mapId, host: id, hostName: name, seed, members: [id] };
      write(rooms);
      return { ok: true, room: { code, mapId, role: 'host', me: id, hostName: null, seed } };
    },
    async join(typed) {
      const id = await me();
      const code = typedRoomCode(typed);
      const rooms = read();
      const room = rooms[code];
      if (!room || room.members.length === 0) {
        return { ok: false, reason: ROOM_NOT_FOUND };
      }
      if (!room.members.includes(id)) {
        if (room.members.length >= ROOM_SIZE) {
          return { ok: false, reason: ROOM_FULL };
        }
        room.members.push(id);
        write(rooms);
      }
      const host = room.host === id;
      return {
        ok: true,
        room: { code, mapId: room.mapId, role: host ? 'host' : 'guest', me: id, hostName: host ? null : room.hostName, seed: room.seed },
      };
    },
    async leave(code) {
      const id = await me();
      const rooms = read();
      const room = rooms[code];
      if (room) {
        room.members = room.members.filter((member) => member !== id);
        write(rooms);
      }
    },
    async takeLoot(code, lootId) {
      const id = await me();
      const rooms = read();
      const room = rooms[code];
      if (!room?.members.includes(id)) {
        return { outcome: 'unreachable' };
      }
      room.taken ??= {};
      const holder = room.taken[lootId];
      if (holder !== undefined) {
        return holder === id ? { outcome: 'yours' } : { outcome: 'taken', by: holder };
      }
      room.taken[lootId] = id;
      write(rooms);
      return { outcome: 'yours' };
    },
    lootTaken(code) {
      return Promise.resolve(new Map(Object.entries(read()[code]?.taken ?? {})));
    },
  };
}
