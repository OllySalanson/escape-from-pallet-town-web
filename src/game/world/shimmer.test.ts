import { describe, expect, it } from 'vitest';
import {
  FOREST_EDGE_WILDLIFE,
  PALLET_FIELD_WILDLIFE,
  ROUTE_MEADOW_WILDLIFE,
  type WildEncounterTable,
} from '../pokemon/encounters';
import { SHINY_ODDS } from '../pokemon/shiny';
import { getSpeciesById } from '../pokemon/species';
import { generateRunPlan, runInsertions } from '../run/runGeneration';
import { createSeededRng } from '../run/rng';
import { getWorldMap } from '../worldMap';
import { districtAt } from './districts';
import { MAP_FILE_HABITATS } from './mapFile';
import { atNight, districtTableFor } from './nightRaids';
import { builtInFileMap } from './playerMaps';
import {
  hasShimmer,
  layShimmer,
  RARE_SHARE,
  rarestOf,
  rollShimmerShiny,
  SHIMMER_CLEAR_OF_FIGURES,
  SHIMMER_LEAST_WALK,
  SHIMMER_LEVELS_OVER,
  SHIMMER_MOST_WALK,
  SHIMMER_OFF_TRAIL,
  SHIMMER_SHINY_ODDS,
  shimmerSeats,
} from './shimmer';

/**
 * The shimmering grass (`shimmer.ts`): one patch a raid, a little off the walk
 * to the stake, holding its place's rarest Pokemon and the best odds of a
 * shiny a raid has - on a stream of its own, on ground a raid can walk to.
 */

const VALE = 'greystone-vale';
const table = (entries: readonly [string, number, number, number][]): WildEncounterTable => ({
  stepEncounterRate: 0.1,
  entries: entries.map(([speciesId, minLevel, maxLevel, weight]) => ({ speciesId, minLevel, maxLevel, weight })),
});

