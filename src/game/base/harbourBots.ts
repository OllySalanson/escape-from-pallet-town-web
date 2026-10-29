import type { Direction, GridPosition } from '../movement/gridMovement';
import { STEP_DURATION_MS } from '../movement/stepClock';
import { createSeededRng, type SeededRng } from '../run/rng';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import { BASE_LANDING, BASE_SIGNS, BASE_SPAWN, getBaseMap } from './baseMap';
import { BASE_FIXTURES } from './fixtures';
import { HARBOUR_LANDMARKS } from './landmarks';
import { LOITER_SPOTS } from './generated/harbourBotSpots';
import { DAY_CARE_KEEPER } from './dayCarePen';
import { BASE_DOORS, doorNamed } from './doors';
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
 * **Where they walk.** Each visit comes in somewhere a player would - off the
 * Seagallop at the jetty or out of one of the buildings - pauses at a few
 * `LOITER_SPOTS`, and leaves the same ways, timed to be gone at the moment
 * the schedule says (`visitPlan`). A loiter spot is open ground with nothing
 * solid round it and nothing a player comes to the yard for near it, so a
 * regular is never standing in a lane, a doorway, on a mat, on the spawn, by a
 * sign or by somebody the player wants to talk to - and the walks between
 * them keep off the doorways, the spawn and the landing too. Regulars are not
 * collision, as players are not, so even passing they block nothing.
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
  /** What they say when spoken to, one line a time they are spoken to. */
  readonly lines: readonly string[];
}

