import { PHRASE_SHOWN_MS, type HarbourPhraseId } from '../harbour/harbourPhrases';
import { WAVE_SHOWN_MS } from '../harbour/harbourLink';
import type { Direction, GridPosition } from '../movement/gridMovement';
import { STEP_DURATION_MS } from '../movement/stepClock';
import type { SeededRng } from '../run/rng';
import { getBaseMap } from './baseMap';
import { doorNamed } from './doors';
import {
  BOT_GATES,
  BOT_SLOT_MS,
  CALL_MS,
  CALL_WHILE_AT_LEAST,
  ROOM_CALLS,
  ROOM_WINDOW_MS,
  botGround,
  botPath,
  fewestPresent,
  rngFor,
  roomCaller,
  tileIndex,
  visitBot,
  visitSpan,
  type BotGate,
  type HarbourBot,
  type RoomSpot,
  type SharedRoomId,
} from './harbourBots';

/**
 * What the harbour's regulars (`harbourBots.ts`) do while they are in: the
 * captain, 30 Oct - "some people can [walk about], and some people should be
 * doing things... when a new fake human is spawned it could pick one of those
 * activities to do".
 *
 * **Everything is still a pure function of the clock.** A visit's plan comes
 * from its number alone, so every browser sees the same regulars doing the same
 * things in the same places, a test gets the same harbour every time, and what
 * somebody is doing cannot depend on who happens to be watching.
 *
 * **The list.** `stroll` is a walk from one place to another with somewhere to
 * be; `wander` is the old pottering, kept for the people who do just that;
 * `hang-out` stands about facing a fountain, a bench, a statue or the Pokémon in
 * the pen; `watch-sea` stands at the water's edge looking at it; `window-shop`
 * stands at THE HARBOUR BOUTIQUE's windows; `read-board` reads a sign;
 * `knock` raises a hand at a keeper's door and waits, and sometimes goes in;
 * `call-in` goes through a door and stands in the room (`ROOM_CALLS`), which the
 * player sees if they are in there too; and `chat` meets two or three others at
 * an appointment no one of them made (`chatInWindow`). A visit picks one, does
 * it, and picks again until it is time to go, by a door or over the side of a
 * boat (`BOT_GATES`).
 *
 * **Nobody walks through anybody.** Plans are made in visit order against a
 * book of who is on which tile when (`Bookings`): a walk goes round anybody
 * standing about, and gives way, on the spot, to anybody passing. A plan that
 * read the plan before it, which read the plan before that, would have to be
 * worked out from the start of time, so the chain is cut into blocks of
 * `PLAN_BLOCK_VISITS`: an odd block is planned on its own, and an even block
 * against the odd block on each side of it, which is what lets any plan be
 * worked out from at most three blocks, and every pair of visits still be held
 * apart. A plan costs under a millisecond, so a block is no stutter.
 *
 * **What it may not do.** A knock here is a hand raised at a door and nothing
 * else: it is not `home/knocking.ts`, reaches nobody, and nothing here can
 * name a player's house - THE BOLTHOLE's door is in none of these lists.
 */

export type BotActivity =
  | 'stroll'
  | 'wander'
  | 'hang-out'
  | 'watch-sea'
  | 'window-shop'
  | 'read-board'
  | 'knock'
  | 'call-in'
  | 'chat'
  | 'leave';

/** A place to stand and which way to look. */
const stand = (x: number, y: number, facing: Direction): RoomSpot => ({ tile: { x, y }, facing });

/** The water's edge, each facing the water. */
export const SEA_VIEWS: readonly RoomSpot[] = [
  stand(4, 19, 'down'),
  stand(14, 21, 'right'),
  stand(11, 20, 'left'),
  stand(25, 22, 'down'),
  stand(34, 22, 'down'),
  stand(45, 22, 'down'),
  stand(29, 27, 'down'),
  stand(28, 27, 'left'),
  stand(49, 20, 'down'),
  stand(51, 20, 'down'),
  stand(53, 20, 'down'),
  stand(54, 22, 'left'),
  stand(59, 24, 'left'),
  stand(60, 27, 'right'),
  stand(59, 28, 'left'),
  stand(45, 31, 'down'),
  stand(50, 31, 'down'),
  stand(55, 31, 'down'),
];

/** Something to look at for a while: a fountain, the bench, the arena's statues, the pen, the S.S. Anne. */
export const HANG_OUTS: readonly RoomSpot[] = [
  stand(26, 15, 'right'),
  stand(26, 14, 'right'),
  stand(30, 15, 'left'),
  stand(30, 16, 'left'),
  stand(55, 11, 'right'),
  stand(59, 11, 'left'),
  stand(55, 14, 'right'),
  stand(59, 14, 'left'),
  stand(53, 10, 'left'),
  stand(53, 11, 'left'),
  stand(49, 14, 'up'),
  stand(51, 14, 'up'),
  stand(6, 17, 'up'),
  stand(10, 17, 'up'),
  stand(30, 24, 'right'),
];

/** THE HARBOUR BOUTIQUE's front, either side of its step. */
export const SHOP_WINDOWS: readonly RoomSpot[] = [stand(54, 8, 'up'), stand(56, 8, 'up'), stand(57, 8, 'up')];

/** In front of a sign. Never THE BOLTHOLE's, which is somebody's front garden. */
export const NOTICE_BOARDS: readonly RoomSpot[] = [
  stand(18, 18, 'up'),
  stand(25, 21, 'up'),
  stand(54, 13, 'up'),
  stand(12, 15, 'up'),
  stand(49, 18, 'up'),
];

/** The doors a regular may knock at: the keepers' and the boutique's. A keeper's door is a shop's. */
export const KNOCKED_DOORS: readonly SharedRoomId[] = ['pokemon-centre', 'oaks-lab', 'brocks-workshop', 'bills-cottage', 'boutique'];

/**
 * Where a few people stand and talk: the first two face each other across a
 * gap, and a third, if there is one, stands two rows off, because a name is drawn
 * beneath the figures and one row off their name is behind their friends' heads.
 */
export const CHAT_CIRCLES: readonly (readonly RoomSpot[])[] = [
  [stand(23, 16, 'right'), stand(25, 16, 'left'), stand(24, 14, 'down')],
  [stand(13, 8, 'right'), stand(15, 8, 'left'), stand(14, 10, 'up')],
  [stand(44, 15, 'right'), stand(46, 15, 'left'), stand(45, 13, 'down')],
  [stand(47, 19, 'right'), stand(49, 19, 'left'), stand(48, 17, 'down')],
  [stand(6, 18, 'right'), stand(8, 18, 'left'), stand(7, 16, 'down')],
  [stand(30, 7, 'right'), stand(32, 7, 'left')],
];

