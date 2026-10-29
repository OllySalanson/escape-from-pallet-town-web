import { lookKey, readLook } from '../look/look';
import { describe, expect, it } from 'vitest';
import type { GridPosition } from '../movement/gridMovement';
import { STEP_DURATION_MS } from '../movement/stepClock';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import { BASE_LANDING, BASE_SPAWN, getBaseMap } from './baseMap';
import { servingTiles, stepsFrom } from './baseWalks';
import { baseGame } from './baseGames.testkit';
import { buildRoom, roomNamed } from './rooms';
import { BASE_DOORS } from './doors';
import { isPartnerSpecies } from './partner';
import { checkPlayerName } from '../console/playerName';
import {
  BOTS_MAX_PRESENT,
  BOTS_MIN_PRESENT,
  BOT_GATES,
  BOT_SLOT_MS,
  HARBOUR_BOTS,
  LOITER_CLEAR_OF_DOORS,
  botAt,
  botGround,
  ROOM_CALLS,
  ROOM_WINDOW_MS,
  presentWidth,
  roomCaller,
  searchLoiterSpots,
  spotsOf,
  visitPlan,
  visitSpan,
  visitsAt,
} from './harbourBots';

const key = (tile: GridPosition): string => `${tile.x},${tile.y}`;
/** A stretch of the real clock: about four days of slots, from tonight. */
const FIRST_SLOT = Math.floor(Date.UTC(2026, 9, 29) / BOT_SLOT_MS);
const SLOTS = 8_000;

