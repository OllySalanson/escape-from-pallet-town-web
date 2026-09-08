import { describe, expect, it } from 'vitest';
import { RunManager } from '../run/RunManager';
import { FIRST_CONTRACT, RAID_CONTRACTS } from '../objectives';
import { RUN_INSERTIONS } from '../run/runGeneration';
import type { GridPosition } from '../movement/gridMovement';
import { getWorldMap } from '../worldMap';
import {
  extractionRequirementText,
  isExtractionAvailable,
  EXTRACTION_POINTS,
} from './extractionPoints';
import { stepDistances } from './mapStructure';
import { tryActivatePoi, WORLD_POIS } from './pois';
import { trainerSightTiles } from './trainerSight';
import { createRunTrainerEncounters } from './trainers';

const floodplainExits = EXTRACTION_POINTS.filter((point) => point.mapId === 'floodplain-relay');
const vault = WORLD_POIS.find((poi) => poi.id === 'floodplain-supply-vault')!;
const rangerStation = WORLD_POIS.find((poi) => poi.id === 'floodplain-ranger-radio')!;

describe('Floodplain Relay', () => {
  it('keeps South Gate dependable, Ferry Dock timed, and Radio Exit station-activated', () => {
    const [southGate, ferryDock, radioExit] = floodplainExits;
    const inactive = new Set<string>();

    expect(isExtractionAvailable(southGate, 0, inactive)).toBe(true);
    expect(isExtractionAvailable(ferryDock, 44_999, inactive)).toBe(false);
    expect(extractionRequirementText(ferryDock, 44_999)).toBe('OPENS IN 1s');
    expect(isExtractionAvailable(ferryDock, 45_000, inactive)).toBe(true);
    expect(isExtractionAvailable(radioExit, 60_000, inactive)).toBe(false);
    expect(extractionRequirementText(radioExit, 60_000)).toBe('ACTIVATE RANGER STATION');

    inactive.add(rangerStation.id);
    expect(isExtractionAvailable(radioExit, 0, inactive)).toBe(true);
  });

  it('activates the Ranger Station without granting a cache and retains its radio state', () => {
    const activated = new Set<string>();
    const grants: string[] = [];

    expect(
      tryActivatePoi(rangerStation, true, activated, (itemId, quantity) => {
        grants.push(`${itemId}:${quantity}`);
        return true;
      }),
    ).toBe('activated');
    expect(grants).toEqual([]);
    expect(activated).toEqual(new Set([rangerStation.id]));
    expect(tryActivatePoi(rangerStation, true, activated, () => true)).toBe('unavailable');
  });

  it('only banks the Flooded Supply Vault reward after extraction', () => {
    const extracted = new RunManager();
    extracted.startRun({ party: [], items: [] }, { mapId: 'floodplain-relay', durationMs: 60_000 });
    expect(
      tryActivatePoi(vault, true, new Set(), (itemId, quantity) => {
        extracted.registerFoundItem(itemId, quantity);
        return true;
      }),
    ).toBe('activated');
    expect(extracted.resolveEscape().bankedItems).toEqual([
      { itemId: 'great-ball', quantity: 2 },
      { itemId: 'super-potion', quantity: 1 },
    ]);

    const wiped = new RunManager();
    wiped.startRun({ party: [], items: [] }, { mapId: 'floodplain-relay', durationMs: 60_000 });
    tryActivatePoi(vault, true, new Set(), (itemId, quantity) => {
      wiped.registerFoundItem(itemId, quantity);
      return true;
    });
    const wipeResult = wiped.resolveWipe();
    expect(wipeResult.bankedItems).toEqual([]);
    expect(wipeResult.lostItems).toEqual([
      { itemId: 'great-ball', quantity: 2 },
      { itemId: 'super-potion', quantity: 1 },
    ]);
  });
});


/**
 * The choice the map exists to create: a fast road that costs a fight, or slow
 * reeds that cost encounters.
 *
 * These are route facts, not wording, so they are asserted on the built map
 * rather than eyeballed. What they pin is the shape of the decision - the road
 * has to stay walkable, has to stay short, and has to stay unusable without
 * meeting RAIDER MAYA; the reeds have to stay a genuine way round her; and the
 * price has to be readable from a junction the player can still turn at.
 *
 * The two that matter most both failed before the checkpoint became a watch. A
 * trainer standing in a one-tile lane blocks it, so there was no dry route at
 * all: the road was not a fast, dangerous option, it was shut, and the reeds
 * were the only way south for anyone who wanted to pass without volunteering
 * for a fight nobody had to start.
 */
