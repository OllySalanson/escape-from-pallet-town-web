import type { Direction, GridPosition } from '../movement/gridMovement';
import { HarbourLink, type HarbourWire, type NamedFigure } from '../harbour/harbourLink';
import { LOCAL_NAME_KEY, localIdentity, pageHarbourMode } from '../harbour/harbour';
import { loadPlayerName } from '../console/playerName';
import { mapPlace, type RaidPlace } from './raidProtocol';
import { liveRaidWire, localRaidWire } from './raidWire';
import { liveRoomService, localRoomService, type HeldRoom, type RaidRoomService, type RoomAnswer } from './roomService';

/**
 * Raiding with a friend: the one object the game asks about the room this
 * browser is in, kept for the page's life because every scene a raid passes
 * through - the lab, the world, every fight, the result - is started afresh.
 *
 * A room is held from the moment it is made or joined until the raid it was
 * for ends (the result screen leaves it, `ExtractionScene`) or the player leaves it at the lab. While it is
 * held the browser is on the room's channel - the harbour's own link over the
 * room's own wire (`raidWire.ts`) - saying where it is: `lab` while getting
 * ready, the map while raiding it. That is all that is shared. Each player
 * keeps their own team, fights, clock and loot, exactly as a raid alone does,
 * and the other player is only ever drawn.
 *
 * Who came and went is noticed here too (`news`), so the raid can say "ASH
 * LEFT THE RAID" the moment the other browser goes quiet - leaving by an exit,
 * losing, or closing the tab all look the same from here, and all end the
 * same way: the friend's figure is gone and the raid carries on.
 */

/** How long a "came" or "went" line is news. */
export const FRIEND_NEWS_MS = 4_000;

export interface FriendNews {
  readonly name: string;
  readonly came: boolean;
  /** The page time it happened at. */
  readonly at: number;
}

/** The other player as the raid sees them: their name and where they are. */
export interface FriendHere {
  readonly id: string;
  readonly name: string;
  readonly place: RaidPlace;
}

export class FriendRoom {
  private held: HeldRoom | null = null;
  private link: HarbourLink<RaidPlace> | null = null;
  private tile: GridPosition = { x: 0, y: 0 };
  private known = new Map<string, string>();
  private lastNews: FriendNews | null = null;
  private now = 0;

  private readonly service: RaidRoomService;
  private readonly wireFor: (code: string) => HarbourWire<RaidPlace>;

  public constructor(service: RaidRoomService, wireFor: (code: string) => HarbourWire<RaidPlace>) {
    this.service = service;
    this.wireFor = wireFor;
  }

  /** The room held, if any. */
  public get room(): HeldRoom | null {
    return this.held;
  }

  /** Makes a room on this map, leaving any room held. */
  public async open(mapId: string, name: string): Promise<RoomAnswer> {
    const answer = await this.service.open(mapId, name);
    if (answer.ok) {
      this.hold(answer.room);
    }
    return answer;
  }

  /** Joins the room with this code, leaving any other room held. */
  public async join(code: string, name: string): Promise<RoomAnswer> {
    const answer = await this.service.join(code, name);
    if (answer.ok) {
      this.hold(answer.room);
    }
    return answer;
  }

  /** Out of the room, at the lab: the friend sees this player go. */
  public leave(): void {
    const held = this.held;
    if (!held) {
      return;
    }
    this.held = null;
    this.link?.leave();
    this.link = null;
    this.known.clear();
    this.lastNews = null;
    void this.service.leave(held.code);
  }

  /** The player is getting ready at base. */
  public atLab(): void {
    this.stand('lab', { x: 0, y: 0 }, 'down');
  }

  /** The player is standing on this tile of the room's map, in a raid. */
  public inRaid(mapId: string, tile: GridPosition, facing: Direction): void {
    if (this.held?.mapId === mapId) {
      this.stand(mapPlace(mapId), tile, facing);
    }
  }

  /** The player is on a new tile: a step, a door, a warp. */
  public moved(tile: GridPosition, facing: Direction): void {
    if (this.tile.x === tile.x && this.tile.y === tile.y) {
      return;
    }
    this.tile = { ...tile };
    this.link?.stepped(tile, facing);
  }

  /** One frame: the friend walked on, anything owed sent, and who came or went noticed. */
  public tick(nowMs: number, deltaMs: number): void {
    this.now = nowMs;
    this.link?.tick(nowMs, deltaMs);
    this.notice(nowMs);
  }

  /** The other player, while they are on the room's channel. */
  public friend(): FriendHere | null {
    for (const [id, { name, place }] of this.link?.othersPresent() ?? []) {
      return { id, name, place };
    }
    return null;
  }

  /** The other player as drawn on this map: where they walk, under their name. */
  public figuresOn(mapId: string): readonly NamedFigure<RaidPlace>[] {
    return this.held?.mapId === mapId ? (this.link?.figuresIn(mapPlace(mapId)) ?? []) : [];
  }

  /** Who came or went in the last `FRIEND_NEWS_MS`, if anybody. */
  public news(): FriendNews | null {
    return this.lastNews && this.now - this.lastNews.at < FRIEND_NEWS_MS ? this.lastNews : null;
  }

  private stand(place: RaidPlace, tile: GridPosition, facing: Direction): void {
    const held = this.held;
    if (!held) {
      return;
    }
    this.tile = { ...tile };
    this.link ??= new HarbourLink<RaidPlace>(this.wireFor(held.code));
    this.link.enter(held.me, place, tile, facing);
  }

  private hold(room: HeldRoom): void {
    if (this.held && this.held.code !== room.code) {
      this.leave();
    }
    this.held = room;
    // A room is made or joined at the lab, so that is where the player is.
    this.stand('lab', { x: 0, y: 0 }, 'down');
  }

  private notice(nowMs: number): void {
    const present = this.link?.othersPresent() ?? new Map<string, { readonly name: string }>();
    for (const [id, { name }] of present) {
      if (!this.known.has(id)) {
        this.known.set(id, name);
        this.lastNews = { name, came: true, at: nowMs };
      }
    }
    for (const [id, name] of this.known) {
      if (!present.has(id)) {
        this.known.delete(id);
        this.lastNews = { name, came: false, at: nowMs };
      }
    }
  }
}

let session: FriendRoom | null | undefined;

/**
 * This page's raid room, or null where there is none to be had: an automated
 * check that did not ask for the local stand-in, or a page with no window. It
 * follows the harbour's own switch (`harbour/harbourWire.ts`), so a test never
 * reaches the live project.
 */
export function friendRoom(): FriendRoom | null {
  if (session !== undefined) {
    return session;
  }
  const mode = pageHarbourMode();
  if (mode === 'live') {
    session = new FriendRoom(liveRoomService(), (code) => liveRaidWire(code));
  } else if (mode === 'local') {
    const identity = localIdentity();
    session = new FriendRoom(
      localRoomService(async () => (await identity.seenAs('')) ?? ''),
      (code) => localRaidWire(code, localName),
    );
  } else {
    session = null;
  }
  return session;
}

/** The name a player raids under: the device's, or a test tab's own. */
export function raidName(): string | null {
  if (pageHarbourMode() === 'local') {
    return localName();
  }
  return loadPlayerName();
}

function localName(): string | null {
  try {
    return window.sessionStorage.getItem(LOCAL_NAME_KEY) ?? loadPlayerName();
  } catch {
    return loadPlayerName();
  }
}
