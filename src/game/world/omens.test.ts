import { describe, expect, it } from 'vitest';
import { MAX_PENDING_RECOVERY_MS } from '../hub/recovery';
import { omenRoost } from '../objectives/ObjectiveGuide';
import { RAID_DURATION_MS } from '../run/raidClock';
import { generateRunPlan, runInsertions } from '../run/runGeneration';
import { createSeededRng } from '../run/rng';
import { getWorldMap } from '../worldMap';
import {
  hasOmens,
  isOmenBird,
  layOmen,
  OMEN_BIRDS,
  OMEN_CROSSING_MS,
  OMEN_EARLIEST_MS,
  OMEN_EVERY,
  OMEN_LATEST_MS,
  OMEN_ROOSTS,
  OMEN_SHADOW_PIXELS,
  omenLine,
  omenShadowAt,
} from './omens';

/**
 * Omens (`omens.ts`): one raid in three, a legendary bird not yet caught
 * crosses the sky for its roost - on a stream of its own, never a bird the
 * Pokedex owns, and always inside the shortest raid there is.
 */

const VALE = 'greystone-vale';
const constant = (values: readonly number[]) => {
  let index = 0;
  return { int: () => values[index++ % values.length] };
};

describe('which raid has an omen', () => {
  it('is one raid in three, and a bird that is still to be caught', () => {
    const rng = createSeededRng(0x0e7);
    const raids = 30_000;
    const seen = new Map<string, number>();
    for (let raid = 0; raid < raids; raid += 1) {
      const omen = layOmen([], rng);
      if (omen) seen.set(omen.speciesId, (seen.get(omen.speciesId) ?? 0) + 1);
    }
    const all = [...seen.values()].reduce((sum, count) => sum + count, 0);
    expect(all / raids).toBeGreaterThan(1 / OMEN_EVERY - 0.02);
    expect(all / raids).toBeLessThan(1 / OMEN_EVERY + 0.02);
    // Each of the three, about as often as the others.
    expect([...seen.keys()].sort()).toEqual([...OMEN_BIRDS].sort());
    for (const count of seen.values()) {
      expect(count / all).toBeGreaterThan(0.3);
    }
  });

  it('is never a bird the Pokedex owns, and none at all once all three are home', () => {
    expect(layOmen(['zapdos'], constant([1, 30_000, 0]))?.speciesId).toBe('articuno');
    expect(layOmen(['zapdos'], constant([1, 30_000, 1]))?.speciesId).toBe('moltres');
    expect(layOmen(['articuno', 'moltres'], constant([1, 30_000, 5]))?.speciesId).toBe('zapdos');
    expect(layOmen(['articuno', 'zapdos', 'moltres'], constant([1, 30_000, 0]))).toBeUndefined();
    // A legend that is no bird of these does not count against them.
    expect(layOmen(['mew', 'mewtwo'], constant([1, 30_000, 2]))?.speciesId).toBe('moltres');
  });

  it('spends three rolls whatever they come to, so a seed plays the same raid whatever has been caught', () => {
    for (const caught of [[], ['zapdos'], [...OMEN_BIRDS]]) {
      for (const first of [1, 2, 3]) {
        const asked: number[] = [];
        layOmen(caught, {
          int: (low: number, high: number) => {
            asked.push(high - low);
            return asked.length === 1 ? first : low;
          },
        });
        expect(asked).toEqual([OMEN_EVERY - 1, OMEN_LATEST_MS - OMEN_EARLIEST_MS, 0xffff]);
      }
    }
  });

  it('crosses after the landing has been looked at and inside the shortest raid a heal leaves', () => {
    expect(OMEN_EARLIEST_MS).toBeGreaterThanOrEqual(15_000);
    expect(OMEN_LATEST_MS + OMEN_CROSSING_MS).toBeLessThan(RAID_DURATION_MS - MAX_PENDING_RECOVERY_MS);
    expect(layOmen([], constant([1, OMEN_EARLIEST_MS, 0]))?.atMs).toBe(OMEN_EARLIEST_MS);
  });

  it('knows its three birds, and nothing else, as birds', () => {
    expect(OMEN_BIRDS).toEqual(['articuno', 'zapdos', 'moltres']);
    expect(isOmenBird('moltres')).toBe(true);
    expect(isOmenBird('mew')).toBe(false);
  });
});

