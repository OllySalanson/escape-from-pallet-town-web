import type { Direction, GridPosition } from '../movement/gridMovement';
import type { PartnerSpeciesId } from '../base/partner';
import { AWAY_GRACE_MS, HarbourLink, LEAVE_AFTER_MS, type HarbourWire, type NamedFigure } from './harbourLink';
import { housePlace, type HarbourPlace, type SHARED_HARBOUR_ROOMS } from './harbourProtocol';
import { loadPlayerName } from '../console/playerName';
import { requestedTestMode } from '../dev/testMode';
import { HouseDoor } from './houseDoor';
import { liveHouseService, localHouseService, type HouseService } from './houseService';
import { harbourMode, liveHarbourWire, localHarbourWire, type HarbourMode } from './harbourWire';

/**
 * THE HARBOUR shared: the one object a scene asks about everybody else, kept
 * for the page's life because the base scene is started again for every door
 * walked through.
 *
 * Who this browser is seen as is decided here. A player is seen once they have
 * a named house - the name given at THE BOLTHOLE's door (`home/houseName.ts`),
 * written to the database by `name_my_house` as the signed-in player - and
 * until then only watches. The name is written once per name and per player,
 * and remembered on the device, so walking about never costs a call; a name
 * changed at the console is written the next time the harbour is walked into.
 */

/**
 * Where in the harbour a scene has the player: the yard, a keeper's room, their
 * own house, or somebody else's house they were let into (`home/knocking.ts`).
 */
export type HarbourWhere =
  | 'yard'
  | (typeof SHARED_HARBOUR_ROOMS)[number]
  | 'home'
  | 'home-upstairs'
  | { readonly visiting: string; readonly upstairs: boolean };

/** The place a scene's room is, for this player. */
export function placeFor(where: HarbourWhere, me: string | null): HarbourPlace | null {
  if (typeof where === 'object') {
    return housePlace(where.visiting, where.upstairs);
  }
  if (where === 'home' || where === 'home-upstairs') {
    return me ? housePlace(me, where === 'home-upstairs') : null;
  }
  return where;
}

/** What the session needs to know who this browser is, so it is tested without a network. */
export interface HarbourIdentity {
  /**
   * Makes sure this browser has a house under `name` and says who it is seen
   * as: a player id, or null to only watch (not signed in, or the database
   * would not take the name).
   */
  seenAs(name: string): Promise<string | null>;
}

/** How often the link is ticked while no scene ticks it (`HarbourSession.away`). */
export const AWAY_TICK_MS = 500;

export class HarbourSession {
  public readonly link: HarbourLink;
  private readonly identity: HarbourIdentity;
  private me: string | null = null;
  private named: string | null = null;
  /** The link's clock at the last frame a scene gave it, and the wall clock then. */
  private clock = { link: 0, wall: 0 };
  /** Keeps the link's clock going while no scene is (`away`). */
  private awayTimer: ReturnType<typeof setInterval> | null = null;
  private where: HarbourWhere = 'yard';
  private tile: GridPosition = { x: 0, y: 0 };
  private facing: Direction = 'down';

  public constructor(wire: HarbourWire, identity: HarbourIdentity) {
    this.link = new HarbourLink(wire);
    this.identity = identity;
  }

  /**
   * The player is standing here, under this name (or none yet), with this
   * kind of Pokemon at their heel (or none) for everybody else to see.
   */
  public stand(
    where: HarbourWhere,
    tile: GridPosition,
    facing: Direction,
    name: string | null,
    partner: PartnerSpeciesId | null = null,
  ): void {
    this.stopAwayClock();
    this.where = where;
    this.tile = { ...tile };
    this.facing = facing;
    this.link.enter(this.me, placeFor(where, this.me), tile, facing);
    this.link.carry(partner);
    if (name && name !== this.named) {
      this.named = name;
      void this.identity.seenAs(name).then((me) => {
        if (me !== this.me && this.named === name) {
          this.me = me;
          this.link.enter(me, placeFor(this.where, me), this.tile, this.facing);
        }
      });
    }
  }

  public stepped(tile: GridPosition, facing: Direction): void {
    this.tile = { ...tile };
    this.facing = facing;
    this.link.stepped(tile, facing);
  }

  /**
   * The player's scene has gone: a menu, a raid. The link takes them off
   * everybody else's screens after a grace, and leaves the channel a minute
   * after that - but only on a tick, and the scene that ticked it is the one
   * that has gone. So the session keeps the link's clock going itself until a
   * scene stands the player somewhere again: without it a player choosing a
   * loadout, or out on a raid, stood on the Raid Arena's doorstep for
   * everybody else until they came back (playtest 49).
   */
  public away(): void {
    this.link.away();
    this.stopAwayClock();
    const from = this.clock;
    const until = from.link + AWAY_GRACE_MS + LEAVE_AFTER_MS;
    this.awayTimer = setInterval(() => {
      const now = from.link + (Date.now() - from.wall);
      this.link.tick(now, AWAY_TICK_MS);
      if (now >= until) {
        this.stopAwayClock();
      }
    }, AWAY_TICK_MS);
  }

