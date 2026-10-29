import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../maker/supabaseClient';
import type { HarbourHeard, HarbourWire } from './harbourLink';
import {
  HARBOUR_MOVE_EVENT,
  HARBOUR_NUDGE_EVENT,
  HARBOUR_SAY_EVENT,
  HARBOUR_TOPIC,
  HARBOUR_WAVE_EVENT,
  encodeHarbourMove,
  encodeHarbourNudge,
  encodeHarbourPresence,
  encodeHarbourSay,
  encodeHarbourWave,
  isPlayerId,
  readHarbourMove,
  readHarbourNudge,
  readHarbourPresence,
  readHarbourSay,
  readHarbourWave,
  type HarbourMove,
  type HarbourPlace,
} from './harbourProtocol';

/**
 * The two wires THE HARBOUR can run over (`harbourLink.ts`).
 *
 * The live one is the game's own Supabase project: one private Realtime channel
 * (`HARBOUR_TOPIC`) that anybody may listen on and only a player with a named
 * house may speak on - the database's policy decides, as the player joins
 * (`supabase/migrations/*_shared_harbour.sql`) - and the database's
 * `harbour_names` for the name over every figure.
 *
 * The local one is two tabs of one browser talking to each other over a
 * `BroadcastChannel`, for test mode only (`?testmode=1&harbour=local`), so a
 * playtest can put two players in one harbour without a single message
 * reaching the live project. Nothing in it is a check: it is a stand-in for
 * the network, and a browser can only ever reach itself with it.
 */

/** Which wire this page uses: the live project, two tabs of a test, or none. */
export type HarbourMode = 'live' | 'local' | 'off';

/**
 * The live project for anybody playing, and nothing at all for an automated
 * check unless it asks for the local stand-in by name - a test never talks to
 * the real harbour.
 */
export function harbourMode(testMode: 'off' | 'logic' | 'pixels', search: string): HarbourMode {
  if (testMode === 'off') {
    return 'live';
  }
  return new URLSearchParams(search).get('harbour') === 'local' ? 'local' : 'off';
}

/** Who is in the channel and where each says they are, read off Realtime's presence state. */
export function membersOf(state: Record<string, readonly unknown[]>): ReadonlyMap<string, HarbourPlace> {
  const members = new Map<string, HarbourPlace>();
  for (const [key, metas] of Object.entries(state)) {
    if (!isPlayerId(key)) {
      continue;
    }
    for (const meta of metas) {
      const place = readHarbourPresence(meta);
      if (place) {
        members.set(key, place);
        break;
      }
    }
  }
  return members;
}

/** The live wire: the game's Supabase project. */
export function liveHarbourWire(): HarbourWire {
  let channel: RealtimeChannel | null = null;
  return {
    async join(as, place, heard) {
      const db = await supabase();
      const joining = db.channel(HARBOUR_TOPIC, {
        config: {
          private: true,
          broadcast: { self: false },
          presence: { key: as ?? '', enabled: true },
        },
      });
      channel = joining;
      joining.on('broadcast', { event: HARBOUR_MOVE_EVENT }, ({ payload }) => {
        const move = readHarbourMove(payload);
        if (move) {
          heard.move(move);
        }
      });
      joining.on('broadcast', { event: HARBOUR_NUDGE_EVENT }, ({ payload }) => {
        const nudge = readHarbourNudge(payload);
        if (nudge) {
          heard.nudge(nudge);
        }
      });
      joining.on('broadcast', { event: HARBOUR_WAVE_EVENT }, ({ payload }) => {
        const wave = readHarbourWave(payload);
        if (wave) {
          heard.wave?.(wave);
        }
      });
      joining.on('broadcast', { event: HARBOUR_SAY_EVENT }, ({ payload }) => {
        const say = readHarbourSay(payload);
        if (say) {
          heard.say?.(say);
        }
      });
      joining.on('presence', { event: 'sync' }, () => {
        heard.present(membersOf(joining.presenceState()));
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
        await joining.track(encodeHarbourPresence(place));
      }
      return joined;
    },
    standIn(place) {
      if (!channel) {
        return;
      }
      void (place ? channel.track(encodeHarbourPresence(place)) : channel.untrack());
    },
    send(move) {
      void channel?.send({ type: 'broadcast', event: HARBOUR_MOVE_EVENT, payload: encodeHarbourMove(move) });
    },
    nudge(nudge) {
      void channel?.send({ type: 'broadcast', event: HARBOUR_NUDGE_EVENT, payload: encodeHarbourNudge(nudge) });
    },
    wave(wave) {
      void channel?.send({ type: 'broadcast', event: HARBOUR_WAVE_EVENT, payload: encodeHarbourWave(wave) });
    },
    say(say) {
      void channel?.send({ type: 'broadcast', event: HARBOUR_SAY_EVENT, payload: encodeHarbourSay(say) });
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

interface LocalHere {
  readonly kind: 'here';
  readonly id: string;
  readonly place: HarbourPlace | null;
  readonly name: string | null;
}

/**
 * The local stand-in: every tab of this browser in test mode is one player, by
 * an id kept for the tab's life and the name the test gives it
 * (`sessionStorage`, `LOCAL_NAME_KEY`) or this device's.
 */
export function localHarbourWire(nameOf: () => string | null): HarbourWire {
  const wire = new BroadcastChannel('eptw-harbour-local');
  const seen = new Map<string, { place: HarbourPlace | null; name: string | null; at: number }>();
  let me: string | null = null;
  let place: HarbourPlace | null = null;
  let heard: HarbourHeard | null = null;
  let beat: number | undefined;

  const present = (): void => {
    const now = Date.now();
    const members = new Map<string, HarbourPlace>();
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
    if (me) {
      wire.postMessage({ kind: 'here', id: me, place, name: nameOf() } satisfies LocalHere);
    }
    present();
  };
  wire.onmessage = (event: MessageEvent) => {
    const data = event.data as { kind?: string; payload?: unknown; id?: unknown; place?: HarbourPlace | null; name?: string | null };
    if (data.kind === 'move') {
      const move = readHarbourMove(data.payload);
      if (move) {
        heard?.move(move);
      }
    } else if (data.kind === 'nudge') {
      const nudge = readHarbourNudge(data.payload);
      if (nudge) {
        heard?.nudge(nudge);
      }
    } else if (data.kind === 'wave') {
      const wave = readHarbourWave(data.payload);
      if (wave) {
        heard?.wave?.(wave);
      }
    } else if (data.kind === 'say') {
      const say = readHarbourSay(data.payload);
      if (say) {
        heard?.say?.(say);
      }
    } else if (data.kind === 'here' && isPlayerId(data.id)) {
      const known = seen.has(data.id);
      seen.set(data.id, {
        place: readHarbourPresence({ p: data.place }),
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
    send(move: HarbourMove) {
      wire.postMessage({ kind: 'move', payload: encodeHarbourMove(move) });
    },
    nudge(nudge) {
      wire.postMessage({ kind: 'nudge', payload: encodeHarbourNudge(nudge) });
    },
    wave(wave) {
      wire.postMessage({ kind: 'wave', payload: encodeHarbourWave(wave) });
    },
    say(say) {
      wire.postMessage({ kind: 'say', payload: encodeHarbourSay(say) });
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
      return Promise.resolve();
    },
  };
}