export const HARBOUR_BOTS: readonly HarbourBot[] = [
  {
    id: 'bot:marla',
    name: 'MARLA',
    partner: 'bulbasaur',
    look: { head: 'lass-hair', top: 'plain-tee', legs: 'plain-trousers', body: 'sundress' },
    lines: [
      'Oh, hi! Just back off the SEAGALLOP. GREYSTONE VALE was all fog today.',
      'NURSE JOY patched us up again. BULBASAUR keeps eating the window boxes.',
    ],
  },
  {
    id: 'bot:finn',
    name: 'FINN',
    partner: 'charmander',
    look: { head: 'youngster-cap-red', top: 'casual-jacket', legs: 'cargo-trousers', body: null },
    lines: [
      'Hey! Seen the hunter tonight? Check the telly in your house before you go.',
      'CHARMANDER and me found a RANGER PACK last raid. Lost it the raid after!',
    ],
  },
  {
    id: 'bot:tess',
    name: 'TESS',
    partner: 'squirtle',
    look: { head: 'swimmer-tail', top: 'plain-tee', legs: 'plain-trousers', body: 'swimsuit' },
    lines: [
      'Hi there! SQUIRTLE wants to swim out to the S.S. ANNE. I keep saying no.',
      'Pack POTIONS. Then pack more POTIONS. That\'s what the GYM GUIDE says!',
    ],
  },
  {
    id: 'bot:oskar',
    name: 'OSKAR',
    partner: 'ivysaur',
    look: { head: 'hiker-hat', top: 'plain-tee', legs: 'plain-trousers', body: 'hiker-gear' },
    lines: [
      'Hello! My IVYSAUR evolved on the last raid. Took me right by surprise!',
      'BROCK\'s workshop gets bigger every time I look. What\'s he building in there?',
    ],
  },
  {
    id: 'bot:juno',
    name: 'JUNO',
    partner: 'wartortle',
    look: { head: 'ace-tail', top: 'plain-tee', legs: 'plain-trousers', body: 'ace-suit' },
    lines: [
      'Hiya! The ANGLER on the cove lent me his rod. Caught nothing but MAGIKARP.',
      'WARTORTLE likes the breakwater. Says the waves are the right size.',
    ],
  },
  {
    id: 'bot:kit',
    name: 'KIT',
    partner: 'charmeleon',
    look: { head: 'rocker-quiff', top: 'rocker-jacket', legs: 'denim-jeans', body: null },
    lines: [
      'Yo! Got out of the VALE with ten seconds on the clock. Never again!',
      'CHARMELEON wants a rematch with the hunter. I want a nap.',
    ],
  },
  {
    id: 'bot:rowan',
    name: 'ROWAN',
    partner: 'squirtle',
    look: { head: 'fisher-cap', top: 'fishing-vest', legs: 'sky-trousers', body: null },
    lines: [
      'Hi! Have you read the notice board on the quay? There\'s a new notice every day.',
      'PROF. OAK says every new kind in your Pokédex gets you closer to a reward.',
    ],
  },
  {
    id: 'bot:bea',
    name: 'BEA',
    partner: 'bulbasaur',
    look: { head: 'picnicker-hat', top: 'plain-tee', legs: 'plain-trousers', body: 'picnic-dungarees' },
    lines: [
      'Hi! My best Pokémon always rides home in the secure container. Learned the hard way.',
      'BULBASAUR naps on the green while I talk to BILL. Every single time.',
    ],
  },
  {
    id: 'bot:ivo',
    name: 'IVO',
    partner: 'charmander',
    look: { head: 'bowl-cut', top: 'office-shirt', legs: 'smart-shorts', body: null },
    lines: [
      'Hey there! Just doing one more raid. Then bed. Probably.',
      'If the hunter catches you, you can run. It costs you clock, though!',
    ],
  },
  {
    id: 'bot:nell',
    name: 'NELL',
    partner: 'venusaur',
    look: { head: 'golden-waves', top: 'plain-tee', legs: 'plain-trousers', body: 'long-skirt' },
    lines: [
      'Oh, hello! VENUSAUR and I have been coming here since the harbour was a jetty.',
      'The S.S. ANNE\'s CAPTAIN will lend you his spyglass if you ask nicely.',
    ],
  },
  {
    id: 'bot:arlo',
    name: 'ARLO',
    partner: 'blastoise',
    look: { head: 'sailor-cap', top: 'plain-tee', legs: 'plain-trousers', body: 'sailor-whites' },
    lines: [
      'Hey! BLASTOISE scared the PIDGEY off the green again. Sorry, PIDGEY.',
      'Wave at people! Half the harbour waves back.',
    ],
  },
  {
    id: 'bot:skye',
    name: 'SKYE',
    partner: 'charizard',
    look: { head: 'ace-wave', top: 'ace-jacket', legs: 'ace-trousers', body: null },
    lines: [
      'Hi! CHARIZARD wants to fly us home, but the SEAGALLOP is faster with a full pack.',
      'Find anything good out there? I found a whole lot of nothing.',
    ],
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

function rngFor(...parts: readonly number[]): SeededRng {
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
 * The ways a regular comes and goes: off the Seagallop at the jetty's foot,
 * and out of (or into) every building in the yard - the Raid Arena's door is
 * somebody off on a raid.
 */
export const BOT_GATES: readonly BotGate[] = [
  { id: 'seagallop', tile: { x: 12, y: 21 } },
  ...BASE_DOORS.map((door) => ({ id: door.id, tile: door.tiles[0] })),
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

/** The loiter spots a regular uses: their own share, so no two regulars ever pause on one tile. */
export function spotsOf(bot: HarbourBot): readonly GridPosition[] {
  const index = HARBOUR_BOTS.indexOf(bot);
  return botGround().spots.filter((_, at) => at % HARBOUR_BOTS.length === index);
}

/** The shortest walk between two tiles over the regulars' ground, a gate allowed at either end. */
export function botPath(from: GridPosition, to: GridPosition): GridPosition[] | null {
  const { walks, width, height } = botGround();
  const can = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height && (walks[y][x] || (x === to.x && y === to.y));
  const cameFrom = new Map<string, GridPosition | null>([[key(from), null]]);
  let frontier: GridPosition[] = [from];
  while (frontier.length > 0 && !cameFrom.has(key(to))) {
    const next: GridPosition[] = [];
    for (const tile of frontier) {
      for (const [dx, dy] of NEIGHBOURS) {
        const step = { x: tile.x + dx, y: tile.y + dy };
        if (can(step.x, step.y) && !cameFrom.has(key(step))) {
          cameFrom.set(key(step), tile);
          next.push(step);
        }
      }
    }
    frontier = next;
  }
  if (!cameFrom.has(key(to))) {
    return null;
  }
  const path: GridPosition[] = [];
  for (let at: GridPosition | null = to; at; at = cameFrom.get(key(at)) ?? null) {
    path.unshift(at);
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
];

/** How long a room is one regular's to call in (`roomCaller`). */
export const ROOM_WINDOW_MS = 90_000;

/** The shortest call worth going in for, and the longest. */
const CALL_MS = [25_000, 60_000] as const;

/**
 * Who may call on a room in a window, if anybody: two of the four rooms take
 * a caller a window, turn about, each someone different - so no two regulars
 * are ever in one room, and never more than two are indoors at once.
 */
export function roomCaller(roomIndex: number, window: number): HarbourBot | null {
  if ((roomIndex + window) % 2 !== 0) {
    return null;
  }
  const count = HARBOUR_BOTS.length;
  return HARBOUR_BOTS[(((window * 5 + roomIndex * 3) % count) + count) % count];
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

// -- a visit ------------------------------------------------------------------

/** One part of a visit: a walk along tiles a step every `STEP_DURATION_MS`, or a pause looking about. */
export type VisitLeg =
  | { readonly kind: 'walk'; readonly from: number; readonly path: readonly GridPosition[] }
  | {
      readonly kind: 'pause';
      readonly from: number;
      readonly to: number;
      readonly tile: GridPosition;
      /** Which way they look, and from when. */
      readonly looks: readonly { readonly at: number; readonly facing: Direction }[];
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
    };

export interface VisitPlan {
  readonly visit: number;
  readonly bot: HarbourBot;
  readonly from: number;
  readonly to: number;
  readonly enter: BotGate;
  readonly leave: BotGate;
  readonly legs: readonly VisitLeg[];
}

/** The shortest pause worth stopping for, and the longest. */
const PAUSE_MS = [3_000, 14_000] as const;

const FACINGS: readonly Direction[] = ['up', 'down', 'left', 'right'];

function directionOf(from: GridPosition, to: GridPosition): Direction {
  if (to.x > from.x) return 'right';
  if (to.x < from.x) return 'left';
  return to.y > from.y ? 'down' : 'up';
}

const walkMs = (path: readonly GridPosition[]): number => (path.length - 1) * STEP_DURATION_MS;

const plans = new Map<number, VisitPlan>();

/**
 * Everything one visit does, from the tile they appear on to the tile they go
 * from: walk to a loiter spot of their own, look about a while, walk on - as
 * long as the walk out still fits before the schedule says they are gone.
 */
export function visitPlan(visit: number): VisitPlan {
  const cached = plans.get(visit);
  if (cached) {
    return cached;
  }
  const bot = visitBot(visit);
  const { from, to } = visitSpan(visit);
  const roll = rngFor(4, visit);
  const enter = roll.pick(BOT_GATES);
  const leave = roll.pick(BOT_GATES);
  const spots = spotsOf(bot);
  const legs: VisitLeg[] = [];
  let at = enter.tile;
  let now = from;
  let last: GridPosition | null = null;
  const pauseAt = (spot: GridPosition, there: readonly GridPosition[], pause: number): void => {
    const looks: { at: number; facing: Direction }[] = [
      { at: now, facing: there.length > 1 ? directionOf(there[there.length - 2], spot) : roll.pick(FACINGS) },
    ];
    for (let look = now + roll.int(1_500, 4_000); look < now + pause - 800; look += roll.int(1_500, 4_000)) {
      looks.push({ at: look, facing: roll.pick(FACINGS) });
    }
    legs.push({ kind: 'pause', from: now, to: now + pause, tile: spot, looks });
    now += pause;
    at = spot;
    last = spot;
  };
  let called = false;
  for (let tries = 0; tries < 12; tries += 1) {
    // From a spot of their own, now and then, in through a keeper's door.
    if (!called && last !== null && roll.chance(0.7)) {
      const call = callIn(bot, at, now, to, leave, roll);
      if (call) {
        called = true;
        if (call.wait > 0) {
          const standing = legs[legs.length - 1];
          if (standing.kind === 'pause') {
            legs[legs.length - 1] = { ...standing, to: standing.to + call.wait };
          }
          now += call.wait;
        }
        legs.push({ kind: 'walk', from: now, path: call.there });
        now += walkMs(call.there);
        legs.push({ kind: 'inside', from: now, to: call.out, room: call.room, door: call.door, spot: call.spot });
        now = call.out;
        at = call.door;
        // And out again to somewhere of their own, never standing in the doorway.
        legs.push({ kind: 'walk', from: now, path: call.after });
        now += walkMs(call.after);
        pauseAt(call.after[call.after.length - 1], call.after, PAUSE_MS[0]);
        continue;
      }
    }
    const choices = spots.filter((spot) => !last || spot.x !== last.x || spot.y !== last.y);
    const spot = roll.pick(choices);
    const there = botPath(at, spot);
    const out = botPath(spot, leave.tile);
    if (!there || !out) continue;
    const pause = roll.int(PAUSE_MS[0], PAUSE_MS[1]);
    if (now + walkMs(there) + pause + walkMs(out) > to) {
      continue;
    }
    legs.push({ kind: 'walk', from: now, path: there });
    now += walkMs(there);
    pauseAt(spot, there, pause);
  }
  let gone = leave;
  if (legs.length === 0) {
    // Too short a visit for a pause anywhere of their own choosing: the spot
    // nearest the way in, for whatever time there is - out the way they came
    // if the other way out is too far. Never a pause on a doorway.
    const fits = [leave, enter].flatMap((way) =>
      spots.flatMap((spot) => {
        const there = botPath(enter.tile, spot);
        const out = botPath(spot, way.tile);
        return there && out && from + walkMs(there) + walkMs(out) <= to ? [{ way, spot, there, cost: walkMs(there) + walkMs(out) }] : [];
      }),
    );
    const best = fits.sort((a, b) => a.cost - b.cost)[0];
    if (best) {
      gone = best.way;
      legs.push({ kind: 'walk', from: now, path: best.there });
      now += walkMs(best.there);
      at = best.spot;
    }
  }
  // Out, timed to be on the way-out tile as the schedule says they go.
  const out = botPath(at, gone.tile) ?? [at];
  const leaveAt = Math.max(now, to - walkMs(out));
  if (leaveAt > now) {
    legs.push({ kind: 'pause', from: now, to: leaveAt, tile: at, looks: [{ at: now, facing: legs.length > 0 ? lastFacing(legs) : 'down' }] });
  }
  legs.push({ kind: 'walk', from: leaveAt, path: out });
  const plan: VisitPlan = { visit, bot, from, to, enter, leave: gone, legs };
  plans.set(visit, plan);
  // Visits long gone are not asked about again.
  for (const old of plans.keys()) {
    if (old < visit - 40) plans.delete(old);
  }
  return plan;
}

/**
 * A call on a keeper from where a regular is standing, if one fits: a room
 * that is theirs to call in for a window starting about now, the walk to its
 * door, a call of `CALL_MS` inside the window, and time after it to walk to a
 * spot of their own, pause, and still be out when the schedule says.
 */
function callIn(
  bot: HarbourBot,
  at: GridPosition,
  now: number,
  to: number,
  leave: BotGate,
  roll: SeededRng,
): {
  readonly room: SharedRoomId;
  readonly door: GridPosition;
  readonly spot: RoomSpot;
  readonly wait: number;
  readonly there: readonly GridPosition[];
  readonly out: number;
  readonly after: readonly GridPosition[];
} | null {
  for (const roomIndex of roll.shuffle(ROOM_CALLS.map((_, index) => index))) {
    const call = ROOM_CALLS[roomIndex];
    const door = doorNamed(call.room)?.tiles[0];
    const there = door ? botPath(at, door) : null;
    if (!door || !there) continue;
    const arrival = now + walkMs(there);
    for (const window of [Math.floor(arrival / ROOM_WINDOW_MS), Math.floor(arrival / ROOM_WINDOW_MS) + 1]) {
      if (roomCaller(roomIndex, window) !== bot) continue;
      const opens = window * ROOM_WINDOW_MS;
      const inside = Math.max(arrival, opens);
      const wait = inside - arrival;
      const longest = Math.min(CALL_MS[1], opens + ROOM_WINDOW_MS - 3_000 - inside);
      if (wait > 12_000 || longest < CALL_MS[0]) continue;
      const out = inside + roll.int(CALL_MS[0], longest);
      if (fewestPresent(inside, out) < CALL_WHILE_AT_LEAST) continue;
      const after = spotsOf(bot)
        .flatMap((spot) => {
          const walk = botPath(door, spot);
          const home = botPath(spot, leave.tile);
          return walk && home && out + walkMs(walk) + PAUSE_MS[0] + walkMs(home) <= to ? [walk] : [];
        })
        .sort((a, b) => a.length - b.length)[0];
      if (!after) continue;
      return { room: call.room, door, spot: roll.pick(call.spots), wait, there, out, after };
    }
  }
  return null;
}

function lastFacing(legs: readonly VisitLeg[]): Direction {
  const leg = legs[legs.length - 1];
  if (leg.kind === 'inside') {
    return 'down';
  }
  if (leg.kind === 'pause') {
    return leg.looks[leg.looks.length - 1].facing;
  }
  const { path } = leg;
  return path.length > 1 ? directionOf(path[path.length - 2], path[path.length - 1]) : 'down';
}

/** Where a regular is at a moment, out in the yard - or, `inside`, calling on a keeper. */
export interface BotWhere {
  readonly tile: GridPosition;
  readonly next: GridPosition | null;
  readonly facing: Direction;
  readonly walking: boolean;
  readonly inside?: Extract<VisitLeg, { kind: 'inside' }>;
}

/**
 * Where a visit's regular is at a moment: the tile they are on (or have just
 * stepped onto, `next` while they are walking towards it) and which way they
 * face - or null before they arrive and once they have gone.
 */
export function botAt(
  plan: VisitPlan,
  nowMs: number,
): BotWhere | null {
  if (nowMs < plan.from || nowMs >= plan.to) {
    return null;
  }
  for (let index = plan.legs.length - 1; index >= 0; index -= 1) {
    const leg = plan.legs[index];
    if (leg.from > nowMs) continue;
    if (leg.kind === 'inside') {
      if (nowMs >= leg.to) continue;
      return { tile: leg.door, next: null, facing: 'up', walking: false, inside: leg };
    }
    if (leg.kind === 'pause') {
      if (nowMs >= leg.to) continue;
      const look = [...leg.looks].reverse().find((each) => each.at <= nowMs) ?? leg.looks[0];
      return { tile: leg.tile, next: null, facing: look.facing, walking: false };
    }
    const step = Math.min(leg.path.length - 1, Math.floor((nowMs - leg.from) / STEP_DURATION_MS));
    const tile = leg.path[step];
    const next = leg.path[step + 1] ?? null;
    const facing = next ? directionOf(tile, next) : step > 0 ? directionOf(leg.path[step - 1], tile) : 'down';
    return { tile, next, facing, walking: next !== null };
  }
  return null;
}