const map = getWorldMap('floodplain-relay');
const insertion = Object.values(RUN_INSERTIONS).find(
  (candidate) => candidate.mapId === 'floodplain-relay',
)!;
const southGate = EXTRACTION_POINTS.find(
  (point) => point.mapId === 'floodplain-relay' && point.label === 'SOUTH GATE',
)!;
const maya = createRunTrainerEncounters().find(
  (encounter) => encounter.mapId === 'floodplain-relay',
)!;

const key = (tile: GridPosition): string => `${tile.x},${tile.y}`;
const isSightBlocked = (tile: GridPosition): boolean => map.collision[tile.y]?.[tile.x] !== false;
const watchedTiles = trainerSightTiles(maya, isSightBlocked);
const watch = new Set(watchedTiles.map(key));

/** Signs and townsfolk stand in their own tile, exactly as the engine has them. */
const bodies = new Set(map.entities.map((entity) => key(entity.position)));
/** Maya's own tile, which the player cannot walk through either. */
const checkpoint = new Set([...bodies, key(maya.position)]);
const tallGrass = new Set<string>(
  map.tallGrass.flatMap((row, y) =>
    row.flatMap((isGrass, x) => (isGrass ? [`${x},${y}`] : [])),
  ),
);

const union = (...sets: ReadonlySet<string>[]): Set<string> =>
  new Set(sets.flatMap((set) => [...set]));

const stepsFromInsertion = (blocked: Set<string>, to: GridPosition): number =>
  stepDistances(map.collision, insertion.position, blocked)[to.y][to.x];

describe('the Floodplain checkpoint', () => {
  it('leaves the road walkable, so the fast route is an option and not a shut door', () => {
    // Dry: never a step in tall grass. This is the road, and it has to exist.
    const dry = stepsFromInsertion(union(checkpoint, tallGrass), southGate.position);
    expect(`SOUTH GATE by road: ${dry < 0 ? 'unreachable' : `${dry} steps`}`).toBe(
      'SOUTH GATE by road: 37 steps',
    );
  });

  it('puts RAIDER MAYA across the road, so taking it always meets her', () => {
    // No dry route avoids the watch: the road cannot be walked for free.
    const dodged = stepsFromInsertion(union(checkpoint, tallGrass, watch), southGate.position);
    expect(dodged).toBe(-1);
    // And she is on the through-line in both directions, not just from the north.
    expect(watchedTiles).toEqual([
      { x: 15, y: 16 },
      { x: 15, y: 15 },
      { x: 15, y: 14 },
    ]);
  });

  it('keeps the reeds a real way round her, at a real cost in tall grass', () => {
    const roundHer = stepsFromInsertion(union(checkpoint, watch), southGate.position);
    expect(roundHer).toBeGreaterThan(0);
    // Slower than the road, which is what makes paying her a choice rather than
    // a tax. If this ever inverts, the road has stopped being the fast route.
    const dry = stepsFromInsertion(union(checkpoint, tallGrass), southGate.position);
    expect(roundHer).toBeGreaterThan(dry);
  });

  it('never watches a tile the player has no say about standing on', () => {
    expect(watch.has(key(insertion.position))).toBe(false);
    for (const point of EXTRACTION_POINTS.filter((candidate) => candidate.mapId === map.id)) {
      expect(`${point.label} watched: ${watch.has(key(point.position))}`).toBe(
        `${point.label} watched: false`,
      );
    }
    // Every stop of every contract on this map, not just the first contract's:
    // a landmark or objective inside the watch is one a player cannot decline,
    // and there is now more than one contract that could be authored into it.
    for (const contract of RAID_CONTRACTS.filter((candidate) => candidate.mapId === map.id)) {
      for (const marker of contract.markers) {
        expect(`${contract.id}/${marker.id} watched: ${watch.has(key(marker.position))}`).toBe(
          `${contract.id}/${marker.id} watched: false`,
        );
      }
    }
    for (const poi of map.pois) {
      expect(`${poi.label} watched: ${watch.has(key(poi.position))}`).toBe(
        `${poi.label} watched: false`,
      );
    }
  });

  it('is seen from a junction the player can still turn back at', () => {
    // The vault turn is the last tile before the watch. From it the road south
    // is a decision: go on and fight, or go back and take the reeds.
    const junction = { x: 15, y: 13 };
    expect(watch.has(key(junction))).toBe(false);
    expect(watchedTiles[watchedTiles.length - 1]).toEqual({ x: 15, y: 14 });

    const fromJunction = stepDistances(map.collision, junction, union(checkpoint, watch));
    expect(fromJunction[southGate.position.y][southGate.position.x]).toBeGreaterThan(0);
    const kit = FIRST_CONTRACT.markers[0].position;
    expect(fromJunction[kit.y][kit.x]).toBeGreaterThan(0);
  });
});
