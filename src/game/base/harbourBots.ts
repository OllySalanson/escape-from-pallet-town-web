import type { Direction, GridPosition } from '../movement/gridMovement';
import { createSeededRng, type SeededRng } from '../run/rng';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import { BASE_LANDING, BASE_SIGNS, BASE_SPAWN, getBaseMap } from './baseMap';
import { BASE_FIXTURES } from './fixtures';
import { HARBOUR_LANDMARKS } from './landmarks';
import { LOITER_SPOTS } from './generated/harbourBotSpots';
import { DAY_CARE_KEEPER } from './dayCarePen';
import { BASE_DOORS } from './doors';
import type { SHARED_HARBOUR_ROOMS } from '../harbour/harbourProtocol';
import { harbourBeatTiles, harbourLifeAt, onLand } from './harbourLife';
import type { PartnerSpeciesId } from './partner';
import type { DressedLook } from '../look/look';

/**
 * The harbour's regulars: twelve people who walk THE HARBOUR as players do,
 * so a newcomer's first sight of the shared yard is a busy one (the captain,
 * 29 Oct: "make it look like the game is populated").
 *
 * They look exactly like players because they are drawn the same way - the
 * shared figure, a name plate, a partner at heel (`harbourFigures.ts`) - and
 * they walk the way another player's figure walks, a step at a time through
 * `HarbourCrowd` (`harbourBotCrowd.ts`). What they are not is players: they
 * never go on the wire, so nothing that counts or lists players - the
 * channel, the knock list, a playtest's `harbourFiguresShown` - ever sees one.
 *
 * Everything here is a pure function of the clock. Who is in the harbour at a
 * moment, where each one is walking and where they pause is decided by the
 * time alone, so two players looking at the same harbour at the same moment
 * see the same regulars in the same places, and a test - or the stepped clock
 * of test mode - gets the same harbour every time.
 *
 * **Who is here.** Time is cut into slots of `BOT_SLOT_MS`. One regular
 * arrives in every slot (`visitBot`), and how many stay is a width `w(k)`
 * between `BOTS_MIN_PRESENT` and `BOTS_MAX_PRESENT` that can grow by at most
 * one a slot (`presentWidth`): visits `k + 1 - w(k)` to `k` are in at the end
 * of slot `k`, so each slot sees one arrival and as many departures as the
 * width shrank by plus one. Inside a slot the arrival and the departures are
 * put at uneven moments, with only as many departures before the arrival as
 * keep the count inside its bounds (`slotEvents`), so nobody ever sees seven
 * regulars, or one.
 *
 * **What they do.** Each visit comes in somewhere a player would - off a boat
 * or out of one of the buildings - picks something to do, then something else
 * when that is done, and leaves the same ways, timed to be gone at the moment
 * the schedule says: `harbourActivities.ts` is the list and the plan. A loiter
 * spot is open ground with nothing solid round it and nothing a player comes to
 * the yard for near it, and the walks keep off the doorways, the spawn and the
 * landing. Regulars are not collision, as players are not, so even passing
 * they block nothing.
 */

export interface HarbourBot {
  readonly id: string;
  /** The name on their plate, by the rule a player's name follows: capitals, ten at most. */
  readonly name: string;
  readonly partner: PartnerSpeciesId;
  /**
   * What they wear, from THE HARBOUR BOUTIQUE's own shelves (`../look/`), so a
   * busy harbour shows what the boutique sells - every one a different look.
   */
  readonly look: DressedLook;
}

