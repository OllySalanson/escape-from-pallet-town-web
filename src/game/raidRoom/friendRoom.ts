import type { Direction, GridPosition } from '../movement/gridMovement';
import { HarbourLink, type HarbourWire, type NamedFigure } from '../harbour/harbourLink';
import { LOCAL_NAME_KEY, localIdentity, pageHarbourMode } from '../harbour/harbour';
import { loadPlayerName } from '../console/playerName';
import { HunterBoard, encodeHunterSignal, readHunterSignal, type HunterSignal } from './groupHunter';
import { mapPlace, type RaidPlace } from './raidProtocol';
import { LootLedger, encodeTook, readTook } from './roomLoot';
import { ROOM_PHRASES, TalkBoard, encodeTalk, readTalk } from './roomTalk';
import { encodeWon, readWon } from './roomBosses';
import { liveRaidWire, localRaidWire } from './raidWire';
import { liveRoomService, localRoomService, type HeldRoom, type RaidRoomService, type RoomAnswer } from './roomService';

/**
 * Raiding with a friend: the one object the game asks about the room this
 * browser is in, kept for the page's life because every scene a raid passes
 * through - the lab, the world, every fight, the result - is started afresh.
 *
 * A room holds up to four players (`ROOM_SIZE`). It is held from the moment it is made or joined until the raid it was
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
  /** Said instead of came-or-went: news about something the friend did (`GOT THERE FIRST`). */
  readonly line?: string;
  /** The page time it happened at. */
  readonly at: number;
}

