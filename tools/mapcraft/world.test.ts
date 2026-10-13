import { describe, expect, it } from 'vitest';
import type { MapFile } from '../../src/game/world/mapFile';
import { checkMapFile } from '../../src/game/world/mapFileChecks';
import { allPassed, hardChecks } from './checks';
import { caveMaze, caveMouthSpots, chamberFloor, plantCaveMouth } from './caves';
import { MapProgram, seeded } from './program';
import { districtFile, stitch } from './stitch';
import { readTiles, regions, walkable, WALKABLE_KINDS } from './tiles';
import {
  checkPlan,
  districtRect,
  exitTile,
  openingsOf,
  openingTiles,
  startDistrict,
  type WorldPlan,
} from './worldPlan';
import quarryRoad, { QUARRY_ROAD } from './examples/quarryRoad';

const files = (seed = 1) =>
  Object.fromEntries(
    Object.entries(quarryRoad(seed).districts).map(([id, result]) => [id, result.file]),
  );

describe('the world plan', () => {
  it('passes the example plan and names what is wrong with a bad one', () => {
    expect(checkPlan(QUARRY_ROAD)).toEqual([]);
    const bad: WorldPlan = {
      ...QUARRY_ROAD,
      districts: [
        ...QUARRY_ROAD.districts,
        { id: 'far-field', name: 'FAR FIELD', cell: [3, 0], idea: 'Nowhere near.' },
      ],
      crossings: [
        { between: ['orchard-bend', 'old-quarry'], at: 15, kind: 'road' },
        { between: ['old-quarry', 'far-field'], at: 10, kind: 'trail' },
      ],
      exits: [{ district: 'orchard-bend', side: 'east', at: 8, name: 'Into The Quarry' }],
    };
    const problems = checkPlan(bad).join(' ');
    expect(problems).toMatch(/has to start on an even tile/);
    expect(problems).toMatch(/do not share an edge/);
    expect(problems).toMatch(/leads into another district/);
  });

  it("lays districts out from the plan's west and north edges, negative cells included", () => {
    const grown: WorldPlan = {
      ...QUARRY_ROAD,
      districts: [
        ...QUARRY_ROAD.districts,
        { id: 'west-wood', name: 'WEST WOOD', cell: [-1, 0], idea: 'A wood added later.' },
      ],
    };
    expect(districtRect(QUARRY_ROAD, 'orchard-bend')).toEqual({
      x: 0,
      y: 0,
      width: 32,
      height: 32,
    });
    expect(districtRect(grown, 'orchard-bend')).toEqual({ x: 32, y: 0, width: 32, height: 32 });
    expect(districtRect(grown, 'west-wood')).toEqual({ x: 0, y: 0, width: 32, height: 32 });
  });

  it('lays a sea cell as deep water, and refuses one on a district or outside the plan', () => {
    const coast: WorldPlan = {
      ...QUARRY_ROAD,
      districts: [
        ...QUARRY_ROAD.districts,
        { id: 'south-wood', name: 'SOUTH WOOD', cell: [0, 1], idea: 'A wood below the bend.' },
      ],
      seas: [[1, 1]],
    };
    expect(checkPlan(coast)).toEqual([]);
    const { file } = stitch(coast, files());
    expect(file.ground.slice(32).every((row) => row.slice(32) === 'W'.repeat(32))).toBe(true);
    expect(file.ground.slice(32).every((row) => row.slice(0, 32) === 'T'.repeat(32))).toBe(true);

    const wrong = checkPlan({ ...coast, seas: [[0, 1], [2, 1]] }).join(' ');
    expect(wrong).toMatch(/Cell 0,1 is a sea or a district/);
    expect(wrong).toMatch(/The sea at cell 2,1 is outside/);
  });

  it('starts a district sealed at its edge except at its openings', () => {
    const p = startDistrict(QUARRY_ROAD, 'orchard-bend');
    p.meadow(0, 0, 32, 32); // a careless stroke over everything
    const map = readTiles(p.toFile({ id: 'sealed', name: 'Sealed', dropIns: [], exits: [] }));
    // A way off the map is open at the rim on its exit's own tile and no other.
    const openings = new Set(
      openingsOf(QUARRY_ROAD, 'orchard-bend').flatMap((opening) =>
        ('exit' in opening.leadsTo ? [exitTile(32, opening)] : openingTiles(32, opening)).map(
          ([x, y]) => `${x},${y}`,
        ),
      ),
    );
    for (let i = 0; i < 32; i += 1) {
      for (const [x, y] of [
        [i, 0],
        [i, 31],
        [0, i],
        [31, i],
      ] as const) {
        expect(walkable(map, x, y), `${x},${y}`).toBe(openings.has(`${x},${y}`));
      }
    }
  });
});

