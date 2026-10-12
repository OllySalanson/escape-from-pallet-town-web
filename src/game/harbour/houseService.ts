import { supabase } from '../maker/supabaseClient';
import { isPlayerId } from './harbourProtocol';

/**
 * Knocking on doors in the shared harbour, as the database decides it
 * (`supabase/migrations/*_knocking.sql`): which houses there are and who is at
 * home, a knock, its answer, and the house a visitor who was let in may see.
 * Every one of these is the signed-in player asking for themselves; nothing
 * here believes anything another browser says.
 *
 * The local stand-in plays the same part between two tabs of a test, over a
 * `BroadcastChannel`, so the whole knock can be played end to end without one
 * row reaching the live project.
 */

/** A house in the harbour, as the knock list shows it. */
export interface HarbourHouse {
  readonly id: string;
  readonly name: string;
  readonly atHome: boolean;
}

export type KnockOutcome = 'knocking' | 'not-home' | 'busy';

/** How a knock stands, asked by whoever knocked. */
export type KnockState = 'waiting' | 'in' | 'not-now' | 'gone';

/** One knock waiting at the player's own door. */
export interface KnockAtTheDoor {
  readonly knockId: string;
  readonly knockerName: string;
}

export interface HouseService {
  /** The player is in their own house, or (false) has gone out; and what it looks like now. */
  atHome(home: boolean, snapshot: unknown): Promise<void>;
  houses(): Promise<readonly HarbourHouse[]>;
  knock(owner: string): Promise<{ readonly knockId: string | null; readonly outcome: KnockOutcome }>;
  knocksAtMyDoor(): Promise<readonly KnockAtTheDoor[]>;
  answer(knockId: string, letIn: boolean): Promise<void>;
  myKnock(knockId: string): Promise<KnockState>;
  /** The house to look round, once let in: its owner's name and what their browser saved. */
  visit(owner: string): Promise<{ readonly name: string; readonly snapshot: unknown } | null>;
}

const KNOCK_STATES: readonly KnockState[] = ['waiting', 'in', 'not-now', 'gone'];
const OUTCOMES: readonly KnockOutcome[] = ['knocking', 'not-home', 'busy'];

/** The live service: the game's Supabase project, as the signed-in player. */
export function liveHouseService(): HouseService {
  const db = () => supabase();
  return {
    async atHome(home, snapshot) {
      const { error } = await (await db()).rpc('at_my_house', { at_home: home, snapshot: snapshot ?? null });
      if (error) {
        throw new Error(error.message);
      }
    },
    async houses() {
      const { data, error } = await (await db()).rpc('harbour_houses');
      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []).map((row) => ({ id: row.player_uid, name: row.name, atHome: row.at_home === true }));
    },
    async knock(owner) {
      const { data, error } = await (await db()).rpc('knock_on', { owner });
      if (error) {
        throw new Error(error.message);
      }
      const [row] = data ?? [];
      const outcome = OUTCOMES.find((each) => each === row?.outcome) ?? 'not-home';
      return { knockId: row?.knock_id ?? null, outcome };
    },
    async knocksAtMyDoor() {
      const { data, error } = await (await db()).rpc('knocks_at_my_door');
      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []).map((row) => ({ knockId: row.knock_id, knockerName: row.knocker_name }));
    },
    async answer(knockId, letIn) {
      const { error } = await (await db()).rpc('answer_knock', { knock_id: knockId, let_in: letIn });
      if (error) {
        throw new Error(error.message);
      }
    },
    async myKnock(knockId) {
      const { data, error } = await (await db()).rpc('my_knock', { knock_id: knockId });
      if (error) {
        throw new Error(error.message);
      }
      return KNOCK_STATES.find((each) => each === data) ?? 'gone';
    },
    async visit(owner) {
      const { data, error } = await (await db()).rpc('visit_house', { owner });
      if (error) {
        throw new Error(error.message);
      }
      const [row] = data ?? [];
      return row ? { name: row.name, snapshot: row.snapshot } : null;
    },
  };
}

/** How often a tab of the local stand-in says what its house is, and how long until it is forgotten. */
const LOCAL_HOUSE_EVERY_MS = 1_000;
const LOCAL_HOUSE_GONE_MS = 4_000;
/** A knock is good for a minute, as the database holds it. */
const KNOCK_GOOD_FOR_MS = 60_000;

