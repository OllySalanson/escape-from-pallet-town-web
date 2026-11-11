import { describe, expect, it } from 'vitest';
import { builtInSpot } from './builtInSpots';
import { districtAt, districtsForMap } from './districts';
import { gatesForMap } from './gates';
import { builtInFileMap, fileMap } from './playerMaps';
import { createRunTrainerEncounters, TOLL_BAND } from './trainers';
import { quarterOfPlace, VALE_QUARTERS, type ValeQuarter } from './valeQuarters';
import type { GridPosition } from '../movement/gridMovement';
import { RAID_DURATION_MS } from '../run/raidClock';

/**
 * A gym's quarter is all behind its doors, and everything in it is what a team
 * that beat the gym meets (the coast hunt of 11 Nov 2026, which found the
 * quarters' file trainers still fielding first-raid toll teams, their standing
 * Pokemon under the wildlife round them, and the place caption naming a
 * quarter from the far side of its shut door).
 */

const VALE = 'greystone-vale' as const;
const places = () => districtsForMap(VALE);
const gymQuarterAt = (tile: GridPosition): ValeQuarter | undefined => {
  const place = districtAt(VALE, tile);
  const quarter = place && quarterOfPlace(place, places());
  return quarter?.gym ? quarter : undefined;
};

describe('the edges of a gym’s quarter', () => {
  /**
   * A gym's door is drawn on its quarter's seam (`tools/mapcraft/stitch.ts`),
   * so the tile in front of it and the tile behind it are in two quarters and
   * the caption never names the quarter from outside; a keeper's door inside
   * a quarter is the edge of a place of its own, so the two sides are two
   * places.
   */
  it.each(
    gatesForMap(VALE)
      .filter((gate) => 'bossId' in gate)
      .map((gate) => [gate.label, gate] as const),
  )('changes the place caption at %s, never before it', (_label, gate) => {
    const gym = VALE_QUARTERS.some((quarter) => 'bossId' in gate && quarter.gym?.bossId === gate.bossId);
    const rows = new Set(gate.tiles.map((tile) => tile.y)).size;
    // A door one row deep is crossed up and down; one column deep, across.
    const [dx, dy] = rows === 1 ? [0, 1] : [1, 0];
    const side = (tile: GridPosition) => {
      const place = districtAt(VALE, tile);
      return gym ? (place && quarterOfPlace(place, places()))?.name : place?.name;
    };
    for (const tile of gate.tiles) {
      const before = side({ x: tile.x - dx, y: tile.y - dy });
      const after = side({ x: tile.x + dx, y: tile.y + dy });
      expect(`${gate.label} ${tile.x},${tile.y}: ${before} | ${after}`).not.toBe(
        `${gate.label} ${tile.x},${tile.y}: ${before} | ${before}`,
      );
    }
  });

  /**
   * A file trainer can only field a toll team (`MAP_FILE_TRAINER_TEAMS`), so
   * nobody past a gym's doors stands in the file: every trainer there is in
   * `trainers.ts`, plays a combo two on two as the gym does, is spoken to
   * rather than watching, and is held to the quarter's band by
   * `quarterPuzzle.test.ts` instead of the toll band.
   */
  it('has no toll trainer in it: everybody there fights the way its gym does', () => {
    expect(
      (fileMap(VALE)?.trainers() ?? [])
        .filter((encounter) => gymQuarterAt(encounter.position))
        .map((encounter) => encounter.trainer.name),
    ).toEqual([]);
    const inQuarters = createRunTrainerEncounters().filter(
      (encounter) => encounter.mapId === VALE && encounter.bossId === undefined && gymQuarterAt(encounter.position),
    );
    expect(inQuarters.length).toBeGreaterThanOrEqual(10);
    for (const { trainer, sightRange } of inQuarters) {
      expect(`${trainer.name} ${trainer.ai} ${trainer.unitCount} ${sightRange ?? 0}`).toBe(`${trainer.name} gym 2 0`);
      expect(TOLL_BAND.heldElsewhere, trainer.name).toContain(trainer.id);
    }
  });

  /** A Pokemon standing past the doors is never weaker than what rolls in the grass round it. */
  it('stands no Pokemon in it under the floor of its own wildlife', () => {
    const under = (builtInFileMap(VALE)?.file.pokemon ?? []).flatMap((standing) => {
      if (standing.level === undefined) return [];
      const tile = builtInSpot(VALE, standing);
      const place = districtAt(VALE, tile);
      if (!place?.encounters || !gymQuarterAt(tile)) return [];
      const floor = Math.min(...place.encounters.entries.map((entry) => entry.minLevel));
      return standing.level < floor ? [`${standing.species} ${standing.level} in ${place.name} (floor ${floor})`] : [];
    });
    expect(under).toEqual([]);
  });
});

describe('the words at the Coast and the Wreck', () => {
  const file = () => builtInFileMap(VALE)!.file;
  const near = (spot: GridPosition, x: number, y: number) => Math.abs(spot.x - x) + Math.abs(spot.y - y) <= 16;

  /**
   * Two boats lie at the Salvage Pier from 2:00: THE ICE RUN to Frostreef, and
   * the SALVAGE LAUNCH at its end, which is a way home and ends the raid. What
   * is said about the pier names the Frostreef boat by its own name.
   */
  it('never calls the Frostreef boat "the launch"', () => {
    const launch = (file().exits ?? []).find((exit) => exit.name === 'Salvage Launch')!;
    expect(launch).toBeDefined();
    const words = [
      ...(file().signs ?? []).filter((sign) => sign.area === undefined && near(sign, launch.x, launch.y)).map((sign) => sign.lines),
      ...(file().people ?? []).filter((person) => person.area === undefined && near(person, launch.x, launch.y)).map((person) => person.lines),
    ];
    const aboutTheIslands = words.filter((lines) => /Frostreef|islands/.test(lines.join(' ')));
    expect(aboutTheIslands.length).toBeGreaterThanOrEqual(2);
    for (const lines of aboutTheIslands) {
      const said = lines.join(' ');
      expect(said).toMatch(/ICE RUN|Ice Run/);
      expect(said).not.toMatch(/[Tt]he launch (runs|for the islands|to Frostreef)/);
    }
  });

  /** The LOW WATER stair opens once and stays open (`Low Water Stair`), and its sign says so. */
  it('says the LOW WATER stair stays open once it opens', () => {
    const stair = (file().exits ?? []).find((exit) => exit.name === 'Low Water Stair')!;
    expect(stair.opens.when).toBe('after');
    const left = RAID_DURATION_MS / 1_000 - (stair.opens.when === 'after' ? stair.opens.seconds : 0);
    const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    const sign = (file().signs ?? []).find((one) => one.lines[0] === 'LOW WATER')!;
    const said = sign.lines.join(' ');
    expect(said).toContain(clock);
    expect(said).toMatch(/stays/);
    expect(said).not.toMatch(/second turn/);
  });
});