describe('stitching', () => {
  it("joins the example's districts into one map that passes every check", () => {
    const { file, seams, problems } = stitch(QUARRY_ROAD, files());
    expect(problems).toEqual([]);
    expect(seams.map((seam) => seam.status)).toEqual(['joined']);
    expect(allPassed(hardChecks(file))).toBe(true);
    // The plan's two ways out stand on the map's rim; each district's stand-ins are gone.
    expect(file.exits.map((exit) => exit.name).sort()).toEqual(['Farm Lane', 'Quarry Top']);
    expect(file.exits.every((exit) => exit.x === 0 || exit.x === file.width - 1)).toBe(true);
  });

  it('plays with a district still to draw: the road runs into the wood', () => {
    const { 'orchard-bend': orchard } = files();
    const { file, seams, problems } = stitch(QUARRY_ROAD, { 'orchard-bend': orchard });
    expect(problems).toEqual([]);
    expect(seams[0].status).toBe('waiting');
    expect(checkMapFile(file).filter((check) => !check.passed)).toEqual([]);
    expect(file.ground.every((row) => row.slice(32) === 'T'.repeat(32))).toBe(true);
  });

  it('moves nothing already drawn when the plan grows a district to the west', () => {
    const grown: WorldPlan = {
      ...QUARRY_ROAD,
      districts: [
        ...QUARRY_ROAD.districts,
        { id: 'west-wood', name: 'WEST WOOD', cell: [-1, 0], idea: 'A wood added later.' },
      ],
    };
    const built = files();
    const { file } = stitch(grown, built);
    expect(file.ground.map((row) => row.slice(32, 64))).toEqual(built['orchard-bend'].ground);
  });

  it('takes a cave two districts carry alike once, and one carried differently as two places', () => {
    const built = files();
    const quarry = built['old-quarry'];
    const ladders = (quarry.links ?? []).filter((link) => link.ends.every((end) => end.area));
    const carried = { ...built['orchard-bend'], areas: quarry.areas, links: ladders };
    const alike = stitch(QUARRY_ROAD, { ...built, 'orchard-bend': carried });
    expect(alike.problems).toEqual([]);
    expect(alike.file.areas).toEqual(stitch(QUARRY_ROAD, built).file.areas);
    expect(alike.file.links).toHaveLength(quarry.links?.length ?? 0);

    const renamed = (quarry.areas ?? []).map((area) => ({ ...area, name: 'Another Cave' }));
    const { problems } = stitch(QUARRY_ROAD, {
      ...built,
      'orchard-bend': { ...carried, areas: renamed },
    });
    expect(problems.join(' ')).toMatch(/Two districts have a place called 'quarry-cave'/);
  });

  it('finds a district open at its edge where no crossing is planned', () => {
    const built = files();
    const orchard = built['orchard-bend'];
    const leaky = {
      ...orchard,
      ground: orchard.ground.map((row, y) => (y === 6 ? `${row.slice(0, 31)}.` : row)),
    };
    const { problems } = stitch(QUARRY_ROAD, { ...built, 'orchard-bend': leaky });
    expect(problems.join(' ')).toMatch(/orchard-bend is open at its edge/);
  });
});

