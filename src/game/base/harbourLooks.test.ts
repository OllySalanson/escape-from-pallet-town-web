import { describe, expect, it } from 'vitest';
import type { GridPosition } from '../movement/gridMovement';
import { BASE_STAGE_HEIGHT, BASE_STAGE_WIDTH, MAX_STAGE_HEIGHT, MAX_STAGE_WIDTH } from '../display/stage';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import { FRLG_GRASS_FLOWERS_TILE } from '../world/tileset/frlgTileset';
import { BASE_LANDING, BASE_SPAWN, FLOWER_BEDS, getBaseMap } from './baseMap';
import { DAY_CARE_PEN } from './dayCarePen';
import { harbourLifeAt, onLand } from './harbourLife';
import { harbourPlaceAt } from './harbourPlaces';
import { HARBOUR_LANDMARKS } from './landmarks';
import { BASE_TILESET, type BasePropName } from './baseTileset';
import { BASE_DOORS, doorNamed } from './doors';

/**
 * The owner, 14 Nov 2026, of the harbour after it was made walkable: "there's
 * also look and feel and spacing ... just like in the harbour, there's flowers
 * on the path and stuff ... some areas just don't really feel like they have
 * enough space ... there's just some bits where they get all a bit muddled
 * together."
 *
 * `harbourWalkable.test.ts` holds how THE HARBOUR is walked. This holds how it
 * looks and how much room its things have, as the rules a picture was judged
 * by (`docs/agents/area-passes.md`, `docs/screens/harbour-perfect/`): flowers
 * are planted and never on a way or under a roof; one path runs under the
 * walker from the Arena's forecourt to the far end of the front; nothing small
 * is wedged between two other things and no two buildings share a wall unless
 * they are one place; and what a newcomer needs is in the window they arrive in.
 *
 * And the owner the same day, of the harbour that came out of that: "I think we
 * need better building placement as well on the harbour, also like now it looks
 * a little bit sparse as well." So it also holds where the buildings stand - a
 * quay front on one building line, every door on a way, like with like - and
 * how full the place is: no bare ground, boats at their moorings, and none of
 * it on a way (`docs/screens/harbour-round2/`).
 */
const EVERY_RUNG = WORKSHOP_UPGRADES.map((upgrade) => upgrade.id);
const key = (x: number, y: number): string => `${x},${y}`;
const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Ground somebody walks along rather than across: the gravel, the stone, the boards. */
const WAY_MATERIALS = new Set(['earth', 'stone', 'boards']);

interface Thing {
  readonly name: BasePropName;
  readonly x: number;
  readonly y: number;
  /** Every tile of it that is solid. */
  readonly solid: readonly GridPosition[];
}

function thingsOn(built: readonly string[]): readonly Thing[] {
  return getBaseMap(built)
    .planted.filter((prop) => prop.name !== 'tree')
    .map((prop) => {
      const definition = BASE_TILESET.props[prop.name];
      const solid = definition.cells.flatMap((cell, index) =>
        cell.solid ? [{ x: prop.x + (index % definition.width), y: prop.y + Math.floor(index / definition.width) }] : [],
      );
      return { name: prop.name, x: prop.x, y: prop.y, solid };
    })
    .filter((thing) => thing.solid.length > 0);
}

/** The things that stand side against side with `thing`, each once. */
function leaningOn(thing: Thing, others: readonly Thing[]): readonly Thing[] {
  const beside = new Set(thing.solid.flatMap((tile) => STEPS.map(([dx, dy]) => key(tile.x + dx, tile.y + dy))));
  return others.filter((other) => other !== thing && other.solid.some((tile) => beside.has(key(tile.x, tile.y))));
}

const say = (thing: Thing): string => `${thing.name} at ${thing.x},${thing.y}`;