/** Another player in the room as the raid sees them: their name and where they are. */
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
  /** What this browser has heard of the room's one hunter (`groupHunter.ts`). */
  public readonly hunters = new HunterBoard();
  /**
   * The fight this player is in, said to the room when it began, so the world
   * rebuilt after it knows to say it is over - and, after the hunter's own
   * fight, what it left of the hunter. Kept here because the world is not.
   */
  public fighting: 'wild' | 'hunter' | null = null;
  /** Who holds which piece of the room's loot (`roomLoot.ts`). */
  public readonly loot = new LootLedger();
  /** Whether this raid has asked the database what was taken before it dropped in. */
  private askedTaken = false;
  /** What everybody in the room has said and pinged, this player included (`roomTalk.ts`). */
  public readonly talk = new TalkBoard();
  /** The bosses beaten in this room's raid, by whoever beat them (`roomBosses.ts`). */
  private readonly wins = new Map<string, string>();
  /** The bosses this player beat in this room's raid, said to everybody who arrives. */
  private readonly myWins = new Set<string>();

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
    this.hunters.clear();
    this.fighting = null;
    this.loot.clear();
    this.askedTaken = false;
    this.talk.clear();
    this.wins.clear();
    this.myWins.clear();
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

  /** Everybody else on the room's channel, by name. */
  public friends(): readonly FriendHere[] {
    return [...(this.link?.othersPresent() ?? [])]
      .map(([id, { name, place }]) => ({ id, name, place }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Everybody else as drawn on this map: where each walks, under their name. */
  public figuresOn(mapId: string): readonly NamedFigure<RaidPlace>[] {
    return this.held?.mapId === mapId ? (this.link?.figuresIn(mapPlace(mapId)) ?? []) : [];
  }

  /** Everybody else on the room's map right now, by id. */
  public othersOn(mapId: string): readonly FriendHere[] {
    return this.friends().filter((friend) => friend.place === mapPlace(mapId));
  }

  /** Tells everybody else about the hunter. Returns whether anybody was there to tell. */
  public sayHunter(signal: HunterSignal): boolean {
    if (signal.kind !== 'busy') {
      this.hunters.said(signal.hunter, signal.from);
    }
    return this.link?.signal(encodeHunterSignal(signal)) ?? false;
  }

  /**
   * Claims a piece of the room's loot for this player. The answer lands in the
   * ledger; a win is said to everybody else, so they see it go at once.
   */
  public claimLoot(lootId: string): void {
    const held = this.held;
    if (!held || !this.loot.claim(lootId)) {
      return;
    }
    void this.service.takeLoot(held.code, lootId).then((claim) => {
      if (this.held?.code !== held.code) {
        return;
      }
      if (claim.outcome === 'yours') {
        this.loot.answered(lootId, held.me, held.me);
        this.link?.signal(encodeTook({ from: held.me, lootId }));
      } else if (claim.outcome === 'taken') {
        this.loot.answered(lootId, claim.by ?? 'somebody', held.me);
      } else {
        this.loot.answered(lootId, null, held.me);
      }
    });
  }

  /** Once a raid: what was taken before this player dropped in. */
  public askWhatWasTaken(): void {
    const held = this.held;
    if (!held || this.askedTaken) {
      return;
    }
    this.askedTaken = true;
    void this.service.lootTaken(held.code).then((taken) => {
      if (this.held?.code === held.code) {
        for (const [lootId, holder] of taken) {
          this.loot.heard(lootId, holder);
        }
      }
    });
  }

  /**
   * Says one of the room's phrases. Paced as everybody else is heard: a phrase
   * said too soon after the last is not said. Returns whether it was.
   */
  public say(phrase: number): boolean {
    const held = this.held;
    if (!held || !ROOM_PHRASES[phrase] || !this.talk.hear({ kind: 'say', from: held.me, phrase }, this.now)) {
      return false;
    }
    this.link?.signal(encodeTalk({ kind: 'say', from: held.me, phrase }));
    this.tell(`YOU: ${ROOM_PHRASES[phrase]}`);
    return true;
  }

  /** Marks this tile for everybody in the room, at the room's pace. Returns whether it was marked. */
  public ping(tile: GridPosition): boolean {
    const held = this.held;
    if (!held || !this.talk.hear({ kind: 'ping', from: held.me, tile }, this.now)) {
      return false;
    }
    this.link?.signal(encodeTalk({ kind: 'ping', from: held.me, tile }));
    this.tell('YOU PINGED HERE');
    return true;
  }

  /**
   * This player beat these bosses in this raid: said to the room, so their
   * doors open for everybody (`roomBosses.ts`). Saying one twice is harmless.
   */
  public won(bossIds: readonly string[]): void {
    const held = this.held;
    if (!held) {
      return;
    }
    for (const bossId of bossIds) {
      if (!this.myWins.has(bossId)) {
        this.myWins.add(bossId);
        this.wins.set(bossId, held.me);
        this.link?.signal(encodeWon({ from: held.me, bossId }));
      }
    }
  }

  /** Every boss beaten in this room's raid, and by whom - this player included. */
  public get bossesWon(): ReadonlyMap<string, string> {
    return this.wins;
  }

  /** This player's id in the room, if one is held. */
  public get me(): string | null {
    return this.held?.me ?? null;
  }

  /** The name a player in the room goes by, if this browser knows it. */
  public nameOf(id: string): string | null {
    return this.friends().find((friend) => friend.id === id)?.name ?? this.known.get(id) ?? null;
  }

  /** Puts a line of news up where came-and-went is said. */
  public tell(line: string): void {
    this.lastNews = { name: '', came: true, line, at: this.now };
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
    if (!this.link) {
      this.link = new HarbourLink<RaidPlace>(this.wireFor(held.code));
      this.link.whenSignalled((payload) => {
        const signal = readHunterSignal(payload);
        if (signal && signal.from !== this.held?.me) {
          this.hunters.hear(signal);
        }
        const took = readTook(payload);
        if (took && took.from !== this.held?.me) {
          this.loot.heard(took.lootId, took.from);
        }
        const won = readWon(payload);
        if (won && won.from !== this.held?.me && !this.wins.has(won.bossId)) {
          this.wins.set(won.bossId, won.from);
        }
        const talk = readTalk(payload);
        if (talk && talk.from !== this.held?.me && this.talk.hear(talk, this.now)) {
          const name = this.nameOf(talk.from) ?? 'A FRIEND';
          // A ping says itself on the friend's own chip line (`PING NE 12`), for as long as it shows.
          if (talk.kind === 'say') {
            this.tell(`${name}: ${ROOM_PHRASES[talk.phrase]}`);
          }
        }
      });
    }
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
        // Somebody new: they are told every boss this player beat this raid.
        for (const bossId of this.myWins) {
          this.link?.signal(encodeWon({ from: this.held!.me, bossId }));
        }
      }
    }
    for (const [id, name] of this.known) {
      if (!present.has(id)) {
        this.known.delete(id);
        this.hunters.forget(id);
        this.talk.forget(id);
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
