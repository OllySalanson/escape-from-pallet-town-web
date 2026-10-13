import { describe, expect, it } from 'vitest';
import sampleLane from '../../maps/sample/sample-lane.json';
import { generateRunPlan, runInsertions } from '../run/runGeneration';
import { gateKey, gateStatesToVerify, isGateOpen, NIGHT_KEY, nightDoors, nightGateAt } from './gates';
import { checkMapFile } from './mapFileChecks';
import { buildPlayerMap, fileDoorGates, NIGHT_TRACK_LABEL, readMapFile, type MapFile } from './mapFile';
import { registerPlayerMap } from './playerMaps';
import { getWorldMap } from '../worldMap';

/**
 * A night track: a door the hour opens. Wood by day, a way through on a night
 * raid (`RunPlan.night`), opened by nobody and saved nowhere.
 */
const SAMPLE = sampleLane as MapFile;
// Two by two on the open grass east of the lane, a lattice cell, so by
// day it is one whole tree.
const TRACK = { kind: 'night', x: 24, y: 6, width: 2, height: 2 } as const;
const WITH_TRACK: MapFile = { ...SAMPLE, id: 'sample-lane-night', doors: [TRACK] };

describe('a night track', () => {
  it('is a door kind a file may hold, as a rectangle', () => {
    const reading = readMapFile(WITH_TRACK);
    expect(reading.ok).toBe(true);
    expect(checkMapFile(WITH_TRACK).filter((check) => !check.passed)).toEqual([]);
  });

  it('is a gate the night opens, under the one key every night track shares', () => {
    const [gate] = fileDoorGates(WITH_TRACK);
    expect(gate).toMatchObject({ night: true, label: NIGHT_TRACK_LABEL, closed: { material: 'tree' } });
    expect(gateKey(gate)).toBe(NIGHT_KEY);
    expect(isGateOpen(gate, nightDoors(false))).toBe(false);
    expect(isGateOpen(gate, nightDoors(true))).toBe(true);
    expect(nightGateAt([gate], { x: 25, y: 7 })).toBe(gate);
    expect(nightGateAt([gate], { x: 26, y: 7 })).toBeUndefined();
    // Every rule a map is held to is asked by day and again by night.
    expect(gateStatesToVerify([gate])).toEqual([[], [NIGHT_KEY]]);
  });

  it('is wood by day and walked by night', () => {
    const map = buildPlayerMap(WITH_TRACK);
    registerPlayerMap(map);
    const day = getWorldMap(map.id);
    const night = getWorldMap(map.id, nightDoors(true));
    for (const tile of fileDoorGates(WITH_TRACK, map.id)[0].tiles) {
      expect(day.collision[tile.y][tile.x], `${tile.x},${tile.y} by day`).toBe(true);
      expect(night.collision[tile.y][tile.x], `${tile.x},${tile.y} by night`).toBe(false);
    }
  });

  it('stands open for the whole of a night raid and shut for a day raid', () => {
    const map = buildPlayerMap(WITH_TRACK);
    registerPlayerMap(map);
    const insertion = runInsertions().find((entry) => entry.mapId === map.id)!;
    const plan = (night: boolean) =>
      generateRunPlan(7, undefined, insertion.id, undefined, undefined, [], {}, [], [], night);
    expect(plan(false).night).toBe(false);
    expect(plan(true).night).toBe(true);
  });
});