  public tick(nowMs: number, deltaMs: number): void {
    this.clock = { link: nowMs, wall: Date.now() };
    this.link.tick(nowMs, deltaMs);
  }

  private stopAwayClock(): void {
    if (this.awayTimer !== null) {
      clearInterval(this.awayTimer);
      this.awayTimer = null;
    }
  }

  /** Puts the player's hand up, at the player they are facing if any; whether it went. */
  public wave(to?: string): boolean {
    return this.link.wave(to);
  }

  /** Everybody else where the player is standing. */
  public figuresHere(): readonly NamedFigure[] {
    return this.link.figuresIn(placeFor(this.where, this.me));
  }

  /** Who this browser is seen as, once it is. */
  public get seenAs(): string | null {
    return this.me;
  }
}

/**
 * Where the device remembers which name it last wrote, for which player. Its
 * own key since names started again (`names/`), so nothing written before is
 * believed.
 */
export const HOUSE_WRITTEN_KEY = 'escape-from-pallet-town.harbour.house.v2';

/** Remembers that this player's house is written under this name, so walking about never writes it again. */
export function rememberHouseWritten(playerId: string, name: string): void {
  keepWritten(`${playerId}:${name}`);
}

/**
 * The live identity: the game's one anonymous sign-in (`maker/playerSignIn.ts`,
 * which draws the bot check if the project asks for one), and `name_my_house`
 * written only when the name or the player is new to this device. Only a
 * player with a name is ever signed in here: watching the harbour signs nobody
 * up.
 */
export function liveIdentity(): HarbourIdentity {
  return {
    async seenAs(name) {
      const [{ signInAsPlayer }, { supabase }] = await Promise.all([
        import('../maker/playerSignIn'),
        import('../maker/supabaseClient'),
      ]);
      // The game's one sign-in, bot check and all: a browser is one player for
      // the boards, the map maker, the FEEDBACK tab and the harbour alike.
      const signedIn = await signInAsPlayer();
      if (!signedIn.ok) {
        return null;
      }
      const me = signedIn.uid;
      const written = `${me}:${name}`;
      if (readWritten() === written) {
        return me;
      }
      const { error } = await (await supabase()).rpc('name_my_house', { player_name: name });
      if (error) {
        return null;
      }
      keepWritten(written);
      return me;
    },
  };
}

function readWritten(): string | null {
  try {
    return window.localStorage.getItem(HOUSE_WRITTEN_KEY);
  } catch {
    return null;
  }
}

function keepWritten(value: string): void {
  try {
    window.localStorage.setItem(HOUSE_WRITTEN_KEY, value);
  } catch {
    // Written again next time: the database answers 'unchanged'.
  }
}

/** The name a tab of the local stand-in plays under: the test's, else this device's. */
export const LOCAL_NAME_KEY = 'eptw-harbour-local-name';

/** The local stand-in's identity: one id per tab, never a sign-in. */
export function localIdentity(): HarbourIdentity {
  return {
    seenAs() {
      const key = 'eptw-harbour-local-id';
      let id = window.sessionStorage.getItem(key);
      if (!id) {
        id = crypto.randomUUID();
        window.sessionStorage.setItem(key, id);
      }
      return Promise.resolve(id);
    },
  };
}

let session: HarbourSession | null | undefined;

/**
 * This page's harbour, or null when there is none to join: an automated check
 * that did not ask for the local stand-in, or a page with no window.
 */
export function harbour(): HarbourSession | null {
  if (session !== undefined) {
    return session;
  }
  const mode = pageHarbourMode();
  session =
    mode === 'live'
      ? new HarbourSession(liveHarbourWire(), liveIdentity())
      : mode === 'local'
        ? new HarbourSession(localHarbourWire(localName), localIdentity())
        : null;
  return session;
}

/** Which service this page talks to: the live project, the tab-to-tab stand-in of a test, or none. */
export function pageHarbourMode(): HarbourMode {
  // A page with no address - a scene test's stand-in window - has no harbour either.
  return typeof window === 'undefined' || !window.location
    ? 'off'
    : harbourMode(requestedTestMode(), window.location.search);
}

/** Knocking: the service that asks the database, and the player's own front door. */
export interface HarbourHouses {
  readonly service: HouseService;
  readonly door: HouseDoor;
}

let houses: HarbourHouses | null | undefined;

/**
 * This page's knocking (`harbour/houseService.ts`, `harbour/houseDoor.ts`), or
 * null wherever there is no harbour to knock in. The local stand-in knows who
 * this tab is from the harbour's own session.
 */
export function harbourHouses(): HarbourHouses | null {
  if (houses !== undefined) {
    return houses;
  }
  const mode = pageHarbourMode();
  const service =
    mode === 'live'
      ? liveHouseService()
      : mode === 'local'
        ? localHouseService(() => harbour()?.seenAs ?? null, localName)
        : null;
  houses = service ? { service, door: new HouseDoor(service) } : null;
  return houses;
}

function localName(): string | null {
  try {
    return window.sessionStorage.getItem(LOCAL_NAME_KEY) ?? loadPlayerName();
  } catch {
    return loadPlayerName();
  }
}