describe('the harbour\'s regulars', () => {
  it('are twelve, each with a name a player could have, a partner and something to say', () => {
    expect(HARBOUR_BOTS).toHaveLength(12);
    expect(new Set(HARBOUR_BOTS.map((bot) => bot.name)).size).toBe(12);
    expect(new Set(HARBOUR_BOTS.map((bot) => bot.id)).size).toBe(12);
    for (const bot of HARBOUR_BOTS) {
      // The name rule every player is held to (`console/playerName.ts`), word filter and all.
      expect(checkPlayerName(bot.name)).toEqual({ ok: true, name: bot.name });
      expect(isPartnerSpecies(bot.partner)).toBe(true);
      expect(bot.lines.length).toBeGreaterThan(0);
      for (const line of bot.lines) {
        expect(line).not.toMatch(/[<>&"]/);
        expect(line.length).toBeLessThanOrEqual(90);
      }
      // Never an id a player could have, so nothing that lists players mistakes one.
      expect(bot.id.startsWith('bot:')).toBe(true);
    }
  });

  it('go by the kind of name players type for themselves, not a register of first names', () => {
    // The captain, 29 Oct: "names that are actually realistic of what people
    // would put. Not just like Ivo and Rowan" - so most carry a number, a mark
    // or a Pokémon, and no two are the same kind of plain word.
    const decorated = HARBOUR_BOTS.filter((bot) => /[0-9.!?'-]/.test(bot.name) || /BULBA|KARP|DEX|TOISE|ZARD/.test(bot.name));
    expect(decorated.length).toBeGreaterThanOrEqual(9);
  });

  it('come and go so that between two and six are about at every moment', () => {
    // Every arrival and departure over four days, swept in order.
    const events: { at: number; change: 1 | -1 }[] = [];
    for (let visit = FIRST_SLOT - 10; visit < FIRST_SLOT + SLOTS; visit += 1) {
      const { from, to } = visitSpan(visit);
      expect(to).toBeGreaterThan(from);
      events.push({ at: from, change: 1 }, { at: to, change: -1 });
    }
    events.sort((a, b) => a.at - b.at || a.change - b.change);
    let present = 0;
    const counts = new Map<number, number>();
    const start = (FIRST_SLOT + 1) * BOT_SLOT_MS;
    const end = (FIRST_SLOT + SLOTS - 10) * BOT_SLOT_MS;
    let last = start;
    for (const event of events) {
      if (event.at >= start && event.at < end) {
        expect(present).toBeGreaterThanOrEqual(BOTS_MIN_PRESENT);
        expect(present).toBeLessThanOrEqual(BOTS_MAX_PRESENT);
        counts.set(present, (counts.get(present) ?? 0) + event.at - last);
        last = event.at;
      }
      present += event.change;
    }
    // Every count from two to six turns up, and the yard is mostly lively.
    for (let count = BOTS_MIN_PRESENT; count <= BOTS_MAX_PRESENT; count += 1) {
      expect(counts.get(count) ?? 0).toBeGreaterThan(0);
    }
    const total = [...counts.values()].reduce((sum, ms) => sum + ms, 0);
    const mean = [...counts].reduce((sum, [count, ms]) => sum + count * ms, 0) / total;
    expect(mean).toBeGreaterThan(3);
    expect(mean).toBeLessThan(5);
  });

  it('never grow by more than the one arrival a slot brings', () => {
    for (let slot = FIRST_SLOT; slot < FIRST_SLOT + SLOTS; slot += 1) {
      const width = presentWidth(slot);
      expect(width).toBeGreaterThanOrEqual(BOTS_MIN_PRESENT);
      expect(width).toBeLessThanOrEqual(BOTS_MAX_PRESENT);
      expect(width).toBeLessThanOrEqual(presentWidth(slot - 1) + 1);
    }
  });

  it('are never two of the same person at once, and say so the same way when asked a moment', () => {
    for (let visit = FIRST_SLOT; visit < FIRST_SLOT + 400; visit += 1) {
      const moment = visitSpan(visit).from + 1;
      const here = visitsAt(moment);
      expect(here).toContain(visit);
      const names = here.map((each) => visitPlan(each).bot.name);
      expect(new Set(names).size).toBe(names.length);
      expect(here.length).toBeGreaterThanOrEqual(BOTS_MIN_PRESENT);
      expect(here.length).toBeLessThanOrEqual(BOTS_MAX_PRESENT);
    }
  });
});

describe('where the regulars stand', () => {
  const { spots, walks } = botGround();
  const doorTiles = new Set(BASE_DOORS.flatMap((door) => door.tiles.map(key)));
  const gateTiles = new Set(BOT_GATES.map((gate) => key(gate.tile)));
  const kept = [...BASE_DOORS.flatMap((door) => [...door.tiles, door.returnTo]), BASE_SPAWN, BASE_LANDING];

  it('are the spots the search finds today (re-run tools/base/botSpots.mts if not)', () => {
    expect(spots).toEqual(searchLoiterSpots());
  });

  it('pause only on open ground well away from every door, mat, the spawn and the landing', () => {
    expect(spots.length).toBeGreaterThanOrEqual(HARBOUR_BOTS.length * 4);
    for (const bot of HARBOUR_BOTS) {
      expect(spotsOf(bot).length).toBeGreaterThanOrEqual(3);
    }
    for (const spot of spots) {
      for (const tile of kept) {
        expect(Math.max(Math.abs(tile.x - spot.x), Math.abs(tile.y - spot.y))).toBeGreaterThan(LOITER_CLEAR_OF_DOORS);
      }
      // Never in a lane: three ways off it at least.
      const sides = [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ].filter(([dx, dy]) => walks[spot.y + dy][spot.x + dx]);
      expect(sides.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('lengthen nobody\'s walk even all stood at once on every spot they ever pause on', () => {
    for (const built of [[], WORKSHOP_UPGRADES.map((upgrade) => upgrade.id)]) {
      const map = getBaseMap(built);
      const solid = new Set(spots.map(key));
      const places = [BASE_SPAWN, BASE_LANDING, ...BASE_DOORS.map((door) => door.returnTo)];
      // Asked here of the whole yard's walks, not only the ones the spots were chosen against.
      for (const from of places) {
        const open = stepsFrom(map.collision, from);
        const crowded = stepsFrom(map.collision, from, (tile) => solid.has(key(tile)));
        for (const to of [...places, ...BASE_DOORS.flatMap((door) => door.tiles)]) {
          expect([from, to, crowded[to.y][to.x]]).toEqual([from, to, open[to.y][to.x]]);
        }
      }
    }
  });

  it('walk a step at a time over their own ground, pause only on their spots, and are gone on time', () => {
    for (let visit = FIRST_SLOT; visit < FIRST_SLOT + 600; visit += 1) {
      const plan = visitPlan(visit);
      const own = new Set(spotsOf(plan.bot).map(key));
      expect(plan.legs[0]).toMatchObject({ kind: 'walk', from: plan.from });
      expect(plan.legs[0].kind === 'walk' && plan.legs[0].path[0]).toEqual(plan.enter.tile);
      const last = plan.legs[plan.legs.length - 1];
      expect(last.kind).toBe('walk');
      if (last.kind === 'walk') {
        expect(last.path[last.path.length - 1]).toEqual(plan.leave.tile);
        expect(last.from + (last.path.length - 1) * STEP_DURATION_MS).toBe(plan.to);
      }
      let clock = plan.from;
      for (const leg of plan.legs) {
        expect(leg.from).toBe(clock);
        if (leg.kind === 'pause') {
          expect(own.has(key(leg.tile))).toBe(true);
          expect(doorTiles.has(key(leg.tile))).toBe(false);
          clock = leg.to;
          continue;
        }
        if (leg.kind === 'inside') {
          // In by their room's own door, inside one window that is theirs.
          expect(BASE_DOORS.find((door) => door.id === leg.room)?.tiles[0]).toEqual(leg.door);
          const window = Math.floor(leg.from / ROOM_WINDOW_MS);
          expect(Math.floor(leg.to / ROOM_WINDOW_MS)).toBe(window);
          expect(roomCaller(ROOM_CALLS.findIndex((call) => call.room === leg.room), window)).toBe(plan.bot);
          clock = leg.to;
          continue;
        }
        leg.path.forEach((tile, index) => {
          const ends = index === 0 || index === leg.path.length - 1;
          expect(walks[tile.y][tile.x] || (ends && gateTiles.has(key(tile)))).toBe(true);
          if (index > 0) {
            const before = leg.path[index - 1];
            expect(Math.abs(before.x - tile.x) + Math.abs(before.y - tile.y)).toBe(1);
          }
        });
        clock += (leg.path.length - 1) * STEP_DURATION_MS;
      }
      expect(clock).toBe(plan.to);
    }
  });

  it('never stand still on a doorway, the spawn or the landing at any moment', () => {
    const still = new Set([...doorTiles, key(BASE_SPAWN), key(BASE_LANDING)]);
    for (let visit = FIRST_SLOT; visit < FIRST_SLOT + 200; visit += 1) {
      const plan = visitPlan(visit);
      for (let now = plan.from; now < plan.to; now += 250) {
        const at = botAt(plan, now)!;
        expect(at).not.toBeNull();
        if (!at.walking && !at.inside) {
          expect(still.has(key(at.tile))).toBe(false);
        }
      }
      expect(botAt(plan, plan.to)).toBeNull();
      expect(botAt(plan, plan.from - 1)).toBeNull();
    }
  });
});

describe('regulars calling on the keepers', () => {
  const games = [baseGame(), baseGame({ built: WORKSHOP_UPGRADES.map((upgrade) => upgrade.id), hurt: 6, traded: 400 })];

  it('always leave at least two out in the yard', () => {
    const events: { at: number; change: number }[] = [];
    for (let visit = FIRST_SLOT - 10; visit < FIRST_SLOT + 2_000; visit += 1) {
      const plan = visitPlan(visit);
      events.push({ at: plan.from, change: 1 }, { at: plan.to, change: -1 });
      for (const leg of plan.legs) {
        if (leg.kind === 'inside') {
          events.push({ at: leg.from, change: -1 }, { at: leg.to, change: 1 });
        }
      }
    }
    events.sort((a, b) => a.at - b.at || a.change - b.change);
    let yard = 0;
    const start = (FIRST_SLOT + 1) * BOT_SLOT_MS;
    const end = (FIRST_SLOT + 1_990) * BOT_SLOT_MS;
    for (const event of events) {
      if (event.at >= start && event.at < end) {
        expect(yard).toBeGreaterThanOrEqual(BOTS_MIN_PRESENT);
      }
      yard += event.change;
    }
  });

  it('go in often, and never two at once in one room', () => {
    const calls = new Map<string, { from: number; to: number; bot: string }[]>();
    let visits = 0;
    let calling = 0;
    for (let visit = FIRST_SLOT; visit < FIRST_SLOT + 1_000; visit += 1) {
      visits += 1;
      const inside = visitPlan(visit).legs.filter((leg) => leg.kind === 'inside');
      calling += inside.length > 0 ? 1 : 0;
      for (const leg of inside) {
        calls.set(leg.room, [...(calls.get(leg.room) ?? []), { from: leg.from, to: leg.to, bot: visitPlan(visit).bot.id }]);
      }
    }
    expect(calling / visits).toBeGreaterThan(0.15);
    expect([...calls.keys()].sort()).toEqual(ROOM_CALLS.map((call) => call.room).sort());
    for (const list of calls.values()) {
      const sorted = [...list].sort((a, b) => a.from - b.from);
      sorted.slice(1).forEach((call, index) => expect(call.from).toBeGreaterThanOrEqual(sorted[index].to));
    }
  });

  it('stand where nobody is in the way, with every rung of Brock\'s ladder built and none', () => {
    for (const call of ROOM_CALLS) {
      const room = roomNamed(call.room)!;
      for (const game of games) {
        const built = buildRoom(room, game);
        const serving = servingTiles(room, built.collision).map(key);
        const faced = new Set([
          ...(room.mat ? [key(room.mat)] : []),
          ...(room.keeper ? [key(room.keeper.position)] : []),
          ...room.counter.map(key),
          ...built.things.flatMap((thing) => thing.tiles.map(key)),
        ]);
        const taken = new Set(call.spots.map((spot) => key(spot.tile)));
        for (const { tile } of call.spots) {
          expect([call.room, tile, built.collision[tile.y][tile.x]]).toEqual([call.room, tile, false]);
          expect(serving).not.toContain(key(tile));
          for (const [dx, dy] of [
            [0, -1],
            [0, 1],
            [-1, 0],
            [1, 0],
          ]) {
            expect([call.room, tile, faced.has(key({ x: tile.x + dx, y: tile.y + dy }))]).toEqual([call.room, tile, false]);
          }
        }
        // All of them stood at once, every other tile of the room is as far from the mat as it was.
        const open = stepsFrom(built.collision, room.mat!);
        const crowded = stepsFrom(built.collision, room.mat!, (tile) => taken.has(key(tile)));
        for (let y = 0; y < room.height; y += 1) {
          for (let x = 0; x < room.width; x += 1) {
            if (!taken.has(key({ x, y }))) {
              expect([call.room, x, y, crowded[y][x]]).toEqual([call.room, x, y, open[y][x]]);
            }
          }
        }
      }
    }
  });
});

describe('what the regulars wear', () => {
  it('dresses every regular from the boutique, each in a look of their own', () => {
    for (const bot of HARBOUR_BOTS) {
      // Only the boutique's own pieces, each in its slot: read as a stranger's look would be.
      expect([bot.id, readLook(bot.look)]).toEqual([bot.id, bot.look]);
    }
    expect(new Set(HARBOUR_BOTS.map((bot) => lookKey(bot.look))).size).toBe(HARBOUR_BOTS.length);
  });
});