export const HARBOUR_BOTS: readonly HarbourBot[] = [
  {
    id: 'bot:bulbaluv',
    name: 'BULBALUV',
    partner: 'bulbasaur',
    look: { head: 'lass-hair', top: 'plain-tee', legs: 'plain-trousers', body: 'sundress' },
  },
  {
    id: 'bot:finny2011',
    name: 'FINNY2011',
    partner: 'charmander',
    look: { head: 'youngster-cap-red', top: 'casual-jacket', legs: 'cargo-trousers', body: null },
  },
  {
    id: 'bot:tess-swims',
    name: 'TESS-SWIMS',
    partner: 'squirtle',
    look: { head: 'swimmer-tail', top: 'plain-tee', legs: 'plain-trousers', body: 'swimsuit' },
  },
  {
    id: 'bot:oz-hikes',
    name: 'OZ-HIKES',
    partner: 'ivysaur',
    look: { head: 'hiker-hat', top: 'plain-tee', legs: 'plain-trousers', body: 'hiker-gear' },
  },
  {
    id: 'bot:karpking',
    name: 'KARPKING',
    partner: 'wartortle',
    look: { head: 'ace-tail', top: 'plain-tee', legs: 'plain-trousers', body: 'ace-suit' },
  },
  {
    id: 'bot:xkitx',
    name: 'XKITX',
    partner: 'charmeleon',
    look: { head: 'rocker-quiff', top: 'rocker-jacket', legs: 'denim-jeans', body: null },
  },
  {
    id: 'bot:dexhunter',
    name: 'DEXHUNTER',
    partner: 'squirtle',
    look: { head: 'fisher-cap', top: 'fishing-vest', legs: 'sky-trousers', body: null },
  },
  {
    id: 'bot:beebee22',
    name: 'BEEBEE22',
    partner: 'bulbasaur',
    look: { head: 'picnicker-hat', top: 'plain-tee', legs: 'plain-trousers', body: 'picnic-dungarees' },
  },
  {
    id: 'bot:1moreraid',
    name: '1MORERAID',
    partner: 'charmander',
    look: { head: 'bowl-cut', top: 'office-shirt', legs: 'smart-shorts', body: null },
  },
  {
    id: 'bot:og-nell',
    name: 'OG-NELL',
    partner: 'venusaur',
    look: { head: 'golden-waves', top: 'plain-tee', legs: 'plain-trousers', body: 'long-skirt' },
  },
  {
    id: 'bot:toise4life',
    name: 'TOISE4LIFE',
    partner: 'blastoise',
    look: { head: 'sailor-cap', top: 'plain-tee', legs: 'plain-trousers', body: 'sailor-whites' },
  },
  {
    id: 'bot:skyezard',
    name: 'SKYEZARD',
    partner: 'charizard',
    look: { head: 'ace-wave', top: 'ace-jacket', legs: 'ace-trousers', body: null },
  },
];

/** How long a slot of the schedule is: one regular arrives in every one. */
export const BOT_SLOT_MS = 45_000;

/** The fewest regulars in the harbour at any moment. */
export const BOTS_MIN_PRESENT = 2;

/** The most. */
export const BOTS_MAX_PRESENT = 6;

/** Ties every roll here to this file, so no other seeded roll moves with it. */
const SALT = 0x4a7b0c11;

export function rngFor(...parts: readonly number[]): SeededRng {
  let seed = SALT;
  for (const part of parts) {
    seed = Math.imul(seed ^ (part | 0), 0x9e3779b1) ^ (seed >>> 15);
    seed = Math.imul(seed ^ Math.floor(part / 4_294_967_296), 0x85ebca77) ^ (seed >>> 13);
  }
  return createSeededRng(seed >>> 0);
}

/** A slot's own wish for how many are in: weighted towards a lively yard. */
function wishedWidth(slot: number): number {
  return rngFor(1, slot).pick([2, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6]);
}

/**
 * How many regulars are in at the end of a slot: the least of each recent
 * slot's wish plus how long ago it was, which can drop as far as it likes from
 * one slot to the next but grow by at most one - the one arrival a slot brings.
 */
export function presentWidth(slot: number): number {
  let width = Number.POSITIVE_INFINITY;
  for (let back = 0; back <= BOTS_MAX_PRESENT - BOTS_MIN_PRESENT; back += 1) {
    width = Math.min(width, wishedWidth(slot - back) + back);
  }
  return width;
}

/** The first visit still in at the end of a slot. */
const firstIn = (slot: number): number => slot + 1 - presentWidth(slot);

/** Six regulars in a group: a visit's regular is from one group, the next block's from the same, so nobody is back within seven visits. */
const GROUP_SIZE = HARBOUR_BOTS.length / 2;

/**
 * Which regular a visit is. Visits run in blocks of twelve, each block every
 * regular once - the first six from one half of the roster, the last six from
 * the other, each half shuffled anew - so the same regular is never in twice
 * at once and is always gone a while between visits.
 */
export function visitBot(visit: number): HarbourBot {
  const block = Math.floor(visit / HARBOUR_BOTS.length);
  const at = visit - block * HARBOUR_BOTS.length;
  const half = at < GROUP_SIZE ? 0 : 1;
  const order = rngFor(2, block, half).shuffle(Array.from({ length: GROUP_SIZE }, (_, index) => index));
  return HARBOUR_BOTS[half * GROUP_SIZE + order[at - half * GROUP_SIZE]];
}

