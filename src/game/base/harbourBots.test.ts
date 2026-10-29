import { describe, expect, it } from 'vitest';
import type { GridPosition } from '../movement/gridMovement';
import { STEP_DURATION_MS } from '../movement/stepClock';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import { BASE_LANDING, BASE_SPAWN, getBaseMap } from './baseMap';
import { stepsFrom } from './baseWalks';
import { BASE_DOORS } from './doors';
import { isPartnerSpecies } from './partner';
import {
  BOTS_MAX_PRESENT,
  BOTS_MIN_PRESENT,
  BOT_GATES,
  BOT_SLOT_MS,
  HARBOUR_BOTS,
  LOITER_CLEAR_OF_DOORS,
  botAt,
  botGround,
  presentWidth,
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
      // The console's name rule (`console/playerName.ts`): capitals, ten at most.
      expect(bot.name).toMatch(/^[A-Z0-9.!?'-]{1,10}$/);
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
        if (!at.walking) {
          expect(still.has(key(at.tile))).toBe(false);
        }
      }
      expect(botAt(plan, plan.to)).toBeNull();
      expect(botAt(plan, plan.from - 1)).toBeNull();
    }
  });
});
