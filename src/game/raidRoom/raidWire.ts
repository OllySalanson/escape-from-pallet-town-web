import type { RealtimeChannel } from '@supabase/supabase-js';
import type { HarbourHeard, HarbourWire } from '../harbour/harbourLink';
import { HARBOUR_MOVE_EVENT, isPlayerId } from '../harbour/harbourProtocol';
import { supabase } from '../maker/supabaseClient';
import { raidTopic } from './roomCode';
import {
  encodeRaidMove,
  encodeRaidPresence,
  raidMembersOf,
  readRaidMove,
  readRaidPresence,
  type RaidMove,
  type RaidPlace,
} from './raidProtocol';

/**
 * The two wires a raid room can run over, each the harbour's own shape
 * (`harbour/harbourLink.ts`), so the room's link is the harbour's link.
 *
 * The live one is one private Realtime channel per room (`raid:<code>`) on the
 * game's Supabase project, which only the two players in the room may listen
 * or speak on - the database's policy decides, as each joins
 * (`supabase/migrations/*_raid_rooms.sql`) - and the database's
 * `harbour_names` for the name over the other figure.
 *
 * The local one is two tabs of one browser talking over a `BroadcastChannel`,
 * for test mode only (`?testmode=1&harbour=local`), so a playtest can put two
 * players in one raid without a message reaching the live project.
 */

/** The live wire: the game's Supabase project. */
export function liveRaidWire(code: string): HarbourWire<RaidPlace> {
  let channel: RealtimeChannel | null = null;
  return {
    async join(as, place, heard) {
      const db = await supabase();
      const joining = db.channel(raidTopic(code), {
        config: {
          private: true,
          broadcast: { self: false },
          presence: { key: as ?? '', enabled: true },
        },
      });
      channel = joining;
      joining.on('broadcast', { event: HARBOUR_MOVE_EVENT }, ({ payload }) => {
        const move = readRaidMove(payload);
        if (move) {
          heard.move(move);
        }
      });
      joining.on('presence', { event: 'sync' }, () => {
        heard.present(raidMembersOf(joining.presenceState()));
      });
      const joined = await new Promise<boolean>((resolve) => {
        joining.subscribe((status) => {
          // Read as words: the enum lives in the client, which is loaded only on first use.
          const said: string = status;
          if (said === 'SUBSCRIBED') {
            resolve(true);
          } else if (said === 'CHANNEL_ERROR' || said === 'TIMED_OUT' || said === 'CLOSED') {
            resolve(false);
          }
        });
      });
      if (joined && as && place) {
        await joining.track(encodeRaidPresence(place));
      }
      return joined;
    },
    standIn(place) {
      if (!channel) {
        return;
      }
      void (place ? channel.track(encodeRaidPresence(place)) : channel.untrack());
    },
    send(move) {
      void channel?.send({ type: 'broadcast', event: HARBOUR_MOVE_EVENT, payload: encodeRaidMove(move) });
    },
    nudge() {
      // A room has nobody to knock for: the two players are on one channel already.
    },
    async names(ids) {
      const db = await supabase();
      const { data, error } = await db.rpc('harbour_names', { player_uids: [...ids].slice(0, 64) });
      if (error) {
        throw new Error(error.message);
      }
      return new Map((data ?? []).map((row) => [row.player_uid, row.name] as const));
    },
    async leave() {
      const leaving = channel;
      channel = null;
      if (leaving) {
        await (await supabase()).removeChannel(leaving);
      }
    },
  };
}

/** How often a tab of the local stand-in says it is still there, and how long until it is gone. */
const LOCAL_HEARTBEAT_MS = 1_000;
const LOCAL_GONE_AFTER_MS = 4_000;

/**
 * The local stand-in: every tab of this browser in test mode is one player, by
 * the id the harbour's stand-in gives the tab and the name the test gives it.
 */
export function localRaidWire(code: string, nameOf: () => string | null): HarbourWire<RaidPlace> {
  const wire = new BroadcastChannel(`eptw-raid-local-${code}`);
  const seen = new Map<string, { place: RaidPlace | null; name: string | null; at: number }>();
  let me: string | null = null;
  let place: RaidPlace | null = null;
  let heard: HarbourHeard<RaidPlace> | null = null;
  let beat: number | undefined;

  const present = (): void => {
    const now = Date.now();
    const members = new Map<string, RaidPlace>();
    for (const [id, entry] of seen) {
      if (now - entry.at > LOCAL_GONE_AFTER_MS) {
        seen.delete(id);
      } else if (entry.place) {
        members.set(id, entry.place);
      }
    }
    if (me && place) {
      members.set(me, place);
    }
    heard?.present(members);
  };
  const sayHere = (): void => {
    if (me && heard) {
      wire.postMessage({ kind: 'here', id: me, place, name: nameOf() });
    }
    present();
  };
  wire.onmessage = (event: MessageEvent) => {
    if (!heard) {
      return;
    }
    const data = event.data as { kind?: string; payload?: unknown; id?: unknown; place?: unknown; name?: unknown };
    if (data.kind === 'move') {
      const move = readRaidMove(data.payload);
      if (move) {
        heard.move(move);
      }
    } else if (data.kind === 'here' && isPlayerId(data.id)) {
      const known = seen.has(data.id);
      seen.set(data.id, {
        place: readRaidPresence({ p: data.place }),
        name: typeof data.name === 'string' ? data.name : null,
        at: Date.now(),
      });
      if (!known) {
        sayHere();
      } else {
        present();
      }
    } else if (data.kind === 'bye' && isPlayerId(data.id)) {
      seen.delete(data.id);
      present();
    }
  };
  return {
    join(as, at, hear) {
      me = as;
      place = at;
      heard = hear;
      window.clearInterval(beat);
      beat = window.setInterval(sayHere, LOCAL_HEARTBEAT_MS);
      sayHere();
      return Promise.resolve(true);
    },
    standIn(at) {
      place = at;
      sayHere();
    },
    send(move: RaidMove) {
      wire.postMessage({ kind: 'move', payload: encodeRaidMove(move) });
    },
    nudge() {
      // Nobody to knock for, as on the live wire.
    },
    names(ids) {
      return Promise.resolve(
        new Map(
          ids.flatMap((id) => {
            const name = seen.get(id)?.name;
            return name ? [[id, name] as const] : [];
          }),
        ),
      );
    },
    leave() {
      window.clearInterval(beat);
      beat = undefined;
      if (me) {
        wire.postMessage({ kind: 'bye', id: me });
      }
      heard = null;
      seen.clear();
      return Promise.resolve();
    },
  };
}