/** When, inside its slot, each visit arrives and each leaving visit goes, in ms from the slot's start. */
export interface SlotEvents {
  readonly arrives: number;
  /** By visit, for the visits that leave in this slot. */
  readonly leaves: ReadonlyMap<number, number>;
}

/** The arrival and departures of one slot, ordered so the count never leaves its bounds. */
export function slotEvents(slot: number): SlotEvents {
  const roll = rngFor(3, slot);
  const before = presentWidth(slot - 1);
  const leaving: number[] = [];
  for (let visit = firstIn(slot - 1); visit < firstIn(slot); visit += 1) {
    leaving.push(visit);
  }
  // At most as many may go before the arrival as leave the floor standing,
  // and at least one must if the yard is full.
  const most = Math.min(leaving.length, before - BOTS_MIN_PRESENT);
  const least = before >= BOTS_MAX_PRESENT ? 1 : 0;
  const early = Math.max(least, Math.min(most, roll.int(0, most)));
  const arrives = Math.round(BOT_SLOT_MS * (0.3 + roll.next() * 0.3));
  const leaves = new Map<number, number>();
  leaving.forEach((visit, index) => {
    const span = index < early ? [0.04, 0.26] : [0.64, 0.96];
    const count = index < early ? early : leaving.length - early;
    const place = index < early ? index : index - early;
    const width = (span[1] - span[0]) / Math.max(1, count);
    leaves.set(visit, Math.round(BOT_SLOT_MS * (span[0] + width * place + roll.next() * width * 0.8)));
  });
  return { arrives, leaves };
}

/** When a visit begins and ends, in clock ms. */
export function visitSpan(visit: number): { readonly from: number; readonly to: number } {
  const from = visit * BOT_SLOT_MS + slotEvents(visit).arrives;
  let slot = visit;
  while (firstIn(slot) <= visit) {
    slot += 1;
  }
  return { from, to: slot * BOT_SLOT_MS + slotEvents(slot).leaves.get(visit)! };
}

/** The visits in the harbour at a moment of the clock. */
export function visitsAt(nowMs: number): readonly number[] {
  const slot = Math.floor(nowMs / BOT_SLOT_MS);
  const present: number[] = [];
  for (let visit = slot - BOTS_MAX_PRESENT - 1; visit <= slot; visit += 1) {
    const span = visitSpan(visit);
    if (span.from <= nowMs && nowMs < span.to) {
      present.push(visit);
    }
  }
  return present;
}

// -- the ground ---------------------------------------------------------------

const key = (tile: GridPosition): string => `${tile.x},${tile.y}`;
const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

/** A way in or out: where a regular appears or goes, and the tile they step onto or off. */
export interface BotGate {
  readonly id: string;
  /** Where they stand the moment they appear, and the last tile they stand on going. */
  readonly tile: GridPosition;
}

/**
 * The ways a regular comes and goes: over the side of a boat - the jetty tile
 * beside the Seagallop's stern, the pier tile beside the S.S. Anne's bow - and
 * through the door of every building the whole harbour shares; the Raid
 * Arena's is somebody off on a raid. Never THE BOLTHOLE's: that door is each
 * player's own home, and a stranger coming out of it would be a stranger in
 * their house.
 */
export const BOT_GATES: readonly BotGate[] = [
  { id: 'seagallop', tile: { x: 11, y: 21 } },
  { id: 'ss-anne', tile: { x: 30, y: 26 } },
  ...BASE_DOORS.filter((door) => door.id !== 'bolthole').map((door) => ({ id: door.id, tile: door.tiles[0] })),
];

interface BotGround {
  readonly width: number;
  readonly height: number;
  /** Whether a regular may walk a tile. */
  readonly walks: readonly (readonly boolean[])[];
  readonly spots: readonly GridPosition[];
}

/** How far, in tiles either way, a loiter spot keeps from a doorway, the spawn and the landing. */
export const LOITER_CLEAR_OF_DOORS = 2;

/** How far apart two loiter spots are, so two regulars pausing are never shoulder to shoulder. */
const LOITER_SPACING = 2;

let ground: BotGround | null = null;

/**
 * Where regulars may walk and pause: ground that is walkable however much of
 * Brock's ladder a player has built, so every browser plans the same walks;
 * never anybody's beat tile, a doorway (but their own way in or out), the
 * spawn or the landing. The spots are the generated `LOITER_SPOTS`, which
 * `searchLoiterSpots` finds and `harbourBots.test.ts` holds to it.
 */