describe('a Card Key between two districts', () => {
  const plan: WorldPlan = { ...QUARRY_ROAD, cardKey: { lock: 'old-quarry', card: 'orchard-bend' } };
  const open = (id: string) => {
    const p = startDistrict(plan, id);
    p.meadow(0, 0, 32, 32);
    return p;
  };
  const quarry = () =>
    districtFile(plan, 'old-quarry', open('old-quarry'), {
      dropIns: [{ x: 16, y: 20, name: 'Pit' }],
      exits: [{ x: 24, y: 24, name: 'Gate', opens: { when: 'key' } }],
    });
  const orchard = () =>
    districtFile(plan, 'orchard-bend', open('orchard-bend'), {
      dropIns: [{ x: 10, y: 10, name: 'Bend' }],
      itemSpots: [{ x: 8, y: 22, key: true }],
    });
  const pairing = (file: MapFile) => checkMapFile(file).find((check) => check.id === 'reachable')!.problems;

  it("walks each district alone with a stand-in for the other's half", () => {
    // The gate's district has a stand-in card on its way in from the card's...
    expect(quarry().itemSpots.filter((spot) => spot.key)).toHaveLength(1);
    expect(pairing(quarry())).toEqual([]);
    // ...and the card's district has its way toward the gate locked.
    expect(orchard().exits.find((exit) => exit.name === 'To OLD QUARRY')?.opens).toEqual({ when: 'key' });
    expect(pairing(orchard())).toEqual([]);
  });

  it('stitches the real lock and the real card, and neither stand-in', () => {
    const { file, problems } = stitch(plan, { 'old-quarry': quarry(), 'orchard-bend': orchard() });
    expect(problems).toEqual([]);
    expect(file.itemSpots.filter((spot) => spot.key)).toEqual([{ x: 8, y: 22, key: true }]);
    expect(file.exits.filter((exit) => exit.opens.when === 'key').map((exit) => exit.name)).toEqual(['Gate']);
    expect(pairing(file)).toEqual([]);
  });

  it('is two districts of the plan, never one', () => {
    expect(checkPlan({ ...QUARRY_ROAD, cardKey: { lock: 'old-quarry', card: 'old-quarry' } }).join(' ')).toMatch(
      /lies in the district it opens/,
    );
    expect(checkPlan({ ...QUARRY_ROAD, cardKey: { lock: 'nowhere', card: 'old-quarry' } }).join(' ')).toMatch(
      /names 'nowhere'/,
    );
  });
});

describe('caves', () => {
  it('draws the same floor from the same seed, and a floor you can walk all of', () => {
    const one = chamberFloor({ width: 48, height: 40, random: seeded(5) });
    const two = chamberFloor({ width: 48, height: 40, random: seeded(5) });
    expect(one.ground).toEqual(two.ground);
    const floor = {
      width: 48,
      height: 40,
      kinds: one.ground.map((row) =>
        [...row].map((letter) => (letter === 'B' ? ('rock' as const) : ('lawn' as const))),
      ),
    };
    const pieces = regions(floor, (kind) => WALKABLE_KINDS.has(kind));
    expect(pieces).toHaveLength(1);
    expect(one.loops).toBeGreaterThan(0);
  });

  it("cuts every mouth's way in through to the floor, however far the nearest room is", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const cave = caveMaze({
        floors: [{ id: 'floor', name: 'Floor', width: 48, height: 40, rooms: 3 }],
        ladders: [],
        mouths: [{ at: [4, 4], floor: 'floor' }],
        random: seeded(seed),
      });
      const ground = cave.areas[0].ground;
      const floor = {
        width: 48,
        height: 40,
        kinds: ground.map((row) =>
          [...row].map((letter) => (letter === 'B' ? ('rock' as const) : ('lawn' as const))),
        ),
      };
      expect(regions(floor, (kind) => WALKABLE_KINDS.has(kind)), `seed ${seed}`).toHaveLength(1);
    }
  });

  it('cuts a cave mouth only at the foot of a rock face', () => {
    const p = new MapProgram(16, 12, '.');
    p.rock(0, 0, 16, 4);
    const spots = caveMouthSpots(p);
    expect(spots.length).toBeGreaterThan(0);
    expect(spots.every(([, y]) => y === 3)).toBe(true);
    plantCaveMouth(p, spots[0]);
    expect(p.buildings).toEqual([{ x: spots[0][0], y: 3, kind: 'cave-mouth' }]);
  });

  it("gives the example's cave a mouth, two floors and ladders the game accepts", () => {
    const quarry = files()['old-quarry'];
    expect(quarry.areas?.map((area) => area.id)).toEqual(['quarry-cave', 'quarry-cave-b1f']);
    expect(quarry.links?.map((link) => link.ends.map((end) => end.look).join(' to '))).toEqual([
      'door to cave-exit',
      'ladder-down to ladder-up',
      'ladder-down to ladder-up',
    ]);
    expect(checkMapFile(quarry).filter((check) => !check.passed)).toEqual([]);
  });
});
