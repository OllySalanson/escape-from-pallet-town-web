import { describe, expect, it } from 'vitest';
import type { GridPosition } from '../movement/gridMovement';
import { BASE_STAGE_HEIGHT, BASE_STAGE_WIDTH, MAX_STAGE_HEIGHT, MAX_STAGE_WIDTH } from '../display/stage';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import { FRLG_GRASS_FLOWERS_TILE } from '../world/tileset/frlgTileset';
import { BASE_LANDING, BASE_SPAWN, FLOWER_BEDS, getBaseMap } from './baseMap';
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

    it('lead down from KEEPERS’ ROW to the quay beside Bill’s, where the way down is walked', () => {
      const faults: string[] = [];
      for (let y = 14; y <= 16; y += 1) {
        for (let x = 18; x <= 21; x += 1) {
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
    ];
    /**
     * Pairs that are one place and stand together on purpose, each with why.
     * Anything else that shares a wall is two things run together.
     */
    const ONE_PLACE: readonly (readonly [BasePropName, BasePropName, string])[] = [
      ['gameCorner', 'prizeWindow', 'the prize room is the arcade’s own, next door as Celadon’s is'],
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

    it('wedges nothing small between two other things: a crate, a barrel, a sack, a statue, a sign or a bench leans on one thing at most', () => {
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
      ];
      // What something may stand against without being crowded by it: the
      // boardwalk's own edge, and planting, which belongs against a wall.
      const EDGING = new Set<BasePropName>(['railing', 'promenadeLamp', 'troughPink', 'troughYellow', 'troughRed', 'troughBlue', 'gardenFlowers']);
      // Cargo stacked against cargo is one pile, and a pile is one thing: it
      // may stand against a wall, and may not fill the gap between two.
      const CARGO = new Set<BasePropName>(['crateStack', 'barrel', 'barrelPair', 'sack']);
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
