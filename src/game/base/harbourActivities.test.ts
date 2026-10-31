import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { PHRASE_SHOWN_MS, isHarbourPhraseId } from '../harbour/harbourPhrases';
import type { Direction, GridPosition } from '../movement/gridMovement';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import { BASE_LANDING, BASE_SIGNS, BASE_SPAWN, HOME_SIGN, getBaseMap } from './baseMap';
import { stepsFrom } from './baseWalks';
import { BASE_DOORS } from './doors';
import {
  CHAT_CIRCLES,
  CHAT_WINDOW_MS,
  HANG_OUTS,
  IN_STEP_MS,
  KNOCKED_DOORS,
  NOTICE_BOARDS,
  SEA_VIEWS,
  SHOP_WINDOWS,
  botAt,
  botSayingAt,
  chatInWindow,
  directionOf,
  forgetVisitPlans,
  visitPlan,
  type BotActivity,
  type VisitPlan,
} from './harbourActivities';
import { BOT_GATES, BOT_SLOT_MS, botGround, visitsAt } from './harbourBots';

const key = (tile: GridPosition): string => `${tile.x},${tile.y}`;
const FIRST = Math.floor(Date.UTC(2026, 9, 29) / BOT_SLOT_MS);
const VISITS = 800;
const every = (visit = FIRST): VisitPlan[] => Array.from({ length: VISITS }, (_, index) => visitPlan(visit + index));
const ahead = (tile: GridPosition, facing: Direction): GridPosition => ({
  x: tile.x + (facing === 'right' ? 1 : facing === 'left' ? -1 : 0),
  y: tile.y + (facing === 'down' ? 1 : facing === 'up' ? -1 : 0),
});

describe('where the regulars go to do things', () => {
  const { walks } = botGround();
  const map = getBaseMap([]);

  it('stand on ground they may walk, looking at what they came to look at', () => {
    for (const { tile, facing } of [...SEA_VIEWS, ...HANG_OUTS, ...SHOP_WINDOWS, ...NOTICE_BOARDS, ...CHAT_CIRCLES.flat()]) {
      expect([tile, walks[tile.y][tile.x]]).toEqual([tile, true]);
      expect(ahead(tile, facing).y).toBeGreaterThanOrEqual(0);
    }
    for (const { tile, facing } of SEA_VIEWS) {
      const looking = ahead(tile, facing);
      expect([tile, map.terrain[looking.y][looking.x]]).toEqual([tile, 'water']);
    }
    for (const { tile, facing } of [...HANG_OUTS, ...SHOP_WINDOWS]) {
      const looking = ahead(tile, facing);
      // Something to look at: never open air.
      expect([tile, map.collision[looking.y][looking.x]]).toEqual([tile, true]);
    }
    const signs = new Set(BASE_SIGNS.map(key));
    for (const { tile, facing } of NOTICE_BOARDS) {
      expect([tile, signs.has(key(ahead(tile, facing)))]).toEqual([tile, true]);
    }
  });

  it('talk face to face in a circle, whichever two of it turn up', () => {
    for (const circle of CHAT_CIRCLES) {
      expect(circle.length).toBeGreaterThanOrEqual(2);
      const [a, b] = circle;
      expect(a.tile.y).toBe(b.tile.y);
      expect(a.facing).toBe(directionOf(a.tile, b.tile));
      expect(b.facing).toBe(directionOf(b.tile, a.tile));
      if (circle[2]) {
        const middle = { x: (a.tile.x + b.tile.x) / 2, y: a.tile.y };
        expect(circle[2].tile.x).toBe(middle.x);
        expect(circle[2].facing).toBe(circle[2].tile.y < middle.y ? 'down' : 'up');
      }
    }
  });

  it('lengthen nobody\'s walk, whichever place somebody is stood on', () => {
    const stood = [...SEA_VIEWS, ...HANG_OUTS, ...SHOP_WINDOWS, ...NOTICE_BOARDS, ...CHAT_CIRCLES.flat()].map(({ tile }) => key(tile));
    const places = [BASE_SPAWN, BASE_LANDING, ...BASE_DOORS.map((door) => door.returnTo)];
    for (const built of [[], WORKSHOP_UPGRADES.map((upgrade) => upgrade.id)]) {
      const { collision } = getBaseMap(built);
      for (const from of places) {
        const open = stepsFrom(collision, from);
        for (const spot of stood) {
          const crowded = stepsFrom(collision, from, (tile) => key(tile) === spot);
          for (const to of places) {
            expect([spot, from, to, crowded[to.y][to.x]]).toEqual([spot, from, to, open[to.y][to.x]]);
          }
        }
      }
    }
  });

  it('never come out of, knock at or read the sign of a player\'s own home', () => {
    const home = BASE_DOORS.find((door) => door.id === 'bolthole')!;
    expect(BOT_GATES.map((gate) => gate.id)).not.toContain('bolthole');
    expect(BOT_GATES.map((gate) => key(gate.tile))).not.toContain(key(home.tiles[0]));
    expect(KNOCKED_DOORS).not.toContain('bolthole');
    const sign = { x: HOME_SIGN.x, y: HOME_SIGN.y };
    for (const { tile, facing } of [...NOTICE_BOARDS, ...HANG_OUTS]) {
      expect(ahead(tile, facing)).not.toEqual(sign);
    }
    for (const plan of every()) {
      for (const leg of plan.legs) {
        if (leg.kind === 'pause') expect(key(leg.tile)).not.toBe(key(home.returnTo));
        if (leg.kind === 'walk') expect(leg.path.map(key)).not.toContain(key(home.tiles[0]));
      }
    }
  });

  it('knock at nobody: a knock here is a hand raised, and this file can reach no door', () => {
    const source = readFileSync(new URL('./harbourActivities.ts', import.meta.url), 'utf8');
    const imports = source.split('\n').filter((line) => /^\s*(import|}\s*from)/.test(line)).join('\n');
    expect(imports).not.toMatch(/knocking|houseDoor|houseService|harbourWire|harbourLink'.*harbour\(\)|supabase/i);
  });
});