export function botGround(): BotGround {
  if (ground) {
    return ground;
  }
  const { width, height, walks } = walkableGround();
  ground = { width, height, walks, spots: LOITER_SPOTS.map(([x, y]) => ({ x, y })) };
  return ground;
}

function walkableGround() {
  const bare = getBaseMap([]);
  const built = getBaseMap(WORKSHOP_UPGRADES.map((upgrade) => upgrade.id));
  const kept = new Set<string>([
    ...['day', 'night'].flatMap((hour) =>
      harbourLifeAt(hour as 'day' | 'night')
        .filter(onLand)
        .flatMap((figure) => harbourBeatTiles(figure).map(key)),
    ),
    key(DAY_CARE_KEEPER.position),
    key(BASE_SPAWN),
    key(BASE_LANDING),
    ...BASE_DOORS.flatMap((door) => door.tiles.map(key)),
  ]);
  const walks = bare.collision.map((row, y) =>
    row.map((solid, x) => !solid && built.collision[y][x] === false && !kept.has(key({ x, y }))),
  );
  return { width: bare.width, height: bare.height, walks, bare, built, kept };
}

/**
 * Finds the loiter spots: open ground the jetty reaches, out from under any
 * roof or crown, and nowhere a player would mind somebody standing. Slow -
 * it asks every yard walk again for every candidate - so it is run by
 * `tools/base/botSpots.mts`, which writes `generated/harbourBotSpots.ts`.
 */
export function searchLoiterSpots(): GridPosition[] {
  const { walks, bare, built, kept } = walkableGround();
  const open = (x: number, y: number): boolean => walks[y]?.[x] === true;
  // Reached from the jetty: the day-care pen is grass nobody can get into.
  const reached = new Set<string>();
  const start = BOT_GATES[0].tile;
  let frontier: GridPosition[] = [start];
  reached.add(key(start));
  while (frontier.length > 0) {
    const next: GridPosition[] = [];
    for (const tile of frontier) {
      for (const [dx, dy] of NEIGHBOURS) {
        const step = { x: tile.x + dx, y: tile.y + dy };
        if (open(step.x, step.y) && !reached.has(key(step))) {
          reached.add(key(step));
          next.push(step);
        }
      }
    }
    frontier = next;
  }
  const away = [
    ...BASE_DOORS.flatMap((door) => [...door.tiles, door.returnTo]),
    BASE_SPAWN,
    BASE_LANDING,
    BOT_GATES[0].tile,
  ];
  const faced = new Set<string>([
    ...kept,
    ...BASE_SIGNS.map(key),
    ...BASE_FIXTURES.map((fixture) => key(fixture.at)),
    ...HARBOUR_LANDMARKS.flatMap((landmark) => [landmark.at, ...(landmark.near ?? [])].map(key)),
  ]);
  const spots: GridPosition[] = [];
  const bareWalks = walkChecker(bare.collision);
  const builtWalks = walkChecker(built.collision);
  for (let y = 0; y < bare.height; y += 1) {
    for (let x = 0; x < bare.width; x += 1) {
      if (!reached.has(key({ x, y })) || (bare.layers.canopy.tiles[y]?.[x] ?? -1) >= 0) {
        continue;
      }
      // Never in a lane (three ways out at least), and never beside anything
      // a player walks up to: a sign, a fixture, a landmark, somebody's beat,
      // the sea they fish in.
      const sides = NEIGHBOURS.map(([dx, dy]) => ({ x: x + dx, y: y + dy }));
      if (sides.filter((side) => open(side.x, side.y)).length < 3) continue;
      if (sides.some((side) => faced.has(key(side)) || bare.terrain[side.y]?.[side.x] === 'water')) continue;
      if (away.some((tile) => Math.max(Math.abs(tile.x - x), Math.abs(tile.y - y)) <= LOITER_CLEAR_OF_DOORS)) continue;
      if (spots.some((spot) => Math.max(Math.abs(spot.x - x), Math.abs(spot.y - y)) < LOITER_SPACING)) continue;
      // And never where a player's walk would be longer round them, even
      // with every spot taken at once.
      const taken = new Set([...spots, { x, y }].map((spot) => spot.y * bare.width + spot.x));
      if (bareWalks(taken) || builtWalks(taken)) continue;
      spots.push({ x, y });
    }
  }
  return spots;
}

