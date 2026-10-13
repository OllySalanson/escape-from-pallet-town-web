import { describe, expect, it } from 'vitest';
import { fileLedges } from '../../../../src/game/world/mapFile';
import { allPassed, hardChecks } from '../../checks';
import { stitch } from '../../stitch';
import { readTiles, walkable, walkingSteps } from '../../tiles';
import { districtRect, planLimits } from '../../worldPlan';
import { DEEPEST_FLOOR, greystoneCaves, greystoneDeep } from './greystoneCaves';
import greystoneVale from '.';
import { GREYSTONE_VALE } from './plan';
import { stormcrown } from './stormcrown';

/**
 * Stormcrown, the summit above the peaks: a far place reached only from the
 * Greystone Caves' sixth floor (`plan.ts`), held here to what its brief
 * promises - the way in, the climb, and Mew on the top.
 */
describe('Stormcrown', () => {
  const { file } = stormcrown();

  it('passes every hard check on its own, as the game’s own map', () => {
    const checks = hardChecks(file, { limits: planLimits(GREYSTONE_VALE) });
    expect(checks.filter((check) => !check.passed)).toEqual([]);
    expect(allPassed(checks)).toBe(true);
  });

  it('adds B5F under the five floors that ship, and moves none of them', () => {
    const cave = greystoneCaves();
    expect(cave.areas.map((area) => area.id)).not.toContain(DEEPEST_FLOOR);
    expect(file.areas?.map((area) => area.id)).toEqual([...cave.areas.map((area) => area.id), DEEPEST_FLOOR]);
    // Carried here as every other district with a mouth carries them, letter for letter.
    expect(file.areas?.slice(0, cave.areas.length)).toEqual(cave.areas);
  });

  it('joins B5F to the rest by one hole, in the corner of B4F furthest from the sea cave', () => {
    const { hole } = greystoneDeep();
    expect(hole.ends[0]).toMatchObject({ area: 'greystone-caves-b4f', look: 'ladder-down' });
    expect(hole.ends[1]).toMatchObject({ area: DEEPEST_FLOOR, look: 'ladder-up' });
    const intoDeep = (file.links ?? []).filter((link) => link.ends.some((end) => end.area === DEEPEST_FLOOR));
    // The hole down, and the way out onto the Chimney.
    expect(intoDeep).toHaveLength(2);
    expect(intoDeep.filter((link) => link.ends.some((end) => end.area === undefined))).toHaveLength(1);
  });

  it('is reached from the vale only through the caves: no road comes up the mountain', () => {
    const world = greystoneVale();
    const { file: vale } = stitch(
      world.plan,
      Object.fromEntries(Object.entries(world.districts).map(([id, result]) => [id, result.file])),
    );
    const map = readTiles(vale);
    const summit = districtRect(GREYSTONE_VALE, 'stormcrown');
    const onFoot = vale.dropIns
      .filter((dropIn) => dropIn.area === undefined)
      .map((dropIn) => walkingSteps(map, [dropIn.x, dropIn.y], { hops: true }));
    for (let y = summit.y; y < summit.y + summit.height; y += 1) {
      for (let x = summit.x; x < summit.x + summit.width; x += 1) {
        if (walkable(map, x, y)) expect(onFoot.every((steps) => steps[y][x] === -1), `${x},${y}`).toBe(true);
      }
    }
  });

  it('is a climb the ledges only shorten going down', () => {
    const map = readTiles(file);
    const chimney = file.buildings.find((building) => building.kind === 'cave-mouth')!;
    const foot: [number, number] = [chimney.x, chimney.y + 1];
    const mew = file.pokemon!.find((standing) => standing.species === 'mew')!;
    const top: [number, number] = [mew.x, mew.y + 1];
    const up = walkingSteps(map, foot, { hops: true })[top[1]][top[0]];
    const downByLedges = walkingSteps(map, top, { hops: true })[foot[1]][foot[0]];
    const downOnFoot = walkingSteps(map, top)[foot[1]][foot[0]];
    // Every ledge hops south, down the mountain.
    expect(fileLedges(file).every((ledge) => ledge.drop === 'down')).toBe(true);
    expect(fileLedges(file).length).toBeGreaterThanOrEqual(3);
    // Up is the long way round the crags, and the ledges cannot help it.
    expect(walkingSteps(map, foot)[top[1]][top[0]]).toBe(up);
    expect(up).toBeGreaterThan(120);
    // Down, the ledges cut the climb by more than half.
    expect(downByLedges).toBeLessThan(downOnFoot / 2);
  });

  it('stands Mew on a dead end beside the cairn, as a legend', () => {
    const mew = file.pokemon!.find((standing) => standing.species === 'mew')!;
    expect(mew).toMatchObject({ level: 50, legendary: true });
    const map = readTiles(file);
    const open = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].filter(([dx, dy]) => walkable(map, mew.x + dx, mew.y + dy));
    expect(open).toHaveLength(1);
    expect(file.buildings.some((building) => building.kind === 'strange-stone')).toBe(true);
  });

  it('is in the storm everywhere, on the summit table', () => {
    const world = greystoneVale();
    const { file: vale } = stitch(
      world.plan,
      Object.fromEntries(Object.entries(world.districts).map(([id, result]) => [id, result.file])),
    );
    const summit = districtRect(GREYSTONE_VALE, 'stormcrown');
    const places = (vale.districts ?? []).filter(
      (place) => place.area === undefined && place.x >= summit.x && place.y >= summit.y && place.x < summit.x + summit.width && place.y < summit.y + summit.height,
    );
    expect(places.map((place) => place.name)).toEqual(['THE CAIRN', 'THE CHIMNEY', 'STORMCROWN']);
    expect(places.every((place) => place.rain === true && place.wildlife === 'summit')).toBe(true);
  });
});