describe('a regular\'s plan', () => {
  beforeAll(() => forgetVisitPlans());

  it('is worked out from the visit\'s number alone, whatever was asked before it', () => {
    const asked = [FIRST + 40, FIRST + 41, FIRST + 7];
    const first = asked.map((visit) => visitPlan(visit));
    forgetVisitPlans();
    const again = [...asked].reverse().map((visit) => visitPlan(visit)).reverse();
    expect(again).toEqual(first);
  });

  it('does all sorts of things, and keeps some wanderers', () => {
    const time = new Map<BotActivity, number>();
    for (const plan of every()) {
      for (const leg of plan.legs) {
        if (leg.kind !== 'walk') time.set(leg.activity, (time.get(leg.activity) ?? 0) + leg.to - leg.from);
      }
    }
    const total = [...time.values()].reduce((sum, ms) => sum + ms, 0);
    const shares = Object.fromEntries([...time].map(([kind, ms]) => [kind, ms / total]));
    for (const kind of ['stroll', 'wander', 'hang-out', 'watch-sea', 'window-shop', 'read-board', 'knock', 'call-in', 'chat'] as const) {
      expect([kind, (shares[kind] ?? 0) > 0.005]).toEqual([kind, true]);
    }
    expect(shares.wander).toBeGreaterThan(0.08);
    // Nothing is all anybody does.
    expect(Math.max(...Object.values(shares))).toBeLessThan(0.4);
  });

  it('never has two people on one tile, standing or stepping, or very nearly never', () => {
    let clashes = 0;
    let looks = 0;
    const start = (FIRST + 8) * BOT_SLOT_MS;
    const end = (FIRST + VISITS - 16) * BOT_SLOT_MS;
    for (let now = start; now < end; now += 150) {
      looks += 1;
      const taken = new Map<string, number>();
      for (const visit of visitsAt(now)) {
        const at = botAt(visitPlan(visit), now);
        if (!at || at.inside) continue;
        for (const tile of [at.tile, ...(at.next ? [at.next] : [])]) {
          const other = taken.get(key(tile));
          if (other !== undefined && other !== visit) clashes += 1;
          taken.set(key(tile), visit);
        }
      }
    }
    // What is left is walks with no clear run at all, which the drawn figures
    // put off or walk round (`harbourRegulars.test.ts` holds what is drawn to none).
    expect(clashes / looks).toBeLessThan(0.003);
  });

  it('comes and goes through a way through, fading in the step it takes, so nobody pops up in view', () => {
    const gates = new Set(BOT_GATES.map((gate) => key(gate.tile)));
    for (const plan of every()) {
      expect(gates.has(key(plan.enter.tile))).toBe(true);
      expect(gates.has(key(plan.leave.tile))).toBe(true);
      const first = plan.legs[0];
      expect(botAt(plan, first.from)?.fade).toBe(0);
      expect(botAt(plan, first.from + 75)?.fade).toBeCloseTo(0.5, 5);
      expect(botAt(plan, plan.to - 75)?.fade).toBeCloseTo(0.5, 5);
      expect(botAt(plan, plan.to)).toBeNull();
    }
  });

  it('never starts what somebody else is starting at the same moment', () => {
    const starts: { kind: BotActivity; at: number; visit: number }[] = [];
    for (const plan of every()) {
      for (const leg of plan.legs) {
        if (leg.kind === 'pause' && !leg.givingWay && leg.activity !== 'chat' && leg.activity !== 'wander') {
          starts.push({ kind: leg.activity, at: leg.from, visit: plan.visit });
        }
      }
    }
    starts.sort((a, b) => a.at - b.at);
    let inStep = 0;
    starts.forEach((start, index) => {
      for (let next = index + 1; next < starts.length && starts[next].at - start.at < IN_STEP_MS; next += 1) {
        if (starts[next].kind === start.kind && starts[next].visit !== start.visit) inStep += 1;
      }
    });
    expect(inStep / starts.length).toBeLessThan(0.01);
  });

  it('looks at what it came to look at while it stands there', () => {
    const facings = new Map([...SEA_VIEWS, ...SHOP_WINDOWS].map((spot) => [key(spot.tile), spot.facing]));
    for (const plan of every()) {
      for (const leg of plan.legs) {
        if (leg.kind !== 'pause' || leg.givingWay || (leg.activity !== 'watch-sea' && leg.activity !== 'window-shop')) continue;
        expect(leg.looks[0].facing).toBe(facings.get(key(leg.tile)));
        // A glance aside comes back.
        expect(leg.looks[leg.looks.length - 1].facing).toBe(leg.looks[0].facing);
      }
    }
  });

  it('knocks from the doorstep of a door made for it, with a hand raised, and no further', () => {
    const steps = new Map(BASE_DOORS.filter((door) => (KNOCKED_DOORS as readonly string[]).includes(door.id)).map((door) => [key(door.returnTo), door]));
    let knocks = 0;
    for (const plan of every()) {
      for (const leg of plan.legs) {
        if (leg.kind !== 'pause' || leg.givingWay || leg.activity !== 'knock') continue;
        knocks += 1;
        expect(steps.has(key(leg.tile))).toBe(true);
        expect(leg.looks[0].facing).toBe('up');
        expect(plan.waves.some((at) => at >= leg.from && at < leg.to)).toBe(true);
      }
    }
    expect(knocks).toBeGreaterThan(VISITS / 10);
  });
});