describe.each([
  ['nothing built', [] as readonly string[]],
  ['every rung built', EVERY_RUNG],
])('how THE HARBOUR looks, with %s', (_name, built) => {
  const map = getBaseMap(built);
  const flowerTile = BASE_TILESET.props.gardenFlowers.cells[0].tile;
  const beds = new Set(FLOWER_BEDS.flatMap((bed) => bed.tiles.map(([x, y]) => key(x, y))));

  describe('its flowers', () => {
    it('grow only where somebody planted them: no flower the lawn put there by itself', () => {
      const wild: string[] = [];
      const unplanted: string[] = [];
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          if (map.layers.ground.tiles[y][x] === FRLG_GRASS_FLOWERS_TILE) wild.push(key(x, y));
          if (map.layers.detail.tiles[y][x] === flowerTile && !beds.has(key(x, y))) unplanted.push(key(x, y));
        }
      }
      expect(wild).toEqual([]);
      expect(unplanted).toEqual([]);
    });

    it('stand on lawn, in the open: never on a way, and never half under what is built over them', () => {
      const wrong = FLOWER_BEDS.flatMap((bed) =>
        bed.tiles.flatMap(([x, y]) => {
          const faults = [
            map.terrain[y][x] !== 'grass' ? `on ${map.terrain[y][x]}` : null,
            map.layers.detail.tiles[y][x] !== flowerTile ? 'under something planted over it' : null,
            map.layers.canopy.tiles[y][x] >= 0 || map.layers.brim.tiles[y][x] >= 0 ? 'under a roof or a crown' : null,
            map.collision[y][x] ? 'shut' : null,
          ].filter((fault): fault is string => fault !== null);
          return faults.length > 0 ? [`${bed.name} ${x},${y}: ${faults.join(', ')}`] : [];
        }),
      );
      expect(wrong).toEqual([]);
    });

    it('are never in front of a door: not on its step, and not between its step and the path', () => {
      const lines = new Set(
        BASE_DOORS.flatMap((door) => {
          // Straight down from the step to the first tile of a way, which is how a door is walked up to.
          const tiles: string[] = [];
          for (let y = door.returnTo.y; y < map.height && !WAY_MATERIALS.has(map.terrain[y][door.returnTo.x]); y += 1) {
            tiles.push(key(door.returnTo.x, y));
          }
          return tiles;
        }),
      );
      expect([...beds].filter((tile) => lines.has(tile))).toEqual([]);
    });
  });

  describe('its paths', () => {
    it('run under the walker the whole way east: gravel from the forecourt to the DERBY, then stone to the course', () => {
      // The row everybody walks, from ARENA SQUARE's edge to the end of THE PROMENADE.
      const row = Array.from({ length: 87 - 14 }, (_, index) => map.terrain[13][14 + index]);
      const offPath = row.flatMap((material, index) => (material === 'earth' || material === 'stone' ? [] : [`${14 + index},13 is ${material}`]));
      expect(offPath).toEqual([]);
      // Gravel once and then stone once: it never gives out into lawn and starts again.
      const changes = row.filter((material, index) => index > 0 && material !== row[index - 1]).length;
      expect(changes).toBe(1);
    });

    it('are two rows wide all the way, with nothing planted on them', () => {
      const faults: string[] = [];
      for (let x = 14; x <= 86; x += 1) {
        // The gravel is rows 12 and 13; from where the stone walk starts in earnest it is rows 13 and 14.
        const rows = map.terrain[12][x] === 'earth' || (map.terrain[12][x] === 'stone' && map.terrain[14][x] !== 'stone') ? [12, 13] : [13, 14];
        for (const y of rows) {
          if (!WAY_MATERIALS.has(map.terrain[y][x])) faults.push(`${x},${y} is ${map.terrain[y][x]}`);
          if (map.collision[y][x]) faults.push(`${x},${y} is shut`);
          if (map.layers.detail.tiles[y][x] >= 0) faults.push(`${x},${y} has something on it`);
        }
      }
      expect(faults).toEqual([]);
    });

    it.each([
      ['beside Bill’s', 18, 21],
      ['between the warehouses and the boutique', 46, 47],
    ])('lead down from KEEPERS’ ROW to the quay %s, where the way down is walked', (_where, from, to) => {
      const faults: string[] = [];
      for (let y = 14; y <= 16; y += 1) {
        for (let x = from; x <= to; x += 1) {
          if (map.terrain[y][x] !== 'earth') faults.push(`${x},${y} is ${map.terrain[y][x]}`);
          if (map.collision[y][x] || map.layers.detail.tiles[y][x] >= 0) faults.push(`${x},${y} has something on it`);
        }
      }
      expect(faults).toEqual([]);
    });

    it('carry nothing but what is walked on: no prop stands on gravel anybody can walk', () => {
      const onGravel: string[] = [];
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          if (map.terrain[y][x] === 'earth' && !map.collision[y][x] && map.layers.detail.tiles[y][x] >= 0) onGravel.push(key(x, y));
        }
      }
      expect(onGravel).toEqual([]);
    });
  });

  describe('its spacing', () => {
    const things = thingsOn(built);
    /** A building, or something as big as one: what a gap is measured between. */
    const BUILDINGS: readonly BasePropName[] = [
      ...BASE_DOORS.map((door) => door.building.prop),
      'tower',
      'hut',
      'marketStall',
      'roundhouse',
      'warehouses',
      'derbyBoard',
      'courseGate',
      'roundFountain',
      'stoneFountain',
      'fishStall',
    ];
    /**
     * Pairs that are one place and stand together on purpose, each with why.
     * Anything else that shares a wall is two things run together.
     */
    const ONE_PLACE: readonly (readonly [BasePropName, BasePropName, string])[] = [
      ['gameCorner', 'prizeWindow', 'the prize room is the arcade’s own, next door as Celadon’s is'],
      ['fishStall', 'warehouses', 'the stall is a lean-to: its awning hangs off their wall'],
    ];
    const onePlace = (a: Thing, b: Thing): boolean =>
      ONE_PLACE.some(([first, second]) => (a.name === first && b.name === second) || (a.name === second && b.name === first));

    it('gives every building its own walls: no two stand side against side unless they are one place', () => {
      const buildings = things.filter((thing) => BUILDINGS.includes(thing.name));
      const joined = buildings.flatMap((building) =>
        leaningOn(building, buildings)
          .filter((other) => !onePlace(building, other) && say(building) < say(other))
          .map((other) => `${say(building)} against ${say(other)}`),
      );
      expect(joined).toEqual([]);
    });

    it('wedges nothing small between two other things: a crate, a barrel, a sack, a statue, a sign, a bench or a piece of fishing gear leans on one thing at most', () => {
      const SMALL: readonly BasePropName[] = [
        'crateStack',
        'barrel',
        'barrelPair',
        'sack',
        'gymStatue',
        'homeSign',
        'noticeBoard',
        'townMap',
        'bench',
        'cellarDoors',
        'lobsterPots',
        'fishCrate',
        'netRack',
        'anchor',
        'ropeCoil',
        'sandcastle',
        'seaBench',
      ];
      // What something may stand against without being crowded by it: the
      // boardwalk's own edge, and planting, which belongs against a wall.
      const EDGING = new Set<BasePropName>(['railing', 'promenadeLamp', 'troughPink', 'troughYellow', 'troughRed', 'troughBlue', 'gardenFlowers']);
      // Cargo stacked against cargo is one pile, and a pile is one thing: it
      // may stand against a wall, and may not fill the gap between two. The
      // fishing gear beside the stall is a pile the same way.
      const CARGO = new Set<BasePropName>(['crateStack', 'barrel', 'barrelPair', 'sack', 'lobsterPots', 'fishCrate', 'netRack']);
      const others = things.filter((thing) => !EDGING.has(thing.name));
      const pileOf = (thing: Thing): readonly Thing[] => {
        const pile = [thing];
        for (let index = 0; index < pile.length; index += 1) {
          for (const next of leaningOn(pile[index], others)) {
            if (CARGO.has(next.name) && CARGO.has(pile[index].name) && !pile.includes(next)) pile.push(next);
          }
        }
        return pile;
      };
      const wedged = things
        .filter((thing) => SMALL.includes(thing.name))
        .map((thing) => {
          const pile = pileOf(thing);
          const against = new Set(pile.flatMap((each) => leaningOn(each, others).filter((other) => !pile.includes(other))));
          return { thing, against: [...against] };
        })
        .filter(({ against }) => against.length > 1)
        .map(({ thing, against }) => `${say(thing)} between ${against.map(say).join(' and ')}`);
      expect(wedged).toEqual([]);
    });

    it('stands the mast clear of THE BOLTHOLE and of the Day-Care’s fence', () => {
      const mast = things.find((thing) => thing.name === 'tower');
      if (!mast) return;
      const house = things.find((thing) => thing.name === 'bolthole');
      expect(house && leaningOn(mast, [house])).toEqual([]);
      const besideMast = new Set(mast.solid.flatMap((tile) => STEPS.map(([dx, dy]) => key(tile.x + dx, tile.y + dy))));
      const fence: string[] = [];
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          if (map.terrain[y][x] === 'fence' && besideMast.has(key(x, y))) fence.push(key(x, y));
        }
      }
      expect(fence).toEqual([]);
    });
  });

  describe('where its buildings stand', () => {
    const things = thingsOn(built);
    const door = (id: string) => {
      const found = doorNamed(id);
      if (!found) throw new Error(`no door ${id}`);
      return found;
    };
    const foot = (id: string): number => door(id).building.y + BASE_TILESET.props[door(id).building.prop].height - 1;
    const warehouses = HARBOUR_LANDMARKS.find((landmark) => landmark.id === 'warehouses')!.props[0];

    it('gives the quay one front: Bill’s, the warehouses and the boutique on one building line, their doors to the water', () => {
      const fronts = [foot('bills-cottage'), warehouses.y + BASE_TILESET.props[warehouses.name].height - 1, foot('boutique')];
      expect(fronts).toEqual([fronts[0], fronts[0], fronts[0]]);
      for (const id of ['bills-cottage', 'boutique']) {
        const step = door(id).returnTo;
        expect([id, map.terrain[step.y][step.x]]).toEqual([id, 'stone']);
        // And the sea is in front of it: straight down from the step is quay, then water.
        let y = step.y;
        while (y < map.height && map.terrain[y][step.x] === 'stone') y += 1;
        expect([id, map.terrain[y]?.[step.x], y - step.y <= 3]).toEqual([id, 'water', true]);
      }
    });

    it('opens every door onto a way: no building is set back behind a lawn, but THE GREAT LIBRARY at the head of THE GREEN', () => {
      const setBack = BASE_DOORS.filter((each) => {
        const { x, y } = each.returnTo;
        return !WAY_MATERIALS.has(map.terrain[y][x]) && !WAY_MATERIALS.has(map.terrain[y + 1][x]);
      }).map((each) => each.id);
      expect(setBack).toEqual(['great-library']);
      // The library is the one building a lawn is in front of, and it stands
      // square to it: its door is on the fountain's own line, two rows of lawn between.
      const fountain = things.find((thing) => thing.name === 'roundFountain')!;
      const library = door('great-library');
      expect(library.tiles[0].x).toBe(fountain.x + 1);
      expect(fountain.y - library.returnTo.y).toBe(2);
    });

    it('stands nothing in front of a door: the step and the tile before it are open', () => {
      const shut = BASE_DOORS.filter((each) => map.collision[each.returnTo.y][each.returnTo.x] || map.collision[each.returnTo.y + 1][each.returnTo.x]).map(
        (each) => each.id,
      );
      expect(shut).toEqual([]);
    });

    it('keeps like with like: the keepers on their row, trade on the quay, the games on the front, home beside the Day-Care', () => {
      const where = (id: string): string | undefined => harbourPlaceAt(door(id).returnTo)?.id;
      expect(['pokemon-centre', 'oaks-lab', 'brocks-workshop'].map(where)).toEqual(['yard', 'yard', 'yard']);
      expect(new Set(['pokemon-centre', 'oaks-lab', 'brocks-workshop'].map(foot)).size).toBe(1);
      expect(['bills-cottage', 'boutique'].map(where)).toEqual(['quay', 'docks']);
      expect(harbourPlaceAt({ x: warehouses.x, y: warehouses.y + 4 })?.id).toBe('docks');
      expect(['battle-arena', 'game-corner', 'prize-window'].map(where)).toEqual(['promenade', 'promenade', 'promenade']);
      expect(where('great-library')).toBe('green');
      // Home and the Day-Care are neighbours: the pen starts within ten tiles of the house's door.
      expect(DAY_CARE_PEN.x - door('bolthole').returnTo.x).toBeLessThanOrEqual(10);
    });

    it('closes HARBOUR SQUARE on the east with the warehouses’ wall: the paving runs up to it', () => {
      for (let y = warehouses.y; y < warehouses.y + 3; y += 1) {
        expect([y, map.terrain[y][warehouses.x - 1]]).toEqual([y, 'stone']);
      }
    });
  });

  describe('how full it is', () => {
    const things = thingsOn(built);
    /** Out over the sea, where the sea is the thing to look at. */
    const OVER_WATER = new Set(['pleasure-pier', 'long-pier', 'breakwater']);
    /**
     * How many steps each open tile of the town is from something to look at:
     * a building, a prop, a tree, a fence, a person or a Pokémon. Open water
     * is not something: a quay with nothing on it is bare however much sea is
     * beside it, and a boat on that sea is what makes it a harbour.
     */
    const stepsFromSomething = (): number[][] => {
      const steps = Array.from({ length: map.height }, () => Array<number>(map.width).fill(Infinity));
      const queue: [number, number][] = [];
      const something = (x: number, y: number): void => {
        if (steps[y][x] === 0) return;
        steps[y][x] = 0;
        queue.push([x, y]);
      };
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          if (map.collision[y][x] && (map.terrain[y][x] !== 'water' || map.layers.detail.tiles[y][x] >= 0)) something(x, y);
        }
      }
      for (const figure of harbourLifeAt('day').filter(onLand)) something(figure.position.x, figure.position.y);
      for (let k = 0; k < queue.length; k += 1) {
        const [x, y] = queue[k];
        for (const [dx, dy] of STEPS) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || steps[ny][nx] <= steps[y][x] + 1) continue;
          steps[ny][nx] = steps[y][x] + 1;
          queue.push([nx, ny]);
        }
      }
      return steps;
    };

    it('leaves no bare ground: nowhere in the town is more than four steps from something, and little of it more than two', () => {
      const steps = stepsFromSomething();
      const open: number[] = [];
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          const place = harbourPlaceAt({ x, y });
          if (!map.collision[y][x] && place && !OVER_WATER.has(place.id)) open.push(steps[y][x]);
        }
      }
      expect(Math.max(...open)).toBeLessThanOrEqual(4);
      // Before the quay was filled 11% of the town was three steps or more from
      // anything with nothing built and 8% with everything; it is 5% and 3%,
      // and what is left is the middle of a way and the clearings Brock builds in.
      expect(open.filter((each) => each >= 3).length / open.length).toBeLessThan(0.06);
    });

    it('moors its boats: half a dozen rowing boats, every one against a quay, a jetty or the sand', () => {
      const boats = things.filter((thing) => thing.name.startsWith('rowBoat'));
      expect(boats.length).toBeGreaterThanOrEqual(6);
      const adrift = boats.filter(
        (boat) => !boat.solid.some((tile) => STEPS.some(([dx, dy]) => map.terrain[tile.y + dy]?.[tile.x + dx] !== 'water')),
      );
      expect(adrift.map(say)).toEqual([]);
    });

    it('lights and plants HARBOUR SQUARE’s way out onto the quay: a lamp and a planter either side of it, on the fountain’s line', () => {
      const fountain = things.find((thing) => thing.name === 'stoneFountain')!;
      const middle = fountain.x + 1;
      const lamps = things.filter((thing) => thing.name === 'promenadeLamp' && thing.y === fountain.y + 3).map((thing) => thing.x - middle);
      expect(lamps.sort((a, b) => a - b)).toEqual([-2, 2]);
      // And the way between them is open, three wide.
      expect([-1, 0, 1].filter((dx) => map.collision[fountain.y + 3][middle + dx])).toEqual([]);
    });

    it('stands a stall where the boats land: the fish stall against the warehouses, with its keeper beside it', () => {
      const stall = things.find((thing) => thing.name === 'fishStall')!;
      const wall = things.find((thing) => thing.name === 'warehouses')!;
      expect(leaningOn(stall, [wall])).toEqual([wall]);
      const monger = harbourLifeAt('day').find((figure) => figure.id === 'fishmonger')!;
      expect(Math.abs(monger.position.x - (stall.x + 3)) + Math.abs(monger.position.y - stall.y)).toBe(0);
    });
  });

  describe('what is in the window on arrival', () => {
    /** The tiles a window of this many game pixels shows, the camera on `at` and kept inside the map. */
    const windowOn = (at: GridPosition, width: number, height: number) => {
      const across = width / 16;
      const down = height / 16;
      const left = Math.min(Math.max(at.x + 0.5 - across / 2, 0), map.width - across);
      const top = Math.min(Math.max(at.y + 0.5 - down / 2, 0), map.height - down);
      return (tile: GridPosition): boolean => tile.x >= left && tile.x + 1 <= left + across && tile.y >= top && tile.y + 1 <= top + down;
    };
    const doorTile = (id: string): GridPosition => {
      const door = doorNamed(id);
      if (!door) throw new Error(`no door ${id}`);
      return door.tiles[0];
    };

    it('shows a new visit the Arena’s door, the Center’s, the lab’s and Bill’s at once, on the smallest screen there is', () => {
      const shown = windowOn(BASE_SPAWN, BASE_STAGE_WIDTH, BASE_STAGE_HEIGHT);
      expect(['raid-arena', 'pokemon-centre', 'oaks-lab', 'bills-cottage'].filter((id) => !shown(doorTile(id)))).toEqual([]);
    });

    it('shows a raid come home the Arena’s door and Bill’s, on the smallest screen there is', () => {
      const shown = windowOn(BASE_LANDING, BASE_STAGE_WIDTH, BASE_STAGE_HEIGHT);
      expect(['raid-arena', 'bills-cottage'].filter((id) => !shown(doorTile(id)))).toEqual([]);
    });

    it('shows a new visit the whole of the Arena, the Center, the lab and Bill’s cottage on the largest', () => {
      const shown = windowOn(BASE_SPAWN, MAX_STAGE_WIDTH, MAX_STAGE_HEIGHT);
      const cut = ['raid-arena', 'pokemon-centre', 'oaks-lab', 'bills-cottage'].filter((id) => {
        const door = doorNamed(id);
        if (!door) return true;
        const building = BASE_TILESET.props[door.building.prop];
        return !shown({ x: door.building.x, y: door.building.y }) || !shown({ x: door.building.x + building.width - 1, y: door.building.y + building.height - 1 });
      });
      expect(cut).toEqual([]);
    });
  });
});