/**
 * The local stand-in for knocking: every tab of this browser in test mode is a
 * player with a house, and says what it is every second; knocks and answers go
 * from tab to tab. It decides nothing a player could not decide for themselves
 * in a test, and it never reaches the live project.
 */
export function localHouseService(me: () => string | null, myName: () => string | null): HouseService {
  const wire = new BroadcastChannel('eptw-houses-local');
  const houses = new Map<string, { name: string; home: boolean; snapshot: unknown; at: number }>();
  const atMyDoor = new Map<string, { from: string; name: string; at: number }>();
  const mine = new Map<string, { to: string; state: KnockState; at: number }>();
  let home = false;
  let snapshot: unknown = null;

  const sayHouse = (): void => {
    const id = me();
    const name = myName();
    if (id && name) {
      wire.postMessage({ kind: 'house', id, name, home, snapshot });
    }
  };
  window.setInterval(sayHouse, LOCAL_HOUSE_EVERY_MS);

  wire.onmessage = (event: MessageEvent) => {
    const data = event.data as Record<string, unknown>;
    const id = me();
    if (data.kind === 'house' && isPlayerId(data.id) && typeof data.name === 'string') {
      houses.set(data.id, { name: data.name, home: data.home === true, snapshot: data.snapshot, at: Date.now() });
    } else if (data.kind === 'knock' && data.to === id && typeof data.knockId === 'string' && isPlayerId(data.from)) {
      atMyDoor.set(data.knockId, { from: data.from, name: typeof data.name === 'string' ? data.name : '?', at: Date.now() });
    } else if (data.kind === 'answer' && data.to === id && typeof data.knockId === 'string') {
      const knock = mine.get(data.knockId);
      if (knock) {
        knock.state = data.letIn === true ? 'in' : 'not-now';
      }
    }
  };

  const fresh = (at: number, forMs: number): boolean => Date.now() - at < forMs;

  return {
    atHome(atHome, saved) {
      home = atHome;
      if (saved !== null && saved !== undefined) {
        snapshot = saved;
      }
      sayHouse();
      return Promise.resolve();
    },
    houses() {
      return Promise.resolve(
        [...houses]
          .filter(([id, house]) => id !== me() && fresh(house.at, LOCAL_HOUSE_GONE_MS))
          .map(([id, house]) => ({ id, name: house.name, atHome: house.home })),
      );
    },
    knock(owner) {
      const house = houses.get(owner);
      if (!house || !fresh(house.at, LOCAL_HOUSE_GONE_MS) || !house.home) {
        return Promise.resolve({ knockId: null, outcome: 'not-home' as const });
      }
      const knockId = crypto.randomUUID();
      mine.set(knockId, { to: owner, state: 'waiting', at: Date.now() });
      wire.postMessage({ kind: 'knock', knockId, from: me(), name: myName(), to: owner });
      return Promise.resolve({ knockId, outcome: 'knocking' as const });
    },
    knocksAtMyDoor() {
      return Promise.resolve(
        [...atMyDoor]
          .filter(([, knock]) => fresh(knock.at, KNOCK_GOOD_FOR_MS))
          .map(([knockId, knock]) => ({ knockId, knockerName: knock.name })),
      );
    },
    answer(knockId, letIn) {
      const knock = atMyDoor.get(knockId);
      atMyDoor.delete(knockId);
      if (knock) {
        wire.postMessage({ kind: 'answer', knockId, to: knock.from, letIn });
      }
      return Promise.resolve();
    },
    myKnock(knockId) {
      const knock = mine.get(knockId);
      if (!knock) {
        return Promise.resolve('gone' as const);
      }
      if (knock.state === 'waiting' && !fresh(knock.at, KNOCK_GOOD_FOR_MS)) {
        return Promise.resolve('gone' as const);
      }
      return Promise.resolve(knock.state);
    },
    visit(owner) {
      const letIn = [...mine.values()].some((knock) => knock.to === owner && knock.state === 'in');
      const house = houses.get(owner);
      return Promise.resolve(letIn && house ? { name: house.name, snapshot: house.snapshot } : null);
    },
  };
}