/** One part of a visit: a walk along tiles a step every `STEP_DURATION_MS`, or standing somewhere. */
export type VisitLeg =
  | { readonly kind: 'walk'; readonly from: number; readonly path: readonly GridPosition[]; readonly activity: BotActivity }
  | {
      readonly kind: 'pause';
      readonly from: number;
      readonly to: number;
      readonly tile: GridPosition;
      /** Which way they look, and from when. */
      readonly looks: readonly { readonly at: number; readonly facing: Direction }[];
      readonly activity: BotActivity;
      /** Stopped mid-walk to let somebody by, rather than here for its own sake. */
      readonly givingWay?: true;
    }
  | {
      /** Through a keeper's door, and in their room until `to` (`ROOM_CALLS`). */
      readonly kind: 'inside';
      readonly from: number;
      readonly to: number;
      readonly room: SharedRoomId;
      /** The doorway they went in by and come out of. */
      readonly door: GridPosition;
      readonly spot: RoomSpot;
      readonly activity: 'call-in';
    };

export interface VisitPlan {
  readonly visit: number;
  readonly bot: HarbourBot;
  readonly from: number;
  readonly to: number;
  readonly enter: BotGate;
  readonly leave: BotGate;
  readonly legs: readonly VisitLeg[];
  /** The phrases they say, and when (`harbour/harbourPhrases.ts`). Rare, and in keeping with what they are doing. */
  readonly says: readonly { readonly at: number; readonly phrase: HarbourPhraseId }[];
  /** When their hand goes up: meeting somebody, or knocking. */
  readonly waves: readonly number[];
}

// -- a chat: an appointment nobody made ----------------------------------------

/** How long a window of the chat schedule is: at most one chat in each. */
export const CHAT_WINDOW_MS = 120_000;

/** How far inside a visit a chat has to fall: the longest walk across the harbour, and some. */
const CHAT_MARGIN_MS = 22_000;

/** What two people say to each other, the first line and its answer. */
const CHAT_EXCHANGES: readonly (readonly [HarbourPhraseId, HarbourPhraseId])[] = [
  ['hello', 'hello'],
  ['raid', 'lets-go'],
  ['raid', 'later'],
  ['outfit', 'thanks'],
  ['pokemon', 'thanks'],
  ['laugh', 'laugh'],
  ['gg', 'gg'],
  ['luck', 'thanks'],
];

export interface Chat {
  readonly window: number;
  readonly members: readonly number[];
  readonly seats: readonly RoomSpot[];
  /** When each member means to be on their seat, and when each goes. */
  readonly arrive: readonly number[];
  readonly depart: readonly number[];
  readonly says: readonly { readonly member: number; readonly at: number; readonly phrase: HarbourPhraseId }[];
  readonly waves: readonly { readonly member: number; readonly at: number }[];
}

const chats = new Map<number, Chat | null>();

/**
 * The chat in a window, if there is one: who is in for all of it, read off the
 * schedule rather than off anybody's plan, so each of them can be told without
 * asking the others. Every member's plan keeps the appointment.
 */
export function chatInWindow(window: number): Chat | null {
  const known = chats.get(window);
  if (known !== undefined) {
    return known;
  }
  const chat = writeChat(window);
  chats.set(window, chat);
  if (chats.size > 200) {
    chats.delete(chats.keys().next().value as number);
  }
  return chat;
}

function writeChat(window: number): Chat | null {
  const roll = rngFor(6, window);
  if (!roll.chance(0.8)) {
    return null;
  }
  const start = window * CHAT_WINDOW_MS + roll.int(10_000, 40_000);
  const end = start + roll.int(26_000, 60_000);
  const firstVisit = Math.floor(start / BOT_SLOT_MS) - 8;
  const free: number[] = [];
  for (let visit = firstVisit; visit <= Math.floor(start / BOT_SLOT_MS); visit += 1) {
    const span = visitSpan(visit);
    if (span.from + CHAT_MARGIN_MS <= start && span.to - CHAT_MARGIN_MS - 8_000 >= end) {
      free.push(visit);
    }
  }
  if (free.length < 2) {
    return null;
  }
  const seats = roll.pick(CHAT_CIRCLES);
  const size = Math.min(free.length, seats.length, roll.chance(0.35) ? 3 : 2);
  const members = roll.shuffle(free).slice(0, size);
  const arrive: number[] = [];
  const depart: number[] = [];
  let at = start;
  let going = end;
  for (let index = 0; index < size; index += 1) {
    arrive.push(at);
    depart.push(going);
    at += roll.int(1_800, 5_000);
    going += roll.int(1_500, 3_500);
  }
  const lastIn = arrive[size - 1];
  const says: Chat['says'][number][] = [];
  const waves: Chat['waves'][number][] = [];
  // The one arriving puts a hand up; the first there, one back as it comes down.
  for (let index = 1; index < size; index += 1) {
    waves.push({ member: index, at: arrive[index] + 300 });
  }
  waves.push({ member: 0, at: arrive[1] + 300 + WAVE_SHOWN_MS });
  const speaker = roll.int(0, size - 1);
  const answerer = (speaker + 1) % size;
  const [line, answer] = roll.pick(CHAT_EXCHANGES);
  const said = lastIn + 300 + WAVE_SHOWN_MS * 2 + roll.int(1_000, 6_000);
  if (said + PHRASE_SHOWN_MS * 2 + 400 < end) {
    says.push({ member: speaker, at: said, phrase: line }, { member: answerer, at: said + PHRASE_SHOWN_MS + 400, phrase: answer });
  }
  // And now and then a goodbye from whoever goes first.
  const bye = depart[0] - PHRASE_SHOWN_MS - 200;
  const lastSaid = says[says.length - 1]?.at ?? lastIn;
  if (roll.chance(0.4) && bye > lastSaid + PHRASE_SHOWN_MS + 400) {
    says.push({ member: 0, at: bye, phrase: 'bye' });
  }
  return { window, members, seats, arrive, depart, says, waves };
}

/** Every chat one visit is in, in order. */
function chatsOf(visit: number): readonly { readonly chat: Chat; readonly member: number }[] {
  const { from, to } = visitSpan(visit);
  const found: { chat: Chat; member: number }[] = [];
  for (let window = Math.floor(from / CHAT_WINDOW_MS); window <= Math.floor(to / CHAT_WINDOW_MS); window += 1) {
    const chat = chatInWindow(window);
    const member = chat ? chat.members.indexOf(visit) : -1;
    if (chat && member >= 0) {
      found.push({ chat, member });
    }
  }
  return found;
}

// -- the book of who is where ----------------------------------------------------

interface Booking {
  readonly from: number;
  readonly to: number;
  readonly owner: number;
}

interface Stander extends Booking {
  readonly tile: number;
}

/**
 * Who is on which tile when, for the visits one block is planned against. A
 * tile is held from the moment somebody starts stepping onto it until the
 * partner at their heel has stepped off it again.
 */