describe('what is in the shimmering grass', () => {
  it('is the rarest thing its place holds, a level over the best the place rolls', () => {
    expect(
      rarestOf(
        table([
          ['pidgey', 3, 4, 3],
          ['magikarp', 4, 6, 2],
          ['squirtle', 4, 5, 1],
        ]),
      ),
    ).toEqual({ speciesIds: ['squirtle'], level: 6 + SHIMMER_LEVELS_OVER });
  });

  it('counts a species written on two rows as the sum of them', () => {
    // Bulbasaur is on two rows here, four in all: the Pikachu at two is rarer.
    expect(
      rarestOf(
        table([
          ['bulbasaur', 4, 6, 3],
          ['pikachu', 9, 10, 2],
          ['bulbasaur', 7, 7, 1],
        ]),
      ),
    ).toEqual({ speciesIds: ['pikachu'], level: 11 });
  });

  it('is every kind tied for rarest, by name, for the raid’s stream to pick among', () => {
    expect(
      rarestOf(
        table([
          ['scyther', 16, 17, 1],
          ['rattata', 3, 5, 4],
          ['chansey', 16, 17, 1],
          ['pinsir', 16, 17, 1],
        ]),
      )?.speciesIds,
    ).toEqual(['chansey', 'pinsir', 'scyther']);
  });

  it('is nothing where nothing lives', () => {
    expect(rarestOf(undefined)).toBeUndefined();
    expect(rarestOf(table([]))).toBeUndefined();
  });

  it('is the place’s rare company where its table has no rare slot, and beside its rare slot where it has one', () => {
    expect(rarestOf(FOREST_EDGE_WILDLIFE)).toEqual({ speciesIds: ['bulbasaur', 'pikachu'], level: 9 });
    expect(rarestOf(ROUTE_MEADOW_WILDLIFE)).toEqual({ speciesIds: ['doduo', 'ponyta'], level: 7 });
    expect(rarestOf(PALLET_FIELD_WILDLIFE)).toEqual({ speciesIds: ['growlithe', 'mankey'], level: 6 });
    // The reeds' Squirtle is a tenth of them, and the wild duck glitters beside it.
    expect(rarestOf(MAP_FILE_HABITATS.wetland)?.speciesIds).toEqual(['farfetchd', 'squirtle']);
    expect(rarestOf(MAP_FILE_HABITATS['poison-marsh'])?.speciesIds).toEqual(['chansey', 'ekans', 'kangaskhan', 'pinsir', 'scyther']);
    // By night the grass holds another table, and the company is still the place's.
    expect(rarestOf(atNight(FOREST_EDGE_WILDLIFE), FOREST_EDGE_WILDLIFE)?.speciesIds).toEqual(['bulbasaur', 'pikachu']);
    // A habitat with a rare slot and no company keeps its slot.
    expect(rarestOf(MAP_FILE_HABITATS['power-plant'])?.speciesIds).toEqual(['electabuzz']);
    expect(rarestOf(MAP_FILE_HABITATS.town)?.speciesIds).toEqual(['charmander']);
  });

  it('is never a common thing under a light, on any habitat the vale has grass in', () => {
    const file = builtInFileMap(VALE)!.file;
    const grown = new Set(
      [file.wildlife, ...(file.districts ?? []).filter((place) => place.area === undefined).map((place) => place.wildlife)].filter(
        (name) => name !== undefined,
      ),
    );
    expect(grown.size).toBeGreaterThan(8);
    for (const name of grown) {
      const habitat = MAP_FILE_HABITATS[name];
      const rarity = rarestOf(habitat)!;
      const total = habitat.entries.reduce((sum, entry) => sum + entry.weight, 0);
      for (const speciesId of rarity.speciesIds) {
        const share = habitat.entries.filter((entry) => entry.speciesId === speciesId).reduce((sum, entry) => sum + entry.weight, 0) / total;
        expect(share, `${speciesId} in ${name}`).toBeLessThan(RARE_SHARE);
        // And it can fight: a kind met at this level knows a move that does damage.
        const species = getSpeciesById(speciesId)!;
        expect(species, speciesId).toBeDefined();
        const knows = species.learnset.filter((learned) => learned.level <= rarity.level).map((learned) => learned.move);
        expect(knows.some((move) => move.power > 0), `${speciesId} at Lv ${rarity.level} in ${name}`).toBe(true);
      }
    }
  });

  it('is shiny one time in fifty, ten times the wild’s odds', () => {
    expect(SHIMMER_SHINY_ODDS).toBe(50);
    expect(SHINY_ODDS / SHIMMER_SHINY_ODDS).toBe(10);
    expect(rollShimmerShiny({ next: () => 1 / SHIMMER_SHINY_ODDS - 0.0001 })).toBe(true);
    expect(rollShimmerShiny({ next: () => 1 / SHIMMER_SHINY_ODDS })).toBe(false);
    const rng = createSeededRng(0x5eed);
    const rolls = 100_000;
    let shinies = 0;
    for (let roll = 0; roll < rolls; roll += 1) {
      if (rollShimmerShiny(rng)) shinies += 1;
    }
    expect(shinies / rolls).toBeGreaterThan(0.017);
    expect(shinies / rolls).toBeLessThan(0.023);
  });
});

