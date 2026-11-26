import { describe, expect, it } from 'vitest';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import { getBaseMap, getBaseMapFor } from './baseMap';
import { BASE_FIXTURES, everyPlaceFilled, fixtureAt, fixtureTiles, placeIndex, standingFixtures } from './fixtures';

const key = ({ x, y }: { x: number; y: number }): string => `${x},${y}`;

describe("where Brock's builds may stand", () => {
  it('starts every build where it was authored, so a save from before places stands where it stood', () => {
    for (const fixture of BASE_FIXTURES) {
      expect(fixtureAt(fixture, 0)).toBe(fixture);
      expect(placeIndex(fixture, {})).toBe(0);
    }
  });

  it('names every place, once a build', () => {
    for (const fixture of BASE_FIXTURES) {
      const names = fixture.places.map((place) => place.name);
      expect(new Set(names).size, fixture.upgradeId).toBe(names.length);
      // In capitals, as the yard's captions are (POKéMON keeps its é).
      expect(names.filter((name) => name.length === 0 || /[a-z]/.test(name.replace('POKéMON', '')))).toEqual([]);
    }
  });

  it('never puts one build where another may stand, so any two choices fit together', () => {
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    for (const placed of everyPlaceFilled()) {
      for (const tile of fixtureTiles(placed)) {
        const other = owner.get(key(tile));
        if (other && other !== placed.upgradeId) clashes.push(`${placed.upgradeId} and ${other} at ${key(tile)}`);
        owner.set(key(tile), placed.upgradeId);
      }
    }
    expect(clashes).toEqual([]);
  });

  it('moves the whole of a build, the tile it is read at with it', () => {
    const mast = BASE_FIXTURES.find((fixture) => fixture.upgradeId === 'radio-mast')!;
    const moved = fixtureAt(mast, 1);
    const dx = mast.places[1].x - mast.places[0].x;
    const dy = mast.places[1].y - mast.places[0].y;
    expect(moved.at).toEqual({ x: mast.at.x + dx, y: mast.at.y + dy });
    expect(fixtureTiles(moved).map(key)).toContain(key(moved.at));
  });

  it("draws the yard with each build where the save put it, and a place it does not have as its first", () => {
    const every = WORKSHOP_UPGRADES.map((upgrade) => upgrade.id);
    const moved = standingFixtures(every, { 'radio-mast': 1 }).find((fixture) => fixture.upgradeId === 'radio-mast')!;
    const map = getBaseMapFor({ workshopUpgrades: every, fixturePlaces: { 'radio-mast': 1 } });
    expect(map.collision[moved.at.y][moved.at.x]).toBe(true);
    const home = BASE_FIXTURES.find((fixture) => fixture.upgradeId === 'radio-mast')!.at;
    expect(map.collision[home.y][home.x]).toBe(getBaseMap([]).collision[home.y][home.x]);
    expect(standingFixtures(every, { 'radio-mast': 42 })).toEqual(standingFixtures(every));
  });
});