class Bookings {
  private readonly tiles = new Map<number, Booking[]>();
  private readonly standers: Stander[] = [];
  private readonly doing: { readonly kind: BotActivity; readonly from: number; readonly to: number; readonly owner: number }[] = [];
  private readonly avoid = new Uint8Array(botGround().width * botGround().height);

  public free(tile: number, from: number, to: number, owner: number): boolean {
    return !(this.tiles.get(tile) ?? []).some((held) => held.owner !== owner && held.from < to && from < held.to);
  }

  public book(tile: number, from: number, to: number, owner: number): void {
    const list = this.tiles.get(tile);
    if (list) {
      list.push({ from, to, owner });
    } else {
      this.tiles.set(tile, [{ from, to, owner }]);
    }
  }

  /** Somebody standing on a tile a while: a walk goes round them rather than waiting. */
  public stand(tile: number, from: number, to: number, owner: number): void {
    this.book(tile, from, to, owner);
    this.standers.push({ tile, from, to, owner });
  }

  /** Marks everybody standing about at any time between two moments: the ground a walk goes round. */
  public standing(from: number, to: number, owner: number): Uint8Array {
    this.avoid.fill(0);
    for (const held of this.standers) {
      if (held.owner !== owner && held.from < to && from < held.to) {
        this.avoid[held.tile] = 1;
      }
    }
    return this.avoid;
  }

  /** Somebody started on an activity. */
  public started(kind: BotActivity, from: number, to: number, owner: number): void {
    this.doing.push({ kind, from, to, owner });
  }

  /** Whether somebody else starts the same thing so nearly at this moment that the two would be in step. */
  public inStep(kind: BotActivity, at: number, owner: number): boolean {
    return this.doing.some((other) => other.owner !== owner && other.kind === kind && Math.abs(other.from - at) < IN_STEP_MS);
  }

  /** How many others are at this between two moments. */
  public atIt(kind: BotActivity, from: number, to: number, owner: number): number {
    return this.doing.filter((other) => other.owner !== owner && other.kind === kind && other.from < to && from < other.to).length;
  }
}

/** Two people starting the same thing closer together than this are in step. */
export const IN_STEP_MS = 1_200;

/** The most regulars doing any one quiet thing at once. */
export const MOST_AT_ONE_THING = 2;

/** How long a tile is held by somebody stepping onto it: their step, the step off it, and their partner's. */
const HELD_FOR_MS = STEP_DURATION_MS * 3;

/** How long at a time somebody waits on a tile to let somebody by. */
const GIVE_WAY_MS = 200;

/** The longest anybody stands in the road for that: more is the wrong road. */
const LONGEST_GIVING_WAY_MS = 3_000;

/** How much later a walk may set off, at most, trying for a clear run. */
const LONGEST_HOLD_MS = 12_000;

/** How long somebody coming out of a door waits behind it for the doorstep to clear. */
const DOOR_BUSY_MS = 1_200;

/** Room left in every plan for giving way on the way to the next thing. */
const ROOM_TO_GIVE_WAY_MS = 4_000;

const key = (a: GridPosition, b: GridPosition): boolean => a.x === b.x && a.y === b.y;

export function directionOf(from: GridPosition, to: GridPosition): Direction {
  if (to.x > from.x) return 'right';
  if (to.x < from.x) return 'left';
  return to.y > from.y ? 'down' : 'up';
}

const walkMs = (steps: number): number => steps * STEP_DURATION_MS;

/** How long each thing takes, in ms, when there is room for all of it. */
const HOW_LONG: Readonly<Record<'hang-out' | 'watch-sea' | 'window-shop' | 'read-board' | 'knock' | 'stroll' | 'wander', readonly [number, number]>> = {
  'hang-out': [18_000, 60_000],
  'watch-sea': [20_000, 70_000],
  'window-shop': [9_000, 24_000],
  'read-board': [6_000, 12_000],
  knock: [7_000, 13_000],
  stroll: [3_000, 8_000],
  wander: [3_000, 9_000],
};

/** How likely each is, for most people. */
const USUALLY: readonly (readonly [Exclude<BotActivity, 'chat' | 'leave' | 'call-in'>, number])[] = [
  ['stroll', 3],
  ['wander', 2],
  ['hang-out', 3],
  ['watch-sea', 3],
  ['window-shop', 2],
  ['read-board', 1],
  ['knock', 2],
];

/** How many visits in a hundred are somebody who just potters about, as they always did. */
const WANDERERS_IN_A_HUNDRED = 25;

/** The shortest time that is worth starting anything else in. */
const WORTH_STARTING_MS = 9_000;

/** How far a wander goes between stops, in steps. */
const WANDER_REACH = 14;

/** How far away a stroll is going, in steps at least: somewhere else, not next door. */
const STROLL_AT_LEAST = 18;

/** Everywhere a stroll may be off to. */
const STROLL_ENDS: readonly RoomSpot[] = [...SEA_VIEWS, ...HANG_OUTS, ...SHOP_WINDOWS, ...NOTICE_BOARDS];

let solid: readonly (readonly boolean[])[] | null = null;

/** Whether somebody looking this way from a tile is looking at open air rather than into a wall. */
function looksOut(tile: GridPosition, facing: Direction): boolean {
  solid ??= getBaseMap([]).collision;
  const dx = facing === 'right' ? 1 : facing === 'left' ? -1 : 0;
  const dy = facing === 'down' ? 1 : facing === 'up' ? -1 : 0;
  return solid[tile.y + dy]?.[tile.x + dx] === false;
}

/** How far every tile is from a tile, in steps over the regulars' ground, by the tile: a plan asks a few hundred times. */
const distances = new Map<number, Int16Array>();

function distancesTo(to: GridPosition): Int16Array {
  const { walks, width, height } = botGround();
  const goal = to.y * width + to.x;
  const known = distances.get(goal);
  if (known) {
    return known;
  }
  const far = new Int16Array(width * height).fill(-1);
  far[goal] = 0;
  let frontier = [goal];
  while (frontier.length > 0) {
    const next: number[] = [];
    for (const at of frontier) {
      const x = at % width;
      const y = (at - x) / width;
      for (const [nx, ny] of [
        [x, y - 1],
        [x, y + 1],
        [x - 1, y],
        [x + 1, y],
      ]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || !walks[ny][nx]) continue;
        const step = ny * width + nx;
        if (far[step] >= 0) continue;
        far[step] = far[at] + 1;
        next.push(step);
      }
    }
    frontier = next;
  }
  distances.set(goal, far);
  return far;
}

/** The steps from one tile to another: from a way through, one more than from the ground beside it. */
function steps(from: GridPosition, to: GridPosition): number {
  const far = distancesTo(to);
  const { width, height } = botGround();
  const direct = far[from.y * width + from.x];
  if (direct >= 0) {
    return direct;
  }
  let best = 80;
  for (const [x, y] of [
    [from.x, from.y - 1],
    [from.x, from.y + 1],
    [from.x - 1, from.y],
    [from.x + 1, from.y],
  ]) {
    if (x >= 0 && y >= 0 && x < width && y < height && far[y * width + x] >= 0) {
      best = Math.min(best, far[y * width + x] + 1);
    }
  }
  return best;
}