describe('where the shimmering grass may lie', () => {
  // A strip of ground twelve wide and nine deep, all tall grass, walked along its middle row.
  const width = 12;
  const height = 9;
  const tallGrass = Array.from({ length: height }, () => Array.from({ length: width }, () => true));
  const steps = Array.from({ length: height }, (_, y) =>
    Int32Array.from({ length: width }, (_, x) => SHIMMER_LEAST_WALK + x + Math.abs(y - 4)),
  );
  const trail = Array.from({ length: width }, (_, x) => ({ x, y: 4 }));

  it('is beside the walk to the stake, never on it', () => {
    const seats = shimmerSeats({ tallGrass }, steps, new Set(), trail);
    expect(seats.length).toBeGreaterThan(0);
    for (const seat of seats) {
      const nearest = Math.min(...trail.map((step) => Math.abs(step.x - seat.x) + Math.abs(step.y - seat.y)));
      expect(nearest).toBeGreaterThanOrEqual(SHIMMER_OFF_TRAIL.least);
      expect(Math.abs(seat.y - 4)).toBeLessThanOrEqual(SHIMMER_OFF_TRAIL.down);
    }
  });

  it('is on nothing else’s tile', () => {
    const reserved = new Set(['3,2', '4,2']);
    const seats = shimmerSeats({ tallGrass }, steps, reserved, trail);
    expect(seats.some((seat) => reserved.has(`${seat.x},${seat.y}`))).toBe(false);
  });

  it('is anywhere in range where no grass stands beside the trail, or there is no trail', () => {
    const far = [{ x: 400, y: 400 }];
    expect(shimmerSeats({ tallGrass }, steps, new Set(), far).length).toBe(width * height);
    expect(shimmerSeats({ tallGrass }, steps, new Set()).length).toBe(width * height);
  });

  it('keeps two tiles clear of anybody standing or walking a beat', () => {
    const figures = [{ x: 5, y: 2 }];
    const seats = shimmerSeats({ tallGrass }, steps, new Set(), [], figures);
    expect(seats.length).toBe(width * height - 25);
    for (const seat of seats) {
      expect(Math.max(Math.abs(seat.x - 5), Math.abs(seat.y - 2))).toBeGreaterThan(SHIMMER_CLEAR_OF_FIGURES);
    }
  });

  it('is only tall grass the walk reaches, inside its range', () => {
    const bare = tallGrass.map((row, y) => row.map((grass, x) => grass && !(x === 5 && y === 0)));
    const walked = steps.map((row, y) =>
      Int32Array.from(row, (walk, x) => (x === 6 && y === 0 ? -1 : x === 7 && y === 0 ? SHIMMER_MOST_WALK + 1 : walk)),
    );
    const seats = shimmerSeats({ tallGrass: bare }, walked, new Set());
    expect(seats).toHaveLength(width * height - 3);
    expect(seats.some((seat) => seat.y === 0 && [5, 6, 7].includes(seat.x))).toBe(false);
  });

  it('spends one roll whatever the tables hold, and passes over a place with no wildlife', () => {
    const seats = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ];
    const reeds = rarestOf(table([['squirtle', 4, 5, 1]]));
    const rolls: number[] = [];
    const rng = { int: (low: number, high: number) => (rolls.push(high - low), 1) };
    expect(layShimmer(seats, (tile) => (tile.x === 2 ? reeds : undefined), rng)).toEqual({
      position: { x: 2, y: 0 },
      speciesId: 'squirtle',
      level: 6,
    });
    // The seat, and which of the kinds tied for rarest: two rolls, always.
    expect(rolls).toEqual([2, 0xffff]);
    expect(layShimmer([], () => reeds, rng)).toBeUndefined();
    expect(rolls).toEqual([2, 0xffff]);
    expect(layShimmer(seats, () => undefined, rng)).toBeUndefined();
    const tied = { speciesIds: ['chansey', 'pinsir', 'scyther'], level: 18 };
    expect(layShimmer(seats, () => tied, { int: (_low: number, high: number) => (high === 0xffff ? 5 : 0) })?.speciesId).toBe('scyther');
  });
});

