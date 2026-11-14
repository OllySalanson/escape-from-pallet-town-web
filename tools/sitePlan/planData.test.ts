import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ANNEX_GAP,
  buildPlanData,
  columnLetter,
  gridCellFor,
  gridRef,
  titleCase,
} from './planData';
import { extractionPointsOn } from '../../src/game/world/extractionPoints';
import { insertionsOn } from '../../src/game/run/runGeneration';
import { getWorldMap } from '../../src/game/worldMap';

describe('the site plan grid', () => {
  it('letters its columns as a site plan does, past Z', () => {
    expect([0, 1, 25, 26, 27, 51, 52].map(columnLetter)).toEqual([
      'A',
      'B',
      'Z',
      'AA',
      'AB',
      'AZ',
      'BA',
    ]);
  });

  it('names a square by column letter and row number', () => {
    expect(gridRef(0, 0, 32)).toBe('A1');
    expect(gridRef(104, 158, 32)).toBe('D5');
    expect(gridRef(383, 383, 32)).toBe('L12');
  });

  it('is about a dozen squares across, on a power of two', () => {
    expect(gridCellFor(384)).toBe(32);
    expect(gridCellFor(64)).toBe(8);
  });

  it('says a sign’s capitals as a plan says a name', () => {
    expect(titleCase('THE SUNKEN QUARTER')).toBe('The Sunken Quarter');
    expect(titleCase("SMUGGLERS' COVE")).toBe("Smugglers' Cove");
    expect(titleCase('GREYSTONE CAVES B1F')).toBe('Greystone Caves B1F');
    expect(titleCase('Millbrook Center')).toBe('Millbrook Center');
  });
});

describe('the plan of Greystone Vale', () => {
  const plan = buildPlanData('greystone-vale');
  const map = getWorldMap('greystone-vale');
  const of = (kind: string) => plan.features.filter((feature) => feature.kind === kind);

  it('marks every way out and every landing the game has', () => {
    expect(
      of('exit')
        .map((exit) => exit.name.toUpperCase())
        .sort(),
    ).toEqual(
      extractionPointsOn('greystone-vale')
        .map((exit) => exit.label.toUpperCase())
        .sort(),
    );
    expect(of('landing')).toHaveLength(insertionsOn('greystone-vale').length);
  });

  it('has every room, and can say which door on the plan each is reached by', () => {
    const rooms = (map.areas ?? []).slice(1);
    expect(of('room')).toHaveLength(rooms.length);
    for (const room of of('room')) {
      expect(room.goto, room.name).toBeDefined();
      expect(room.grid, room.name).toMatch(/^Inside, door at [A-L]\d{1,2}$/);
    }
  });

  it('keeps the rooms in a block of their own, clear of the outdoors', () => {
    for (const room of of('room')) {
      expect(room.rects[0].x).toBeGreaterThanOrEqual(plan.outdoors.w + ANNEX_GAP);
      expect(room.rects[0].x + room.rects[0].w).toBeLessThanOrEqual(plan.width);
    }
  });

  it('names a building with a door by the room behind it', () => {
    const roomNames = new Set(of('room').map((room) => room.name));
    const withDoors = of('building').filter((building) => building.goto);
    expect(withDoors.length).toBeGreaterThan(40);
    for (const building of withDoors) expect(roomNames, building.name).toContain(building.name);
    expect(withDoors.map((building) => building.name)).toEqual(
      expect.arrayContaining(['Millbrook Center', 'Millbrook Mart', 'Cerulean Gym', 'Fuchsia Gym']),
    );
  });

  it('says a place is in the bigger places round it, never a smaller one inside it', () => {
    const district = (name: string) => of('district').find((feature) => feature.name === name);
    expect(district('Gull Strand')?.places).toEqual(['The Vale']);
    expect(district('The Salt Pans')?.places).toEqual(['Gull Strand', 'The Vale']);
  });

  it('names everything, and says where everything outdoors is', () => {
    for (const feature of plan.features) {
      expect(feature.name.trim(), feature.id).not.toBe('');
      const { x, y } = feature.rects[0];
      expect(x >= 0 && y >= 0 && x < plan.width && y < plan.height, feature.id).toBe(true);
      if (['exit', 'landing', 'boss', 'landmark'].includes(feature.kind) && x < plan.outdoors.w) {
        expect(feature.places.length, feature.id).toBeGreaterThan(0);
        expect(feature.grid, feature.id).toMatch(/^[A-L]\d{1,2}$/);
      }
    }
  });

  it('has the vale’s three quarters, and every gym leader on the plan', () => {
    expect(plan.quarters).toEqual(['The Vale', 'The Coast', 'The Marsh']);
    expect(of('boss').map((boss) => boss.name)).toEqual(expect.arrayContaining(['Misty', 'Koga']));
  });
});

describe('the page', () => {
  it('has the place the plan is written into', () => {
    expect(readFileSync(new URL('./viewer.html', import.meta.url), 'utf8')).toMatch(
      /\/\*__PLAN__\*\/\s*null/,
    );
  });
});
