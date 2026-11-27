import { describe, expect, it } from 'vitest';
import { getSpeciesById } from '../pokemon/species';
import { DEEP_WATER_SLOTS, FISHING_WATER_SLOTS } from '../world/generated/fishingWaters';
import {
  BAND_ZOOM,
  FAR_SHOWS_FROM_ZOOM,
  PANORAMA,
  SEA_EDGE,
  SEA_GROUPS,
  SEA_KINDS,
  SEA_MOTIONS,
  SIGHTINGS_PER_LOOK,
  ZOOM_STEPS,
  closeEnoughAt,
  heldFor,
  nextZoom,
  poseAt,
  rollSea,
  showsAt,
  swoopAt,
  travel,
  turnBehind,
  waterlineOf,
  type SeaSighting,
} from './seaTelescope';

/** A repeatable stand-in for Math.random. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

describe("THE POINT's coin telescope: what is out at sea", () => {
  it('holds every kind the sea holds, every rod and surfing, and nothing else', () => {
    const sea = [
      ...FISHING_WATER_SLOTS.sea.oldRod,
      ...FISHING_WATER_SLOTS.sea.goodRod,
      ...DEEP_WATER_SLOTS.sea.superRod,
      ...DEEP_WATER_SLOTS.sea.surfing,
    ].map((slot) => slot.speciesId);
    expect([...SEA_KINDS].sort()).toEqual([...new Set(sea)].sort());
  });

  it('knows what every kind does out there, and every one is a Kanto kind the Pokédex counts', () => {
    for (const kind of SEA_KINDS) {
      expect(SEA_MOTIONS[kind], kind).toBeDefined();
      const species = getSpeciesById(kind);
      expect(species, kind).toBeDefined();
      expect(species!.dexId).toBeGreaterThan(0);
      expect(species!.dexId).toBeLessThanOrEqual(151);
    }
  });

  it("puts the Super Rod's kinds far out, and surfing's and the lower rods' near", () => {
    expect(SEA_GROUPS.find((group) => group.slots === DEEP_WATER_SLOTS.sea.superRod)?.band).toBe('far');
    for (const slots of [DEEP_WATER_SLOTS.sea.surfing, FISHING_WATER_SLOTS.sea.oldRod, FISHING_WATER_SLOTS.sea.goodRod]) {
      expect(SEA_GROUPS.find((group) => group.slots === slots)?.band).toBe('near');
    }
  });

  it('rolls a look of so many near and far, across the whole width, with one near in the middle', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const sea = rollSea(seeded(seed));
      expect(sea.filter((each) => each.band === 'near')).toHaveLength(SIGHTINGS_PER_LOOK.near);
      expect(sea.filter((each) => each.band === 'far')).toHaveLength(SIGHTINGS_PER_LOOK.far);
      for (const each of sea) {
        expect(each.x).toBeGreaterThanOrEqual(0);
        expect(each.x).toBeLessThan(PANORAMA.width);
        expect(each.dexId).toBe(getSpeciesById(each.speciesId)?.dexId);
        const group = SEA_GROUPS.filter((candidate) => candidate.band === each.band);
        expect(group.some((candidate) => candidate.slots.some((slot) => slot.speciesId === each.speciesId))).toBe(true);
      }
      const lane = PANORAMA.width / sea.length;
      const middle = sea.find((each) => each.band === 'near')!;
      expect(Math.floor(middle.x / lane)).toBe(Math.floor(sea.length / 2));
    }
  });

  it('shows every kind the sea holds over enough looks', () => {
    const met = new Set<string>();
    const rng = seeded(7);
    for (let look = 0; look < 2000; look += 1) rollSea(rng).forEach((each) => met.add(each.speciesId));
    expect([...met].sort()).toEqual([...SEA_KINDS].sort());
  });
});

describe("THE POINT's coin telescope: how each kind is seen", () => {
  const sighting = (motion: SeaSighting['motion'], band: SeaSighting['band'] = 'near'): SeaSighting => ({
    id: 0,
    speciesId: 'magikarp',
    dexId: 129,
    band,
    motion,
    x: 600,
    depth: 0.5,
    heading: 1,
    phaseMs: 0,
  });

  it('keeps every pose on the sea, and never more than all of a body out of the water', () => {
    for (const motion of ['drift', 'leap', 'bob', 'breach', 'perch'] as const) {
      for (const band of ['near', 'far'] as const) {
        for (let ms = 0; ms < 60_000; ms += 37) {
          const pose = poseAt(sighting(motion, band), ms);
          expect(pose.shown, `${motion} at ${ms}`).toBeGreaterThanOrEqual(0);
          expect(pose.shown, `${motion} at ${ms}`).toBeLessThanOrEqual(1);
          expect(pose.x).toBeGreaterThanOrEqual(0);
          expect(pose.x).toBeLessThan(PANORAMA.width);
          expect(pose.waterline).toBeGreaterThan(PANORAMA.horizon);
          expect(pose.waterline).toBeLessThan(PANORAMA.height);
        }
      }
    }
  });

  it('brings every kind up out of the water within a cycle, so a look can always find it', () => {
    for (const motion of ['drift', 'leap', 'bob', 'breach', 'perch'] as const) {
      const up = Array.from({ length: 1100 }, (_tick, index) => poseAt(sighting(motion), index * 10).shown);
      expect(Math.max(...up), motion).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('leaps a Magikarp clean out of the water, and breaches a Gyarados', () => {
    const leaps = Array.from({ length: 480 }, (_tick, index) => poseAt(sighting('leap'), index * 10));
    expect(leaps.some((pose) => pose.lift > 0 && pose.shown === 1)).toBe(true);
    expect(leaps.some((pose) => pose.splash?.kind === 'splash')).toBe(true);
    expect(leaps.some((pose) => pose.splash?.kind === 'ring')).toBe(true);
    const breach = Array.from({ length: 1000 }, (_tick, index) => poseAt(sighting('breach'), index * 10));
    expect(breach.some((pose) => pose.shown === 1 && pose.lift > 0)).toBe(true);
  });

  it('puts the far band by the horizon and the near band below it', () => {
    expect(waterlineOf('far', 1)).toBeLessThan(waterlineOf('near', 0));
    expect(waterlineOf('near', 0)).toBeLessThan(waterlineOf('near', 1));
  });

  it('shows the far band only zoomed in, and counts each band only close enough', () => {
    expect(showsAt('near', 1)).toBe(true);
    expect(showsAt('far', 1)).toBe(false);
    expect(showsAt('far', FAR_SHOWS_FROM_ZOOM)).toBe(true);
    expect(closeEnoughAt('near', 1)).toBe(false);
    expect(closeEnoughAt('near', BAND_ZOOM.near)).toBe(true);
    expect(closeEnoughAt('far', 2)).toBe(false);
    expect(closeEnoughAt('far', BAND_ZOOM.far)).toBe(true);
  });

  it('holds a sighting while it is in the sights, and lets it go twice as fast', () => {
    expect(heldFor(0, true, 100)).toBe(100);
    expect(heldFor(300, false, 100)).toBe(100);
    expect(heldFor(100, false, 100)).toBe(0);
  });

  it('steps the zoom in, round to the whole sea on Z, and stops at the ends on the wheel', () => {
    expect(ZOOM_STEPS).toEqual([1, 2, 4]);
    expect(nextZoom(1, 1, true)).toBe(2);
    expect(nextZoom(2, 1, true)).toBe(4);
    expect(nextZoom(4, 1, true)).toBe(1);
    expect(nextZoom(4, 1, false)).toBe(4);
    expect(nextZoom(1, -1, false)).toBe(1);
    expect(nextZoom(4, -1, false)).toBe(2);
  });
});

describe("THE POINT's coin telescope: the camera's way down", () => {
  it('starts as the harbour is and ends close in, turned right round behind somebody facing the sea', () => {
    const turn = turnBehind('down');
    expect(turn).toBeCloseTo(Math.PI);
    expect(swoopAt(0, turn)).toEqual({ zoom: 1, rotation: 0 });
    const end = swoopAt(1, turn);
    expect(end.zoom).toBe(4);
    expect(end.rotation).toBeCloseTo(Math.PI);
  });

  it('only ever comes in and round, never back', () => {
    let last = swoopAt(0, Math.PI);
    for (let step = 1; step <= 100; step += 1) {
      const now = swoopAt(step / 100, Math.PI);
      expect(now.zoom).toBeGreaterThanOrEqual(last.zoom);
      expect(now.rotation).toBeGreaterThanOrEqual(last.rotation);
      last = now;
    }
  });

  it('turns no way at all for somebody already facing up the screen', () => {
    expect(turnBehind('up')).toBe(0);
  });
});

describe("THE POINT's coin telescope: the ends of the sea", () => {
  it('turns a swimmer back at either end rather than losing it off one and bringing it in at the other', () => {
    let last = travel(600, 0).x;
    for (let distance = 1; distance < PANORAMA.width * 5; distance += 1) {
      const now = travel(600, distance);
      expect(now.x).toBeGreaterThanOrEqual(SEA_EDGE);
      expect(now.x).toBeLessThanOrEqual(PANORAMA.width - SEA_EDGE);
      expect(Math.abs(now.x - last)).toBeLessThanOrEqual(1.0001);
      last = now.x;
    }
    expect(travel(PANORAMA.width - SEA_EDGE - 1, 3).heading).toBe(-1);
    expect(travel(SEA_EDGE + 1, -3).heading).toBe(1);
  });
});