describe('a chat', () => {
  const window = (index: number): number => Math.floor((FIRST * BOT_SLOT_MS) / CHAT_WINDOW_MS) + index;
  const chats = Array.from({ length: 200 }, (_, index) => chatInWindow(window(index))).filter((chat) => chat !== null);

  it('happens often, between two or three who are in for all of it', () => {
    expect(chats.length).toBeGreaterThan(80);
    for (const chat of chats) {
      expect(chat.members.length).toBeGreaterThanOrEqual(2);
      expect(chat.members.length).toBeLessThanOrEqual(chat.seats.length);
      expect(new Set(chat.members.map((visit) => visitPlan(visit).bot.id)).size).toBe(chat.members.length);
    }
  });

  it('has everybody on their seat, facing the others, for as long as it lasts', () => {
    let held = 0;
    let looked = 0;
    for (const chat of chats) {
      const during = chat.arrive[chat.members.length - 1] + 2_000;
      if (during >= chat.depart[0]) continue;
      chat.members.forEach((visit, member) => {
        const at = botAt(visitPlan(visit), during);
        looked += 1;
        if (at && key(at.tile) === key(chat.seats[member].tile) && at.activity === 'chat') {
          held += 1;
          expect(at.facing).toBe(chat.seats[member].facing);
        }
      });
    }
    // A member held up by a crowded road can be seconds late: never most of them.
    expect(held / looked).toBeGreaterThan(0.95);
  });

  it('never has two bubbles up at once, and each is one of the phrases', () => {
    for (const chat of chats) {
      const said = [...chat.says].sort((a, b) => a.at - b.at);
      said.forEach((line, index) => {
        expect(isHarbourPhraseId(line.phrase)).toBe(true);
        if (said[index + 1]) expect(said[index + 1].at).toBeGreaterThanOrEqual(line.at + PHRASE_SHOWN_MS);
      });
    }
  });
});

describe('what the regulars say', () => {
  it('is rare: a bubble here and there, not a chorus', () => {
    let up = 0;
    let looks = 0;
    const start = (FIRST + 8) * BOT_SLOT_MS;
    const end = (FIRST + 400) * BOT_SLOT_MS;
    for (let now = start; now < end; now += 500) {
      looks += 1;
      for (const visit of visitsAt(now)) {
        if (botSayingAt(visitPlan(visit), now)) up += 1;
      }
    }
    // Over the whole harbour, of which a screen shows a part.
    expect(up / looks).toBeLessThan(0.15);
    expect(up / looks).toBeGreaterThan(0.005);
  });
});