/** The places a player walks between in the yard: the spawn, the landing, and every door and its step. */
export const YARD_PLACES: readonly GridPosition[] = [
  BASE_SPAWN,
  BASE_LANDING,
  ...BASE_DOORS.flatMap((door) => [door.returnTo, ...door.tiles]),
];

/**
 * Asks whether a player's walk between two yard places is longer with tiles
 * stood on, for one collision grid. Asked of a hundred-odd candidate spots
 * once a page, so it walks flat arrays rather than `stepsFrom`'s rows.
 */
function walkChecker(collision: readonly (readonly boolean[])[]): (taken: ReadonlySet<number>) => boolean {
  const height = collision.length;
  const width = collision[0]?.length ?? 0;
  const solid = new Uint8Array(width * height);
  collision.forEach((row, y) => row.forEach((wall, x) => (solid[y * width + x] = wall ? 1 : 0)));
  const queue = new Int32Array(width * height);
  const places = YARD_PLACES.map((tile) => tile.y * width + tile.x);
  const walk = (from: number, taken: ReadonlySet<number> | null): Int32Array => {
    const steps = new Int32Array(width * height).fill(-1);
    steps[from] = 0;
    let head = 0;
    let tail = 0;
    queue[tail++] = from;
    while (head < tail) {
      const at = queue[head++];
      const x = at % width;
      for (const next of [at - width, at + width, x > 0 ? at - 1 : -1, x < width - 1 ? at + 1 : -1]) {
        if (next < 0 || next >= steps.length || steps[next] >= 0 || solid[next] || taken?.has(next)) continue;
        steps[next] = steps[at] + 1;
        queue[tail++] = next;
      }
    }
    return steps;
  };
  const open = places.map((from) => walk(from, null));
  return (taken) =>
    places.some((from, index) => {
      const crowded = walk(from, taken);
      return places.some((to) => crowded[to] !== open[index][to]);
    });
}

/** A tile's place in a flat array of the yard. */
export const tileIndex = (tile: GridPosition): number => tile.y * botGround().width + tile.x;

/** Filled by `botPath`, a call at a time: a plan asks for many, and a page plans many at once. */
let cameFrom: Int32Array | null = null;
let queue: Int32Array | null = null;

/**
 * The shortest walk between two tiles over the regulars' ground, a way in or
 * out allowed at either end, going round any tile `avoid` marks.
 */
export function botPath(from: GridPosition, to: GridPosition, avoid: Uint8Array | null = null): GridPosition[] | null {
  const { walks, width, height } = botGround();
  const cells = width * height;
  cameFrom ??= new Int32Array(cells);
  queue ??= new Int32Array(cells);
  const trail = cameFrom;
  const line = queue;
  trail.fill(-1);
  const start = from.y * width + from.x;
  const goal = to.y * width + to.x;
  trail[start] = start;
  let head = 0;
  let tail = 0;
  line[tail++] = start;
  while (head < tail && trail[goal] < 0) {
    const at = line[head++];
    const x = at % width;
    const y = (at - x) / width;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const step = ny * width + nx;
      if (trail[step] >= 0 || (step !== goal && (!walks[ny][nx] || avoid?.[step]))) continue;
      trail[step] = at;
      line[tail++] = step;
    }
  }
  if (trail[goal] < 0) {
    return null;
  }
  const path: GridPosition[] = [];
  for (let at = goal; ; at = trail[at]) {
    path.unshift({ x: at % width, y: Math.floor(at / width) });
    if (at === start) break;
  }
  return path;
}

// -- the keepers' rooms --------------------------------------------------------

export type SharedRoomId = (typeof SHARED_HARBOUR_ROOMS)[number];

/** Where a regular stands in a room, and which way they look: at a shelf, a table, a plant. */
export interface RoomSpot {
  readonly tile: GridPosition;
  readonly facing: Direction;
}

/**
 * Where a regular calling on a keeper stands about while they are in: never
 * the mat, never where the keeper is spoken to, never beside anything a
 * player walks up to, and never where a walk across the room would be longer
 * round them (`harbourBots.test.ts`, with every rung of Brock's ladder built
 * and none).
 */