describe('the shadow across the screen', () => {
  const width = 400;
  const height = 256;

  it('comes in from off the screen, through the middle of it, and goes out the other side, whichever way it is heading', () => {
    for (const heading of [
      { x: 10, y: 0 },
      { x: -3, y: 7 },
      { x: 0, y: -40 },
      { x: 200, y: 200 },
    ]) {
      const start = omenShadowAt(0, width, height, heading)!;
      const middle = omenShadowAt(OMEN_CROSSING_MS / 2, width, height, heading)!;
      const end = omenShadowAt(OMEN_CROSSING_MS, width, height, heading)!;
      const off = (at: { x: number; y: number }) =>
        at.x < -OMEN_SHADOW_PIXELS / 2 || at.x > width + OMEN_SHADOW_PIXELS / 2 || at.y < -OMEN_SHADOW_PIXELS / 2 || at.y > height + OMEN_SHADOW_PIXELS / 2;
      expect(off(start), JSON.stringify(heading)).toBe(true);
      expect(off(end), JSON.stringify(heading)).toBe(true);
      expect(middle).toEqual({ x: width / 2, y: height / 2 });
      // It flies the way it is heading.
      expect(Math.sign(end.x - start.x)).toBe(Math.sign(heading.x));
      expect(Math.sign(end.y - start.y)).toBe(Math.sign(heading.y));
    }
  });

  it('is nowhere before it sets off or once it has gone, and flies east from right under its roost', () => {
    expect(omenShadowAt(-1, width, height, { x: 1, y: 0 })).toBeNull();
    expect(omenShadowAt(OMEN_CROSSING_MS + 1, width, height, { x: 1, y: 0 })).toBeNull();
    const still = omenShadowAt(OMEN_CROSSING_MS, width, height, { x: 0, y: 0 })!;
    expect(still.x).toBeGreaterThan(width);
    expect(still.y).toBe(height / 2);
  });
});

describe('omens on Greystone Vale', () => {
  const landings = runInsertions()
    .filter((insertion) => insertion.mapId === VALE)
    .map((insertion) => insertion.id);

  it('roosts each bird in a district the vale has, where its legend stands', () => {
    const map = getWorldMap(VALE);
    for (const bird of OMEN_BIRDS) {
      const roost = omenRoost(VALE, bird);
      expect(roost, `${bird} has no roost on the vale`).toBeDefined();
      // The legend itself stands on the vale (out of doors, or in a room of that district).
      const legend = map.entities.find((entity) => entity.pokemon === bird && entity.legendary);
      expect(legend, `${bird} does not stand on the vale`).toBeDefined();
      expect(OMEN_ROOSTS[bird].roost).toContain(OMEN_ROOSTS[bird].district);
    }
  });

  it('is on the vale and on no other map', () => {
    expect(hasOmens(VALE)).toBe(true);
    expect(hasOmens('pallet-town')).toBe(false);
    for (let seed = 1; seed <= 12; seed += 1) {
      expect(generateRunPlan(seed, undefined, 'floodplain-relay').omen).toBeUndefined();
    }
  });

  it('comes on about one raid in three, the same for the same seed, and never on a new save’s first raid', () => {
    const [landing] = landings;
    const seeds = Array.from({ length: 60 }, (_, index) => index + 1);
    const omens = seeds.map((seed) => generateRunPlan(seed, undefined, landing).omen);
    const count = omens.filter((omen) => omen !== undefined).length;
    expect(count).toBeGreaterThan(10);
    expect(count).toBeLessThan(32);
    expect(generateRunPlan(7, undefined, landing).omen).toEqual(generateRunPlan(7, undefined, landing).omen);
    const withOmen = seeds.find((seed) => generateRunPlan(seed, undefined, landing).omen !== undefined)!;
    expect(generateRunPlan(withOmen, undefined, landing, undefined, undefined, undefined, { firstRaid: true }).omen).toBeUndefined();
  });

  it('is never a bird this save has caught, and changes nothing else about the raid', () => {
    const [landing] = landings;
    const args = [undefined, undefined, [], {}, [], [], false] as const;
    const seed = Array.from({ length: 60 }, (_, index) => index + 1).find(
      (each) => generateRunPlan(each, undefined, landing).omen?.speciesId === 'zapdos',
    )!;
    expect(seed).toBeDefined();
    const fresh = generateRunPlan(seed, undefined, landing, ...args, []);
    const caught = generateRunPlan(seed, undefined, landing, ...args, ['zapdos']);
    expect(fresh.omen?.speciesId).toBe('zapdos');
    expect(caught.omen?.speciesId).not.toBe('zapdos');
    expect(generateRunPlan(seed, undefined, landing, ...args, [...OMEN_BIRDS]).omen).toBeUndefined();
    // The same raid in every other respect: the omen is on a stream of its own.
    expect(caught.extractionPoints).toEqual(fresh.extractionPoints);
    expect(caught.hunter).toEqual(fresh.hunter);
    expect(caught.districtEncounters).toEqual(fresh.districtEncounters);
  });
});

describe('what Oak says of an omen', () => {
  it('says which way it went, what it was and where they say it roosts', () => {
    expect(omenLine({ speciesId: 'zapdos', atMs: 0 }, 'north-east')).toBe(
      'A great shadow crossed the vale, heading north-east. That cry was ZAPDOS. They say it roosts in the TURBINE HALL at THE POWER STATION.',
    );
    expect(omenLine({ speciesId: 'articuno', atMs: 0 }, undefined)).toBe(
      'A great shadow crossed the vale, and came down close by. That cry was ARTICUNO. They say it roosts in THE FROZEN LAGOON on FROSTREEF.',
    );
    // One box of the field guide: two lines of it at most.
    for (const bird of OMEN_BIRDS) {
      expect(omenLine({ speciesId: bird, atMs: 0 }, 'south-west').length).toBeLessThanOrEqual(140);
    }
  });
});