describe('the shimmering grass on Greystone Vale', () => {
  const map = getWorldMap(VALE);
  const landings = runInsertions()
    .filter((insertion) => insertion.mapId === VALE)
    .map((insertion) => insertion.id);
  const SEEDS = [1, 2, 3, 7, 11, 99, 1234];
  const laidFrom = new Map<string, number>();

  it('is on the vale, and on no map with no stake to lay it by', () => {
    expect(hasShimmer(VALE)).toBe(true);
    expect(hasShimmer('pallet-town')).toBe(false);
    expect(generateRunPlan(7, undefined, 'floodplain-relay').shimmer).toBeUndefined();
  });

  it.each(landings)('from %s is a tile of tall grass a raid can walk to, with nothing else on it', (landing) => {
    const faults: string[] = [];
    let laid = 0;
    for (const seed of SEEDS) {
      const plan = generateRunPlan(seed, undefined, landing);
      const shimmer = plan.shimmer;
      if (!shimmer) continue;
      laid += 1;
      const { x, y } = shimmer.position;
      const at = `${landing} seed ${seed} at ${x},${y}`;
      if (map.tallGrass[y]?.[x] !== true) faults.push(`${at}: not tall grass`);
      if (map.collision[y]?.[x] !== false) faults.push(`${at}: not ground`);
      const taken = [
        ...(plan.loot[VALE] ?? []).map((piece) => piece.position),
        ...plan.trainers.filter((trainer) => trainer.mapId === VALE).map((trainer) => trainer.position),
        ...plan.extractionPoints.filter((point) => point.mapId === VALE).map((point) => point.position),
        plan.insertion.position,
      ];
      if (taken.some((tile) => tile.x === x && tile.y === y)) faults.push(`${at}: something else is on it`);
      // Nobody stands, walks a beat or is signed within two tiles of it: a figure in front of
      // the glitter hides it, and one calling out talks over it.
      const near = [
        ...map.entities.flatMap((entity) => [entity.position, ...(entity.idle?.roam ?? [])]),
        ...plan.trainers.filter((trainer) => trainer.mapId === VALE).map((trainer) => trainer.position),
      ].find((tile) => Math.max(Math.abs(tile.x - x), Math.abs(tile.y - y)) <= SHIMMER_CLEAR_OF_FIGURES);
      if (near) faults.push(`${at}: somebody stands at ${near.x},${near.y}`);
      // What is in it is one of the rarest of the place a step there is in.
      const place = districtAt(VALE, shimmer.position);
      const rarest = rarestOf(place?.encounters ?? map.encounters);
      if (!rarest || !rarest.speciesIds.includes(shimmer.speciesId) || rarest.level !== shimmer.level) {
        faults.push(`${at}: holds ${shimmer.speciesId} Lv ${shimmer.level}, not ${rarest?.speciesIds.join('/')} Lv ${rarest?.level} of ${place?.name}`);
      }
    }
    expect(faults).toEqual([]);
    laidFrom.set(landing, laid);
  });

  it('is laid on most raids from most landings: all but the ones with no tall grass in reach', () => {
    // The drowned port and the cove's cliff top stand behind MISTY's doors on
    // stone and sand, with no grass a fresh save can walk to.
    const bare = landings.filter((landing) => (laidFrom.get(landing) ?? 0) === 0);
    expect(bare.sort()).toEqual(['greystone-vale-cove-steps', 'greystone-vale-old-quay']);
    for (const landing of landings.filter((each) => !bare.includes(each))) {
      expect(laidFrom.get(landing), `${landing} lays a patch on most raids`).toBeGreaterThanOrEqual(SEEDS.length - 2);
    }
  });

  it('is the same patch for the same seed, and moves with the seed', () => {
    const [landing] = landings;
    expect(generateRunPlan(7, undefined, landing).shimmer).toEqual(generateRunPlan(7, undefined, landing).shimmer);
    const seats = new Set(SEEDS.map((seed) => JSON.stringify(generateRunPlan(seed, undefined, landing).shimmer?.position)));
    expect(seats.size).toBeGreaterThan(2);
  });

  it('is not laid on a new save’s first raid, and that changes nothing else about the raid', () => {
    const [landing] = landings;
    const later = generateRunPlan(7, undefined, landing);
    const first = generateRunPlan(7, undefined, landing, undefined, undefined, undefined, { firstRaid: true });
    expect(later.shimmer).toBeDefined();
    expect(first.shimmer).toBeUndefined();
    // Everything rolled on the raid's own streams is where it was: the patch is laid last, on its own.
    expect(first.trainers.map((trainer) => [trainer.trainer.id, trainer.position])).toEqual(
      later.trainers.map((trainer) => [trainer.trainer.id, trainer.position]),
    );
    expect(first.extractionPoints).toEqual(later.extractionPoints);
    expect(first.districtEncounters).toEqual(later.districtEncounters);
  });

  it('holds what comes out at night on a night raid', () => {
    const [landing] = landings;
    const args = [undefined, undefined, undefined, undefined, undefined, undefined] as const;
    const day = generateRunPlan(7, undefined, landing, ...args, false);
    const night = generateRunPlan(7, undefined, landing, ...args, true);
    // A night raid walks a vale with its night tracks open, so the patch may lie elsewhere.
    expect(day.shimmer).toBeDefined();
    expect(night.shimmer).toBeDefined();
    const place = districtAt(VALE, night.shimmer!.position)!;
    expect(rarestOf(districtTableFor(place, true), place.encounters)?.speciesIds).toContain(night.shimmer?.speciesId);
  });
});