export const ROOM_CALLS: readonly { readonly room: SharedRoomId; readonly spots: readonly RoomSpot[] }[] = [
  {
    room: 'oaks-lab',
    spots: [
      { tile: { x: 11, y: 3 }, facing: 'up' },
      { tile: { x: 3, y: 10 }, facing: 'up' },
      { tile: { x: 9, y: 10 }, facing: 'up' },
    ],
  },
  {
    room: 'pokemon-centre',
    spots: [
      { tile: { x: 10, y: 6 }, facing: 'right' },
      { tile: { x: 12, y: 4 }, facing: 'up' },
    ],
  },
  {
    room: 'brocks-workshop',
    spots: [
      { tile: { x: 9, y: 3 }, facing: 'right' },
      { tile: { x: 4, y: 10 }, facing: 'up' },
    ],
  },
  {
    room: 'bills-cottage',
    spots: [
      { tile: { x: 2, y: 11 }, facing: 'left' },
      { tile: { x: 12, y: 11 }, facing: 'right' },
    ],
  },
  {
    // Going through the rails.
    room: 'boutique',
    spots: [
      { tile: { x: 6, y: 5 }, facing: 'right' },
      { tile: { x: 6, y: 6 }, facing: 'right' },
    ],
  },
];

/** How long a room is one regular's to call in (`roomCaller`). */
export const ROOM_WINDOW_MS = 90_000;

/** The shortest call worth going in for, and the longest. */
export const CALL_MS = [25_000, 60_000] as const;

/** How many windows' callers are remembered: a window is asked about every frame somebody plans in it. */
const callers = new Map<number, readonly number[]>();

/** The regulars in for all of a window, in the order that window offers them a room, so no two rooms offer one person. */
function callersIn(window: number): readonly number[] {
  const known = callers.get(window);
  if (known) {
    return known;
  }
  const opens = window * ROOM_WINDOW_MS;
  const closes = opens + ROOM_WINDOW_MS;
  const firstVisit = Math.floor(opens / BOT_SLOT_MS) - BOTS_MAX_PRESENT - 1;
  const here: number[] = [];
  for (let visit = firstVisit; visit <= Math.floor(closes / BOT_SLOT_MS); visit += 1) {
    const { from, to } = visitSpan(visit);
    // Time to walk to the door, and time after the call to go.
    if (from + CALL_MARGIN_MS <= closes && to - CALL_MARGIN_MS >= opens) {
      here.push(visit);
    }
  }
  const order = rngFor(8, window).shuffle(here);
  callers.set(window, order);
  if (callers.size > 200) {
    callers.delete(callers.keys().next().value as number);
  }
  return order;
}

/** How far inside a visit a call has to fall. */
const CALL_MARGIN_MS = 45_000;

/**
 * Who may call on a room in a window, if anybody: at most two of the five
 * rooms take a caller a window, turn about, each someone different - so no two
 * regulars are ever in one room, and never more than two are indoors at once.
 * Whoever is in at the time, so a call is a thing a good few visits make.
 */
export function roomCaller(roomIndex: number, window: number): HarbourBot | null {
  if ((((roomIndex + window) % 3) + 3) % 3 !== 0 || !rngFor(9, window, roomIndex).chance(0.7)) {
    return null;
  }
  const visit = callersIn(window)[roomIndex];
  return visit === undefined ? null : visitBot(visit);
}

/**
 * The fewest regulars about at any moment between two times. A regular calls
 * on a keeper only while at least `CALL_WHILE_AT_LEAST` are about, so with
 * two indoors at most, the yard always keeps `BOTS_MIN_PRESENT`.
 */
export function fewestPresent(from: number, to: number): number {
  const changes: { at: number; change: number }[] = [];
  let present = 0;
  const firstSlot = Math.floor(from / BOT_SLOT_MS) - BOTS_MAX_PRESENT - 1;
  for (let visit = firstSlot; visit <= Math.floor(to / BOT_SLOT_MS); visit += 1) {
    const span = visitSpan(visit);
    if (span.to <= from || span.from >= to) continue;
    if (span.from <= from) {
      present += 1;
    } else {
      changes.push({ at: span.from, change: 1 });
    }
    if (span.to < to) {
      changes.push({ at: span.to, change: -1 });
    }
  }
  let fewest = present;
  for (const { change } of changes.sort((a, b) => a.at - b.at || a.change - b.change)) {
    present += change;
    fewest = Math.min(fewest, present);
  }
  return fewest;
}

/** How many must be about for one to go indoors: the yard's floor and the two rooms that may be taken. */
export const CALL_WHILE_AT_LEAST = BOTS_MIN_PRESENT + 2;
