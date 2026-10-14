import { describe, expect, it } from 'vitest';
import { makeInside } from '../maker/areas';
import { getWorldMap } from '../worldMap';
import { mayRideIn } from './bicycle';
import { stepRolls } from './localEncounters';
import { placedAreaAt } from './mapAreas';
import { checkMapFile } from './mapFileChecks';
import { buildPlayerMap, TOWER_SIZE, type MapFile, type MapFileLink } from './mapFile';
import { registerPlayerMap } from './playerMaps';
import { TOWER_GROUND } from './tileset/insideTileset';

/**
 * A floor of Lavender Town's Pokemon Tower: FireRed's own round room laid
 * cell for cell, gone into by its mat and between floors by its stairs - up on
 * the east, down on the west, where the game lets them into the edge of the
 * floor - and wild ground on every step only where a place on it says what
 * lives there, as the game's upper floors are and its ground floor is not.
 */
const W = 24;
const H = 20;
const OUTDOORS = Array.from({ length: H }, (_, y) =>
  y < 2 ? 'T'.repeat(W) : y >= H - 2 ? `${'T'.repeat(12)}..${'T'.repeat(10)}` : `TT${'.'.repeat(W - 4)}TT`,
);
// The crypt has no way in at its foot, so the nub the ground floor's mat is on is dark.
const CRYPT = TOWER_GROUND.map((row, y) => (y === 18 ? 'C'.repeat(W) : row));
const DOWN: MapFileLink = {
  ends: [
    { area: 'nave', x: 4, y: 10, toward: 'left', look: 'stairs-down' },
    { area: 'crypt', x: 18, y: 10, toward: 'right', look: 'stairs-up' },
  ],
};
const TOWER: MapFile = {
  format: 1,
  id: 'tower-floors',
  name: 'Tower Floors',
  maker: 'Escape from Pallet Town',
  width: W,
  height: H,
  ground: OUTDOORS,
  buildings: [{ x: 8, y: 2, kind: 'pokemon-tower' }],
  dropIns: [{ x: 4, y: 15, name: 'Field', description: 'A field below the tower.' }],
  exits: [{ x: 12, y: 19, name: 'Gap', opens: { when: 'always' } }],
  itemSpots: [{ x: 5, y: 12 }],
  wildlife: 'meadow',
  areas: [
    {
      id: 'nave',
      name: 'The Nave',
      kind: 'tower',
      style: 'tower',
      ...TOWER_SIZE,
      ground: TOWER_GROUND,
      buildings: [
        { x: 9, y: 2, kind: 'tower-statue' },
        { x: 7, y: 6, kind: 'tower-grave' },
      ],
    },
    {
      id: 'crypt',
      name: 'The Crypt',
      kind: 'tower',
      style: 'tower',
      ...TOWER_SIZE,
      ground: CRYPT,
      buildings: [{ x: 6, y: 8, kind: 'tower-gold-grave' }],
    },
  ],
  links: [
    {
      ends: [
        { x: 11, y: 9, toward: 'up', look: 'door' },
        { area: 'nave', x: 11, y: 18, toward: 'down', look: 'mat' },
      ],
    },
    DOWN,
  ],
  districts: [{ area: 'crypt', name: 'The Crypt', x: 0, y: 0, width: W, height: H, wildlife: 'cave' }],
};

const failing = (file: MapFile) => checkMapFile(file).filter((check) => !check.passed);

describe('a Pokemon Tower floor', () => {
  it('is FireRed’s own round room, its size and its shape', () => {
    expect(TOWER_GROUND).toHaveLength(TOWER_SIZE.height);
    expect(TOWER_GROUND.every((row) => row.length === TOWER_SIZE.width)).toBe(true);
    // The way in at its foot, and the rest of its last row the dark.
    expect(TOWER_GROUND[18].slice(10, 13)).toBe('PPP');
    expect(TOWER_GROUND[19]).toBe('C'.repeat(TOWER_SIZE.width));
  });

  it('holds a tower of two floors, a mat and its stairs', () => {
    expect(failing(TOWER)).toEqual([]);
  });

  it('lets its stairs into the edge of the floor and nowhere else', () => {
    const moved: MapFile = {
      ...TOWER,
      links: [
        TOWER.links![0],
        { ends: [{ ...DOWN.ends[0], x: 10 }, DOWN.ends[1]] },
      ],
    };
    expect(failing(moved).flatMap((check) => check.problems).join(' ')).toMatch(/west edge of the tower floor/);
  });

  it('is gone between by stairs, never a cave’s ladder', () => {
    const laddered: MapFile = {
      ...TOWER,
      links: [
        TOWER.links![0],
        { ends: [{ ...DOWN.ends[0], look: 'ladder-down' }, DOWN.ends[1]] },
      ],
    };
    expect(failing(laddered).flatMap((check) => check.problems).join(' ')).toMatch(
      /cannot be on a tower floor/,
    );
  });

  it('rolls on every step only where a place on it names its wildlife', () => {
    const map = buildPlayerMap(TOWER);
    registerPlayerMap(map);
    const world = getWorldMap(map.id);
    const floorOf = (id: string) => world.areas!.find((placed) => placed.id === id)!.rect;
    const nave = floorOf('nave');
    const crypt = floorOf('crypt');
    const middle = (rect: { x: number; y: number }) => ({ x: rect.x + 11, y: rect.y + 10 });
    expect(placedAreaAt(world.areas!, middle(crypt))?.kind).toBe('tower');
    expect(stepRolls(world, middle(crypt))).toBe(true);
    expect(stepRolls(world, middle(nave))).toBe(false);
  });

  it('keeps the Bicycle out, as FireRed does', () => {
    expect(mayRideIn('tower')).toBe(false);
  });

  it('is what the Pokemon Tower opens onto in the map maker', () => {
    const made = makeInside({ ...TOWER, areas: [], links: [], districts: [] }, 0);
    expect(made.made).toBe(true);
    if (!made.made) return;
    const inside = made.file.areas!.find((area) => area.id === made.area)!;
    expect(inside).toMatchObject({ kind: 'tower', style: 'tower', ...TOWER_SIZE });
    expect(made.file.links!.at(-1)!.ends[1]).toMatchObject({ x: 11, y: 18, look: 'mat' });
    expect(failing(made.file)).toEqual([]);
  });
});