/** One visit's plan, a thing at a time. */
class VisitPlanner {
  public readonly legs: VisitLeg[] = [];
  public readonly says: { at: number; phrase: HarbourPhraseId }[] = [];
  public readonly waves: number[] = [];
  private now: number;
  private at: GridPosition;
  /** Where their partner is standing: the tile they last walked off. */
  private heel: GridPosition | null = null;
  private last: BotActivity | null = null;
  private readonly wanderer: boolean;
  private readonly appointments: { readonly chat: Chat; readonly member: number }[];
  private leave: BotGate;
  /** The tile the last walk tried could not get onto. */
  private stuckOn = -1;

  private readonly visit: number;
  private readonly bot: HarbourBot;
  private readonly to: number;
  private readonly roll: SeededRng;
  private readonly book: Bookings;

  public constructor(visit: number, bot: HarbourBot, from: number, to: number, enter: BotGate, leave: BotGate, roll: SeededRng, book: Bookings) {
    this.visit = visit;
    this.bot = bot;
    this.to = to;
    this.roll = roll;
    this.book = book;
    this.now = from;
    this.at = enter.tile;
    this.leave = leave;
    this.wanderer = roll.int(0, 99) < WANDERERS_IN_A_HUNDRED;
    this.appointments = [...chatsOf(visit)];
  }

  public get gone(): BotGate {
    return this.leave;
  }

  /** Everything they do, from the way in to the way out. */
  public plan(): void {
    for (let tries = 0; tries < 200; tries += 1) {
      const appointment = this.appointments[0];
      const room = this.spareMs();
      if (room < WORTH_STARTING_MS && this.atAGate()) {
        // Somewhere to step out to, however short the visit: never standing in a doorway.
        if (!this.stepOut() && !appointment) break;
      }
      if (appointment && room < WORTH_STARTING_MS) {
        this.keepAppointment();
        continue;
      }
      if (room < WORTH_STARTING_MS) {
        break;
      }
      this.doSomething();
      if (this.legs.length === 0) {
        this.pushOut();
      }
    }
    if (this.legs.length === 0) {
      this.pushOut();
    }
    this.goHome();
  }

  /** How much time is left over before they must set off for the next thing that cannot move. */
  private spareMs(): number {
    const appointment = this.appointments[0];
    const walk = appointment
      ? walkMs(steps(this.at, appointment.chat.seats[appointment.member].tile)) + appointment.chat.arrive[appointment.member]
      : walkMs(steps(this.at, this.leave.tile)) + 0;
    return appointment
      ? walk - 2 * walkMs(steps(this.at, appointment.chat.seats[appointment.member].tile)) - this.now - ROOM_TO_GIVE_WAY_MS
      : this.to - walk - this.now - ROOM_TO_GIVE_WAY_MS;
  }

  /** How long something else may take if it ends standing on `tile`. */
  private spareAfterWalkingTo(tile: GridPosition): number {
    const appointment = this.appointments[0];
    const walking = walkMs(steps(this.at, tile));
    const goal = appointment ? appointment.chat.seats[appointment.member].tile : this.leave.tile;
    const deadline = appointment ? appointment.chat.arrive[appointment.member] : this.to;
    return deadline - walkMs(steps(tile, goal)) - walking - this.now - ROOM_TO_GIVE_WAY_MS;
  }

  private atAGate(): boolean {
    const last = this.legs[this.legs.length - 1];
    return last === undefined || last.kind === 'inside';
  }

  private doSomething(): void {
    // A room that is theirs about now comes first: it will not be theirs for long.
    if (!this.atAGate() && this.last !== 'call-in' && this.callIn(this.roomsOpenToThem())) {
      this.last = 'call-in';
      return;
    }
    const weighted = USUALLY.flatMap(([kind, weight]) => {
      const usual = this.wanderer ? (kind === 'wander' ? 12 : 1) : weight;
      return kind === this.last && kind !== 'wander' ? [] : Array.from({ length: usual }, () => kind);
    });
    for (let tries = 0; tries < 6; tries += 1) {
      const kind = this.roll.pick(weighted);
      if (this.tryActivity(kind)) {
        this.last = kind;
        return;
      }
    }
    // Nothing would have them: a few moments where they are, or out of the doorway.
    if (this.atAGate()) {
      this.stepOut();
    } else {
      this.waitUntil(this.now + Math.min(this.spareMs(), this.roll.int(2_000, 6_000)));
    }
  }

  private tryActivity(kind: Exclude<BotActivity, 'chat' | 'leave' | 'call-in'>): boolean {
    switch (kind) {
      case 'wander':
        return this.wander();
      case 'stroll':
        return this.stopAt(this.roll.shuffle(STROLL_ENDS.filter((end) => steps(this.at, end.tile) >= STROLL_AT_LEAST)), 'stroll');
      case 'hang-out':
        return this.stopAt(this.roll.shuffle(HANG_OUTS), 'hang-out');
      case 'watch-sea':
        return this.stopAt(this.roll.shuffle(SEA_VIEWS), 'watch-sea');
      case 'window-shop':
        return this.stopAt(this.roll.shuffle(SHOP_WINDOWS), 'window-shop');
      case 'read-board':
        return this.stopAt(this.roll.shuffle(NOTICE_BOARDS), 'read-board');
      case 'knock':
        return this.knock();
    }
  }

  /** The rooms that are theirs to call on in this window or the next. */
  private roomsOpenToThem(): readonly number[] {
    const window = Math.floor(this.now / ROOM_WINDOW_MS);
    return ROOM_CALLS.flatMap((_, index) => (roomCaller(index, window) === this.bot || roomCaller(index, window + 1) === this.bot ? [index] : []));
  }

  /** Off to the first of these with room for it, to stand there looking the right way. */
  private stopAt(spots: readonly RoomSpot[], kind: 'stroll' | 'hang-out' | 'watch-sea' | 'window-shop' | 'read-board'): boolean {
    const [shortest, longest] = HOW_LONG[kind];
    if (kind !== 'stroll' && this.book.atIt(kind, this.now, this.now + longest, this.visit) >= MOST_AT_ONE_THING) {
      return false;
    }
    for (const spot of spots.slice(0, 8)) {
      const room = this.spareAfterWalkingTo(spot.tile);
      if (room < shortest) continue;
      const stay = Math.min(room, this.roll.int(shortest, longest));
      if (!this.walkTo(spot.tile, kind, stay)) continue;
      this.standLooking(stay, kind, spot.facing);
      return true;
    }
    return false;
  }

