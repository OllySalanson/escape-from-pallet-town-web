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

/**
 * How a visit stands, asked by the visitor's browser while they are in the
 * house (`houseVisit.ts`): still in, seen out by the owner, or over for any
 * other reason (walked out of, run out because the visitor's browser went
 * quiet, or never let in).
 */
export type VisitState = 'in' | 'shown-out' | 'over';

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
  /** The visitor is still in this owner's house: how the visit stands, and (while it stands) held a while longer. */
  stillVisiting(owner: string): Promise<VisitState>;
  /** The visitor has walked out of this owner's house. */
  leaveHouse(owner: string): Promise<void>;
  /** The owner sees this visitor out of their house. Whether they were visiting. */
  showOut(visitor: string): Promise<boolean>;
}

const VISIT_STATES: readonly VisitState[] = ['in', 'shown-out', 'over'];
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
    async stillVisiting(owner) {
      const { data, error } = await (await db()).rpc('still_visiting', { owner });
      if (error) {
        throw new Error(error.message);
      }
      return VISIT_STATES.find((each) => each === data) ?? 'over';
    },
    async leaveHouse(owner) {
      const { error } = await (await db()).rpc('leave_house', { owner });
      if (error) {
        throw new Error(error.message);
      }
    },
    async showOut(visitor) {
      const { data, error } = await (await db()).rpc('show_out', { visitor });
      if (error) {
        throw new Error(error.message);
      }
      return data === 'shown-out';
    },
  };
}

/** How often a tab of the local stand-in says what its house is, and how long until it is forgotten. */
const LOCAL_HOUSE_EVERY_MS = 1_000;
const LOCAL_HOUSE_GONE_MS = 4_000;
/** A knock is good for a minute, as the database holds it. */
const KNOCK_GOOD_FOR_MS = 60_000;
/** A visit is held ninety seconds after the visitor last said they were in, as the database holds it. */
const LOCAL_VISIT_HELD_MS = 90_000;

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
  const mine = new Map<string, { to: string; state: KnockState | 'shown-out' | 'left'; at: number }>();
  /** Who is visiting this tab's house, and when they last said so. */
  const visitors = new Map<string, number>();
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
    } else if (data.kind === 'visiting' && data.to === id && isPlayerId(data.from)) {
      visitors.set(data.from, Date.now());
    } else if (data.kind === 'left' && data.to === id && isPlayerId(data.from)) {
      visitors.delete(data.from);
    } else if (data.kind === 'shown-out' && data.to === id && isPlayerId(data.from)) {
      for (const knock of mine.values()) {
        if (knock.to === data.from && knock.state === 'in') {
          knock.state = 'shown-out';
        }
      }
    }
  };
  /** This tab's latest yes from `owner`, as it stands. */
  const latestVisit = (owner: string): { state: KnockState | 'shown-out' | 'left' } | undefined =>
    [...mine.values()].filter((knock) => knock.to === owner && knock.state !== 'waiting' && knock.state !== 'not-now').at(-1);

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
        if (letIn) {
          visitors.set(knock.from, Date.now());
        }
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
      return Promise.resolve(knock.state === 'shown-out' || knock.state === 'left' ? ('gone' as const) : knock.state);
    },
    visit(owner) {
      const letIn = [...mine.values()].some((knock) => knock.to === owner && knock.state === 'in');
      const house = houses.get(owner);
      return Promise.resolve(letIn && house ? { name: house.name, snapshot: house.snapshot } : null);
    },
    stillVisiting(owner) {
      const visit = latestVisit(owner);
      if (visit?.state === 'shown-out') {
        return Promise.resolve('shown-out' as const);
      }
      if (visit?.state !== 'in') {
        return Promise.resolve('over' as const);
      }
      wire.postMessage({ kind: 'visiting', from: me(), to: owner });
      return Promise.resolve('in' as const);
    },
    leaveHouse(owner) {
      for (const knock of mine.values()) {
        if (knock.to === owner && knock.state === 'in') {
          knock.state = 'left';
        }
      }
      wire.postMessage({ kind: 'left', from: me(), to: owner });
      return Promise.resolve();
    },
    showOut(visitor) {
      const heard = visitors.get(visitor);
      visitors.delete(visitor);
      if (heard === undefined || !fresh(heard, LOCAL_VISIT_HELD_MS)) {
        return Promise.resolve(false);
      }
      wire.postMessage({ kind: 'shown-out', from: me(), to: visitor });
      return Promise.resolve(true);
    },
  };
}