  /** A few short hops about the nearest bit of open ground, looking about at each stop. */
  private wander(): boolean {
    const { spots } = botGround();
    const hops = this.roll.int(2, 4);
    let done = false;
    for (let hop = 0; hop < hops; hop += 1) {
      const near = this.roll.shuffle(
        spots.filter((spot) => !key(spot, this.at) && Math.abs(spot.x - this.at.x) + Math.abs(spot.y - this.at.y) <= WANDER_REACH),
      );
      const [shortest, longest] = HOW_LONG.wander;
      let moved = false;
      for (const spot of near.slice(0, 6)) {
        const room = this.spareAfterWalkingTo(spot);
        if (room < shortest) continue;
        const stay = Math.min(room, this.roll.int(shortest, longest));
        if (!this.walkTo(spot, 'wander', stay)) continue;
        this.standAbout(stay);
        moved = true;
        done = true;
        break;
      }
      if (!moved) break;
    }
    return done;
  }

  /** Up to a keeper's door, a hand raised at it and a wait - and in, if the room is theirs just now. */
  private knock(): boolean {
    const [shortest, longest] = HOW_LONG.knock;
    for (const id of this.roll.shuffle(KNOCKED_DOORS).slice(0, 3)) {
      const door = doorNamed(id);
      if (!door) continue;
      const room = this.spareAfterWalkingTo(door.returnTo);
      if (room < shortest) continue;
      const stay = Math.min(room, this.roll.int(shortest, longest));
      if (!this.walkTo(door.returnTo, 'knock', stay)) continue;
      const knocked = this.now + 900;
      this.waves.push(knocked);
      if (stay > 5_000) {
        this.waves.push(knocked + WAVE_SHOWN_MS + this.roll.int(900, 1_800));
      }
      if (this.roll.chance(0.1)) {
        this.says.push({ at: this.now + stay - PHRASE_SHOWN_MS, phrase: 'hello' });
      }
      this.standLooking(stay, 'knock', 'up', true);
      if (this.roll.chance(0.6)) {
        this.callIn([ROOM_CALLS.findIndex((call) => call.room === id)]);
      }
      return true;
    }
    return false;
  }

  /**
   * A call on a keeper from where they are standing, if one fits: a room that
   * is theirs to call in for a window starting about now, the walk to its
   * door, a call of `CALL_MS` inside the window, and time after it to get to
   * the next thing they have to be at.
   */
  private callIn(rooms: readonly number[]): boolean {
    for (const roomIndex of rooms) {
      const call = ROOM_CALLS[roomIndex];
      const door = doorNamed(call.room)?.tiles[0];
      if (!door || this.atAGate()) continue;
      const arrival = this.now + walkMs(steps(this.at, door));
      for (const window of [Math.floor(arrival / ROOM_WINDOW_MS), Math.floor(arrival / ROOM_WINDOW_MS) + 1]) {
        if (roomCaller(roomIndex, window) !== this.bot) continue;
        const opens = window * ROOM_WINDOW_MS;
        const inside = Math.max(arrival, opens);
        const wait = inside - arrival;
        const longest = Math.min(CALL_MS[1], opens + ROOM_WINDOW_MS - 3_000 - LONGEST_HOLD_MS - inside);
        if (wait > 12_000 || longest < CALL_MS[0]) continue;
        const out = inside + this.roll.int(CALL_MS[0], longest);
        // With a little over, for somebody held in the doorway coming out.
        if (fewestPresent(inside, out + LONGEST_HOLD_MS) < CALL_WHILE_AT_LEAST) continue;
        // Time after it to get to the next thing, stepping out of the door first.
        const appointment = this.appointments[0];
        const goal = appointment ? appointment.chat.seats[appointment.member].tile : this.leave.tile;
        const deadline = appointment ? appointment.chat.arrive[appointment.member] : this.to;
        if (out + walkMs(steps(door, goal)) + WORTH_STARTING_MS > deadline) continue;
        if (wait > 0 && !this.waitUntil(this.now + wait)) continue;
        if (!this.walkTo(door, 'call-in', 0)) continue;
        const spot = this.roll.pick(call.spots);
        const from = this.now;
        if (from < opens || from >= opens + ROOM_WINDOW_MS - 3_000) {
          // Held up, or there too soon, the room is not theirs: on past the door.
          if (!this.stepOut()) {
            this.pushOut();
          }
          return true;
        }
        const to = Math.max(from + 1_000, Math.min(out, opens + ROOM_WINDOW_MS - 2_000));
        this.legs.push({ kind: 'inside', from, to, room: call.room, door, spot, activity: 'call-in' });
        this.now = to;
        this.at = door;
        this.heel = null;
        if (!this.stepOut()) {
          this.pushOut();
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Out of the door they came by, whoever is about, when nothing would have
   * them: a visit is on the map from its first moment, and the figures as drawn
   * wait for whoever is in the way (`harbourRegulars.ts`).
   */
  private pushOut(): void {
    const spot = [...botGround().spots].sort(
      (a, b) => Math.abs(a.x - this.at.x) + Math.abs(a.y - this.at.y) - (Math.abs(b.x - this.at.x) + Math.abs(b.y - this.at.y)),
    )[0];
    const route = botPath(this.at, spot) ?? [this.at];
    this.commitWalk(route, route.slice(1).map((_, index) => this.now + walkMs(index)), 'wander');
    this.standAbout(this.roll.int(1_500, 3_000));
  }

  /** Out of a doorway to the nearest open ground, for a moment, so nobody is left standing in it. */
  private stepOut(): boolean {
    const { spots } = botGround();
    const near = [...spots]
      .map((spot) => ({ spot, far: Math.abs(spot.x - this.at.x) + Math.abs(spot.y - this.at.y) }))
      .sort((a, b) => a.far - b.far)
      .slice(0, 8);
    for (const { spot } of near) {
      const stay = this.roll.int(1_500, 3_000);
      if (!this.walkTo(spot, 'wander', stay)) continue;
      this.standAbout(stay);
      return true;
    }
    return false;
  }

  private keepAppointment(): void {
    const appointment = this.appointments.shift();
    if (!appointment) return;
    const { chat, member } = appointment;
    const seat = chat.seats[member];
    const until = chat.depart[member];
    const walking = walkMs(steps(this.at, seat.tile));
    const setOff = chat.arrive[member] - walking - 1_000;
    if (!this.atAGate() && setOff > this.now) {
      this.waitUntil(setOff);
    }
    if (!this.walkTo(seat.tile, 'chat', until - this.now - walking, true)) {
      // Expected, and nobody in the way would give up on them: straight there.
      const avoid = this.book.standing(this.now, until, this.visit);
      const route = botPath(this.at, seat.tile, avoid) ?? botPath(this.at, seat.tile) ?? [this.at];
      this.commitWalk(route, route.slice(1).map((_, index) => this.now + walkMs(index)), 'chat');
    }
    this.standLooking(Math.max(500, until - this.now), 'chat', seat.facing, true);
    for (const said of chat.says) {
      if (said.member === member && said.at < until) {
        this.says.push({ at: said.at, phrase: said.phrase });
      }
    }
    for (const wave of chat.waves) {
      if (wave.member === member && wave.at < until) {
        this.waves.push(wave.at);
      }
    }
  }

  /**
   * Out by the way they planned, or the nearest that still gets them there by
   * the moment the schedule says they are gone, setting off as late as gets them
   * there: the harbour's ways out are doors and boats, so they are never seen to go.
   */
  private goHome(retried = false): void {
    const ways = [this.leave, ...this.roll.shuffle(BOT_GATES).filter((gate) => gate !== this.leave)];
    for (const way of ways) {
      const path = botPath(this.at, way.tile);
      if (!path || path.length < 2) continue;
      for (let early = 0; early <= 40; early += 1) {
        const setOff = this.to - walkMs(path.length - 1) - early * GIVE_WAY_MS * 2;
        if (setOff < this.now) break;
        const run = this.findRun(way.tile, setOff, this.to, retried ? LONGEST_GIVING_WAY_MS * 3 : LONGEST_GIVING_WAY_MS);
        if (!run || run.starts[run.starts.length - 1] + STEP_DURATION_MS > this.to) continue;
        const { route, starts } = run;
        if (!this.ableToStayUntil(setOff)) break;
        this.holdUntil(setOff);
        this.leave = way;
        // Whatever they gained by not meeting anybody, they spend at the door.
        const lastStep = starts.length - 1;
        const spare = this.to - STEP_DURATION_MS - starts[lastStep];
        starts[lastStep] += Math.max(0, spare);
        this.commitWalk(route, starts, 'leave');
        return;
      }
    }
    // Somebody needs the tile they are waiting on: nearer the way out, and off from there.
    if (!retried) {
      const out = botPath(this.at, this.leave.tile);
      if (out && this.waitUntil(this.to - walkMs(out.length - 1) - ROOM_TO_GIVE_WAY_MS)) {
        this.goHome(true);
        return;
      }
    }
    // Everything else failed: straight there, on time, whoever is about.
    const avoid = this.book.standing(this.now, this.to, this.visit);
    // The way they meant to go, unless they have left it too late: then the nearest.
    const nearest = [...BOT_GATES]
      .filter((gate) => !key(gate.tile, this.at))
      .sort((a, b) => steps(this.at, a.tile) - steps(this.at, b.tile))[0];
    const way = key(this.leave.tile, this.at) || this.now + walkMs(steps(this.at, this.leave.tile)) > this.to ? nearest : this.leave;
    this.leave = way;
    const route = botPath(this.at, way.tile, avoid) ?? botPath(this.at, way.tile) ?? [this.at];
    const setOff = Math.max(this.now, this.to - walkMs(route.length - 1));
    this.holdUntil(setOff);
    this.commitWalk(route, route.slice(1).map((_, index) => setOff + walkMs(index)), 'leave');
  }

  private ableToStayUntil(moment: number): boolean {
    const lastLeg = this.legs[this.legs.length - 1];
    if (lastLeg === undefined) {
      return true;
    }
    if (lastLeg.kind === 'inside') {
      // Their call is theirs only until the room is somebody else's.
      return Math.floor(moment / ROOM_WINDOW_MS) === Math.floor(lastLeg.from / ROOM_WINDOW_MS);
    }
    return this.book.free(tileIndex(this.at), this.now, moment + STEP_DURATION_MS, this.visit);
  }

  /**
   * Passes the time until a moment: where they are if nobody needs the tile, or
   * else on the nearest bit of ground nobody does. False if neither is possible.
   */
  private waitUntil(moment: number): boolean {
    if (moment <= this.now) {
      return true;
    }
    if (this.ableToStayUntil(moment)) {
      return this.holdUntil(moment);
    }
    const near = [...botGround().spots]
      .map((spot) => ({ spot, far: Math.abs(spot.x - this.at.x) + Math.abs(spot.y - this.at.y) }))
      .sort((a, b) => a.far - b.far)
      .slice(0, 10);
    for (const { spot } of near) {
      if (key(spot, this.at)) continue;
      const arrival = this.now + walkMs(steps(this.at, spot));
      if (arrival + 1_000 > moment) continue;
      if (!this.walkTo(spot, 'wander', moment - arrival)) continue;
      this.standAbout(Math.max(1, moment - this.now));
      return true;
    }
    return false;
  }

  /** Stays where they are until a moment: longer at what they were doing, or longer indoors. */
  private holdUntil(moment: number): boolean {
    if (moment <= this.now) {
      return true;
    }
    const lastLeg = this.legs[this.legs.length - 1];
    if (lastLeg?.kind === 'inside') {
      this.legs[this.legs.length - 1] = { ...lastLeg, to: moment };
      this.now = moment;
      return true;
    }
    if (lastLeg?.kind === 'pause') {
      this.book.stand(tileIndex(this.at), this.now, moment + STEP_DURATION_MS, this.visit);
      this.legs[this.legs.length - 1] = { ...lastLeg, to: moment };
      this.now = moment;
      return true;
    }
    if (lastLeg?.kind === 'walk') {
      this.standHere(moment - this.now, lastLeg.activity);
      return true;
    }
    // Not arrived yet: the door they are about to come out of is busy.
    this.now = moment;
    return true;
  }

  /**
   * Walks to a tile by the first clear run: round whoever is standing about,
   * giving way to whoever is passing, setting off a little later if the road is
   * full - and never at the very moment somebody else starts the same thing.
   */
  private walkTo(tile: GridPosition, kind: BotActivity, stay: number, must = false): boolean {
    if (key(tile, this.at)) {
      return must || this.book.free(tileIndex(tile), this.now, this.now + stay + STEP_DURATION_MS, this.visit);
    }
    // However long they wait for a clear run, it comes out of the time they have.
    // Not out of the door yet, they are only held a moment: a door busy for longer is another way out for them.
    const mostHeld = this.legs.length === 0 ? DOOR_BUSY_MS : must ? LONGEST_HOLD_MS : Math.min(LONGEST_HOLD_MS, this.spareAfterWalkingTo(tile) - stay);
    for (let held = 0; held <= mostHeld; held += 400) {
      const start = this.now + held;
      if (held > 0 && !this.ableToStayUntil(start)) break;
      const run = this.findRun(tile, start, start + walkMs(70) + stay, must ? LONGEST_GIVING_WAY_MS * 3 : LONGEST_GIVING_WAY_MS);
      if (!run) continue;
      const { route, starts } = run;
      const arrival = starts[starts.length - 1] + STEP_DURATION_MS;
      if (!must && !this.book.free(tileIndex(tile), arrival, arrival + stay + STEP_DURATION_MS, this.visit)) continue;
      if (!must && this.book.inStep(kind, arrival, this.visit)) continue;
      this.holdUntil(start);
      this.commitWalk(route, starts, kind);
      return true;
    }
    return false;
  }

  /**
   * A way to a tile with a clear run from `start`: round everybody standing
   * about between then and `until`, and round whatever stopped the last try.
   */
  private findRun(
    tile: GridPosition,
    start: number,
    until: number,
    longest = LONGEST_GIVING_WAY_MS,
  ): { readonly route: readonly GridPosition[]; readonly starts: number[] } | null {
    const avoid = this.book.standing(start, until, this.visit);
    for (let tries = 0; tries < 5; tries += 1) {
      const route = botPath(this.at, tile, avoid);
      if (!route) return null;
      const starts = this.clearRun(route, start, !this.atAGate(), longest);
      if (starts) return { route, starts };
      if (this.stuckOn === tileIndex(tile)) return null;
      avoid[this.stuckOn] = 1;
    }
    return null;
  }

  /** When each step of a walk begins, setting off at `start`, or null if there is no clear run. */
  private clearRun(route: readonly GridPosition[], start: number, canWaitFirst: boolean, longest = LONGEST_GIVING_WAY_MS): number[] | null {
    const starts: number[] = [];
    let at = start;
    for (let index = 1; index < route.length; index += 1) {
      const next = tileIndex(route[index]);
      const here = tileIndex(route[index - 1]);
      let waited = 0;
      while (!this.book.free(next, at, at + HELD_FOR_MS, this.visit)) {
        if (waited >= longest || (index === 1 && !canWaitFirst) || !this.book.free(here, at, at + GIVE_WAY_MS + HELD_FOR_MS, this.visit)) {
          this.stuckOn = next;
          return null;
        }
        at += GIVE_WAY_MS;
        waited += GIVE_WAY_MS;
      }
      starts.push(at);
      at += STEP_DURATION_MS;
    }
    return starts;
  }

  private commitWalk(route: readonly GridPosition[], starts: readonly number[], kind: BotActivity): void {
    if (route.length < 2) {
      return;
    }
    // Giving way before the first step is standing a little longer where they were.
    this.holdUntil(starts[0]);
    let from = starts[0];
    let path: GridPosition[] = [route[0]];
    const flush = (): void => {
      if (path.length > 1) {
        this.legs.push({ kind: 'walk', from, path, activity: kind });
      }
    };
    this.book.book(tileIndex(route[0]), this.now, starts[0] + STEP_DURATION_MS * 2, this.visit);
    let clock = starts[0];
    for (let index = 1; index < route.length; index += 1) {
      const begin = starts[index - 1];
      if (begin > clock) {
        // Giving way on the tile they had got to.
        flush();
        const standing = route[index - 1];
        const facing = directionOf(standing, route[index]);
        this.legs.push({ kind: 'pause', from: clock, to: begin, tile: standing, looks: [{ at: clock, facing }], activity: kind, givingWay: true });
        this.book.book(tileIndex(standing), clock, begin + HELD_FOR_MS, this.visit);
        from = begin;
        path = [standing];
      }
      path.push(route[index]);
      this.book.book(tileIndex(route[index]), begin, begin + HELD_FOR_MS, this.visit);
      clock = begin + STEP_DURATION_MS;
    }
    flush();
    this.now = clock;
    this.at = route[route.length - 1];
    this.heel = route[route.length - 2];
  }

  /** Stands facing one way, with now and then a glance aside and back. */
  private standLooking(ms: number, kind: BotActivity, facing: Direction, steady = false): void {
    const from = this.now;
    const to = from + ms;
    const looks: { at: number; facing: Direction }[] = [{ at: from, facing }];
    if (!steady) {
      for (let at = from + this.roll.int(5_000, 11_000); at < to - 3_000; at += this.roll.int(7_000, 14_000)) {
        const aside = this.roll.pick(sideways(facing));
        if (!looksOut(this.at, aside)) continue;
        looks.push({ at, facing: aside }, { at: at + this.roll.int(1_200, 2_400), facing });
      }
    }
    this.stood(from, to, looks, kind);
  }

  /** Stands looking about, as somebody with nothing to do does: any way but into a wall. */
  private standAbout(ms: number): void {
    const from = this.now;
    const to = from + ms;
    const open = FACINGS.filter((facing) => looksOut(this.at, facing));
    const arrived = this.heel ? directionOf(this.heel, this.at) : (open[0] ?? 'down');
    const looks: { at: number; facing: Direction }[] = [{ at: from, facing: arrived }];
    for (let at = from + this.roll.int(1_500, 4_000); at < to - 800; at += this.roll.int(1_500, 4_000)) {
      looks.push({ at, facing: this.roll.pick(open.length > 0 ? open : FACINGS) });
    }
    this.stood(from, to, looks, 'wander');
  }

  /** Stands where they got to, at nothing in particular, looking the way they came in. */
  private standHere(ms: number, kind: BotActivity): void {
    const facing = this.lastFacing();
    this.stood(this.now, this.now + ms, [{ at: this.now, facing }], kind);
  }

  private stood(from: number, to: number, looks: readonly { at: number; facing: Direction }[], kind: BotActivity): void {
    if (to <= from) {
      return;
    }
    this.legs.push({ kind: 'pause', from, to, tile: this.at, looks, activity: kind });
    this.book.stand(tileIndex(this.at), from, to + STEP_DURATION_MS, this.visit);
    if (this.heel && this.book.free(tileIndex(this.heel), from, to + HELD_FOR_MS, this.visit)) {
      this.book.stand(tileIndex(this.heel), from, to + HELD_FOR_MS, this.visit);
    }
    this.book.started(kind, from, to, this.visit);
    this.now = to;
  }

  private lastFacing(): Direction {
    const leg = this.legs[this.legs.length - 1];
    if (leg?.kind === 'pause') {
      return leg.looks[leg.looks.length - 1].facing;
    }
    if (leg?.kind === 'walk' && leg.path.length > 1) {
      return directionOf(leg.path[leg.path.length - 2], leg.path[leg.path.length - 1]);
    }
    return 'down';
  }
}

const FACINGS: readonly Direction[] = ['up', 'down', 'left', 'right'];

function sideways(facing: Direction): readonly Direction[] {
  return facing === 'up' || facing === 'down' ? ['left', 'right'] : ['up', 'down'];
}

// -- the plans ------------------------------------------------------------------

/** How many visits are planned against each other at a time. A visit is never in for this many slots. */
export const PLAN_BLOCK_VISITS = 16;

/** Planned blocks, by block number, each a plan per visit. */
const blocks = new Map<number, ReadonlyMap<number, VisitPlan>>();

/** Forgets every plan, for a test asking that a plan does not depend on what was asked before it. */
export function forgetVisitPlans(): void {
  blocks.clear();
  chats.clear();
}

function blockPlans(block: number): ReadonlyMap<number, VisitPlan> {
  const known = blocks.get(block);
  if (known) {
    return known;
  }
  const book = new Bookings();
  const firstVisit = block * PLAN_BLOCK_VISITS;
  bookChats(book, firstVisit * BOT_SLOT_MS - BOT_SLOT_MS * 8, (firstVisit + PLAN_BLOCK_VISITS + 8) * BOT_SLOT_MS);
  if (Math.abs(block) % 2 === 0) {
    // An even block makes way for the odd one on each side of it, which took no notice of anybody.
    for (const neighbour of [block - 1, block + 1]) {
      for (const plan of blockPlans(neighbour).values()) {
        bookPlan(book, plan);
      }
    }
  }
  const plans = new Map<number, VisitPlan>();
  for (let visit = firstVisit; visit < firstVisit + PLAN_BLOCK_VISITS; visit += 1) {
    plans.set(visit, planVisit(visit, book));
  }
  blocks.set(block, plans);
  // Blocks long gone are not asked about again.
  for (const old of blocks.keys()) {
    if (old < block - 6) blocks.delete(old);
  }
  return plans;
}

/** Everybody's seat at every chat near a block, held from the start: nobody plans a walk through a conversation. */
function bookChats(book: Bookings, from: number, to: number): void {
  for (let window = Math.floor(from / CHAT_WINDOW_MS); window <= Math.floor(to / CHAT_WINDOW_MS); window += 1) {
    const chat = chatInWindow(window);
    if (!chat) continue;
    chat.members.forEach((visit, member) => {
      book.stand(tileIndex(chat.seats[member].tile), chat.arrive[member] - 4_000, chat.depart[member] + HELD_FOR_MS, visit);
    });
  }
}

/** Another block's plan, in this block's book. */
function bookPlan(book: Bookings, plan: VisitPlan): void {
  for (const leg of plan.legs) {
    if (leg.kind === 'pause') {
      book.stand(tileIndex(leg.tile), leg.from, leg.to + HELD_FOR_MS, plan.visit);
      if (!leg.givingWay) {
        book.started(leg.activity, leg.from, leg.to, plan.visit);
      }
    } else if (leg.kind === 'walk') {
      leg.path.forEach((tile, index) => {
        const stepped = leg.from + walkMs(Math.max(0, index - 1));
        book.book(tileIndex(tile), stepped, stepped + HELD_FOR_MS, plan.visit);
      });
    }
  }
}

function planVisit(visit: number, book: Bookings): VisitPlan {
  const bot = visitBot(visit);
  const { from, to } = visitSpan(visit);
  const roll = rngFor(4, visit);
  const ways = roll.shuffle(BOT_GATES);
  // Into the harbour by a way nobody is in the middle of using.
  const enter = ways.find((gate) => book.free(tileIndex(gate.tile), from, from + HELD_FOR_MS, visit)) ?? ways[0];
  const leave = roll.pick(BOT_GATES);
  const planner = new VisitPlanner(visit, bot, from, to, enter, leave, roll, book);
  planner.plan();
  return { visit, bot, from, to, enter, leave: planner.gone, legs: planner.legs, says: planner.says, waves: planner.waves };
}

/** Everything one visit does, from the tile they appear on to the tile they go from. */
export function visitPlan(visit: number): VisitPlan {
  return blockPlans(Math.floor(visit / PLAN_BLOCK_VISITS)).get(visit)!;
}

// -- at a moment ----------------------------------------------------------------

/** Where a regular is at a moment, out in the yard - or, `inside`, calling on a keeper. */
export interface BotWhere {
  readonly tile: GridPosition;
  readonly next: GridPosition | null;
  readonly facing: Direction;
  readonly walking: boolean;
  /** What they are about. */
  readonly activity: BotActivity;
  readonly inside?: Extract<VisitLeg, { kind: 'inside' }>;
  /** How far in or out of a doorway they are, 0 (gone) to 1, on the step through it; absent elsewhere. */
  readonly fade?: number;
}

/** Whether a tile is one a regular appears on or goes from. */
const isWayThrough = (tile: GridPosition): boolean => BOT_GATES.some((gate) => key(gate.tile, tile));

/**
 * Where a visit's regular is at a moment: the tile they are on (or have just
 * stepped onto, `next` while they are walking towards it) and which way they
 * face - or null before they arrive and once they have gone.
 */
export function botAt(plan: VisitPlan, nowMs: number): BotWhere | null {
  if (nowMs < plan.from || nowMs >= plan.to) {
    return null;
  }
  for (let index = plan.legs.length - 1; index >= 0; index -= 1) {
    const leg = plan.legs[index];
    if (leg.from > nowMs) continue;
    if (leg.kind === 'inside') {
      if (nowMs >= leg.to) continue;
      return { tile: leg.door, next: null, facing: 'up', walking: false, activity: 'call-in', inside: leg };
    }
    if (leg.kind === 'pause') {
      if (nowMs >= leg.to) continue;
      const look = [...leg.looks].reverse().find((each) => each.at <= nowMs) ?? leg.looks[0];
      return { tile: leg.tile, next: null, facing: look.facing, walking: false, activity: leg.activity };
    }
    const elapsed = nowMs - leg.from;
    const step = Math.min(leg.path.length - 1, Math.floor(elapsed / STEP_DURATION_MS));
    const tile = leg.path[step];
    const next = leg.path[step + 1] ?? null;
    const facing = next ? directionOf(tile, next) : step > 0 ? directionOf(leg.path[step - 1], tile) : 'down';
    const progress = (elapsed - step * STEP_DURATION_MS) / STEP_DURATION_MS;
    const before = plan.legs[index - 1];
    const after = plan.legs[index + 1];
    // Coming out of a doorway or over a gunwale, and going back in: never popping up in view.
    const comingOut = step === 0 && next !== null && (before === undefined || before.kind === 'inside') && isWayThrough(tile);
    const goingIn = next !== null && step === leg.path.length - 2 && (after === undefined || after.kind === 'inside') && isWayThrough(next);
    const fade = comingOut ? progress : goingIn ? 1 - progress : undefined;
    return { tile, next, facing, walking: next !== null, activity: leg.activity, ...(fade === undefined ? {} : { fade }) };
  }
  return null;
}

/** The phrase a visit's regular is saying at a moment, if any. */
export function botSayingAt(plan: VisitPlan, nowMs: number): HarbourPhraseId | null {
  return plan.says.find((said) => said.at <= nowMs && nowMs < said.at + PHRASE_SHOWN_MS)?.phrase ?? null;
}

/** Whether a visit's regular has their hand up at a moment. */
export function botWavingAt(plan: VisitPlan, nowMs: number): boolean {
  return plan.waves.some((at) => at <= nowMs && nowMs < at + WAVE_SHOWN_MS);
}
