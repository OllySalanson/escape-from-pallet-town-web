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
import { WORLD_GATES } from './gates';
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
      tryActivatePoi(
        rangerStation,
        true,
        activated,
        (itemId, quantity) => {
          grants.push(`${itemId}:${quantity}`);
          return true;
        },
        () => true,
      ),
    ).toBe('activated');
    expect(grants).toEqual([]);
    expect(activated).toEqual(new Set([rangerStation.id]));
    expect(tryActivatePoi(rangerStation, true, activated, () => true, () => true)).toBe('unavailable');
  });

  it('only banks the Flooded Supply Vault reward after extraction', () => {
    const extracted = new RunManager();
    extracted.startRun({ party: [], items: [] }, { mapId: 'floodplain-relay', durationMs: 60_000 });
    expect(
      tryActivatePoi(
        vault,
        true,
        new Set(),
        (itemId, quantity) => {
          extracted.registerFoundItem(itemId, quantity);
          return true;
        },
        () => true,
      ),
    ).toBe('activated');
    expect(extracted.resolveEscape().bankedItems).toEqual([
      { itemId: 'great-ball', quantity: 2 },
      { itemId: 'super-potion', quantity: 1 },
    ]);

    const wiped = new RunManager();
    wiped.startRun({ party: [], items: [] }, { mapId: 'floodplain-relay', durationMs: 60_000 });
    tryActivatePoi(
      vault,
      true,
      new Set(),
      (itemId, quantity) => {
        wiped.registerFoundItem(itemId, quantity);
        return true;
      },
      () => true,
    );
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
// Found by who she is: three bosses stand on this map as well, and "the first
// trainer listed for it" only meant Maya while she was the only one.
const maya = createRunTrainerEncounters().find(
  (encounter) => encounter.trainer.id === 'floodplain-checkpoint-maya',
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
      'SOUTH GATE by road: 79 steps',
    );
  });

  it('puts RAIDER MAYA across the road, so taking it always meets her', () => {
    // No dry route avoids the watch: the road cannot be walked for free.
    const dodged = stepsFromInsertion(union(checkpoint, tallGrass, watch), southGate.position);
    expect(dodged).toBe(-1);
    // And she is on the through-line in both directions, not just from the north.
    // The whole of the one-tile narrows, from its mouth in front of her to its head.
    expect(watchedTiles).toEqual([
      { x: 22, y: 25 },
      { x: 22, y: 24 },
      { x: 22, y: 23 },
      { x: 22, y: 22 },
    ]);
  });

  it('keeps the reeds a real way round her, at a real cost in tall grass', () => {
    // An open exit takes whoever steps on it, with no prompt, so it is a wall
    // to anyone who is not leaving - and every one of them can be open. The
    // Radio Exit once stood in the one-tile gap at the west end of the cut, so
    // working the ranger station (which stands beside the kit) turned the way
    // round her into the way out of the raid.
    const otherExits = new Set(
      EXTRACTION_POINTS.filter(
        (point) => point.mapId === map.id && point.label !== southGate.label,
      ).map((point) => key(point.position)),
    );
    const roundHer = stepsFromInsertion(union(checkpoint, watch, otherExits), southGate.position);
    expect(`round her, past every open exit: ${roundHer > 0 ? 'a route' : 'no route'}`).toBe(
      'round her, past every open exit: a route',
    );
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
    // The head of the narrows is the last tile before the watch. From it the
    // road south is a decision: go on and fight, or go back to the hut and
    // carry straight on into the reeds.
    const junction = { x: 22, y: 21 };
    expect(watch.has(key(junction))).toBe(false);
    expect(watchedTiles[watchedTiles.length - 1]).toEqual({ x: 22, y: 22 });

    const fromJunction = stepDistances(map.collision, junction, union(checkpoint, watch));
    expect(fromJunction[southGate.position.y][southGate.position.x]).toBeGreaterThan(0);
    const kit = FIRST_CONTRACT.markers[0].position;
    expect(fromJunction[kit.y][kit.x]).toBeGreaterThan(0);
  });
});

/**
 * What a fresh save can walk to. Every other reachability rule on this map is
 * asked with the gates open, and with them open anything can be reached from
 * anywhere - which is how a bench two rows deep, in a yard two rows deep, sealed
 * the front door off from its own quay for eleven commits: the Ferry Dock, the
 * route board and the boathouse could still be reached, through three bosses
 * and the keep. So this names the home bank, and walks to it with every gate
 * shut; and names what is behind a door, and fails if a redraw lets you round.
 */
describe('a fresh save, from the front door', () => {
  const shut = getWorldMap('floodplain-relay', []);
  const steps = stepDistances(shut.collision, insertion.position, new Set());
  const reaches = (tile: GridPosition): boolean => steps[tile.y][tile.x] >= 0;
  /** A sign or a person is reached by standing next to them. */
  const reachesBeside = (tile: GridPosition): boolean =>
    [
      { x: tile.x + 1, y: tile.y },
      { x: tile.x - 1, y: tile.y },
      { x: tile.x, y: tile.y + 1 },
      { x: tile.x, y: tile.y - 1 },
    ].some((beside) => shut.collision[beside.y]?.[beside.x] === false && reaches(beside));

  // The drove out of Old Town is the one piece of the ground added east and
  // south that a raid which has beaten nobody can walk to, and it is a long
  // walk: the marsh, the wharf and two more ways out, all of them past the
  // last house rather than behind a door.
  it.each(['SOUTH GATE', 'FERRY DOCK', 'RADIO EXIT', 'DROVE GATE', 'STAITHE STEPS'])('walks to the %s', (label) => {
    expect(reaches(floodplainExits.find((exit) => exit.label === label)!.position)).toBe(true);
  });

  it.each([
    'MILL RACE',
    'SIGNAL FIRE',
    'VAULT CULVERT',
    'QUARRY ROAD',
    'KILN ROAD',
    'CIDER ROAD',
    'PIER HEAD',
  ])('cannot walk to the %s', (label) => {
    expect(reaches(floodplainExits.find((exit) => exit.label === label)!.position)).toBe(false);
  });

  it('walks to every landmark on the home bank, and not to the vault or the shoal', () => {
    // The shoal's cache is behind the SURF door, which is not a door a fresh
    // save can open: nothing it fields knows the move, and the disc is a
    // barter it has not stood long enough with the Ferryman to be offered. It
    // is named here rather than filtered out, because "what a fresh save can
    // walk to" is the whole point of this file.
    const shoal = WORLD_POIS.find((poi) => poi.id === 'floodplain-shoal-cache')!;
    const behindADoor = new Set([
      vault.id,
      shoal.id,
      'floodplain-powder-house',
      'floodplain-press-house',
      'floodplain-pumping-engine',
      'floodplain-osier-store',
      'floodplain-stranded-barge',
    ]);
    const homeBank = WORLD_POIS.filter(
      (poi) => poi.mapId === 'floodplain-relay' && !behindADoor.has(poi.id),
    );
    expect(homeBank.map((poi) => poi.id).sort()).toEqual(
      [
        'floodplain-drowned-chapel',
        'floodplain-ranger-radio',
        'floodplain-shepherds-hut',
        'floodplain-staithe-crane',
      ].sort(),
    );
    for (const poi of homeBank) {
      expect(`${poi.id}: ${reaches(poi.position)}`).toBe(`${poi.id}: true`);
    }
    for (const id of behindADoor) {
      const poi = WORLD_POIS.find((candidate) => candidate.id === id)!;
      expect(`${id}: ${reaches(poi.position)}`).toBe(`${id}: false`);
    }
  });

  it('walks to every stop of the first contract', () => {
    for (const marker of FIRST_CONTRACT.markers) {
      expect(reaches(marker.position)).toBe(true);
    }
  });

  it('can stand beside every sign on the home bank', () => {
    // The boards east of the river are behind their own doors, and saying so
    // here is the point: a notice is put where a player first arrives, so the
    // list of the ones a fresh save can read is the list of places it has.
    const behindADoor = new Set(['floodplain-quarry-board', 'floodplain-kilns-notice', 'floodplain-wall-notice']);
    for (const sign of shut.entities.filter((entity) => entity.kind === 'sign')) {
      expect(`${sign.id}: ${reachesBeside(sign.position)}`).toBe(
        `${sign.id}: ${!behindADoor.has(sign.id)}`,
      );
    }
  });

  it('walks to the isle, the marsh and the wharf, and to no drop-in behind a door', () => {
    const dropIns = Object.values(RUN_INSERTIONS).filter(
      (candidate) => candidate.mapId === 'floodplain-relay' && candidate.id !== insertion.id,
    );
    expect(
      dropIns.filter((dropIn) => reaches(dropIn.position)).map((dropIn) => dropIn.id).sort(),
    ).toEqual(['floodplain-market-isle', 'floodplain-saltings', 'floodplain-staithe'].sort());
  });

  it('can reach the first boss, and only the first', () => {
    const bosses = createRunTrainerEncounters().filter(
      (encounter) => encounter.mapId === 'floodplain-relay' && encounter.bossId !== undefined,
    );
    expect(
      bosses.filter((boss) => reachesBeside(boss.position)).map((boss) => boss.bossId),
    ).toEqual(['floodplain-toll-keeper']);
  });
});

/**
 * The promise the Floodplain's doors are drawn to keep. Each boss holds two:
 * the one in front of the player, and a second that lets onto ground they
 * already know. So beating a boss is not only being let into a district - it is
 * finding out the district was nearer home than the way round to it, and the
 * keep's causeway is that turned into a reveal. A gate that only lengthens the
 * map is filler; this fails the day a redraw makes one.
 */
describe('the way back from a won district', () => {
  const TOLL = 'floodplain-toll-keeper';
  const homeBankExits = EXTRACTION_POINTS.filter(
    (point) =>
      point.mapId === 'floodplain-relay' &&
      ['SOUTH GATE', 'FERRY DOCK', 'RADIO EXIT'].includes(point.label),
  );

  /**
   * The way in is the walk through the door the boss stood at - so it is
   * measured with the district's other door left out, because on the day that
   * walk was made the other door was what the fight was for.
   */
  const wayInBy = (
    opened: readonly (readonly boolean[])[],
    backDoorId: string,
    to: GridPosition,
  ): number => {
    const backDoor = WORLD_GATES.find((gate) => gate.id === backDoorId)!;
    return stepDistances(opened, insertion.position, new Set(backDoor.tiles.map(key)))[to.y][to.x];
  };

  it.each([
    ['Mill Weir', 'floodplain-mill-weir', 'floodplain-orchard-ford', [TOLL]],
    ['Beacon Keep', 'floodplain-beacon-keep', 'floodplain-relay-causeway', [TOLL, 'floodplain-sluice-keeper']],
    ['The Vault', 'floodplain-vault', 'floodplain-vault-causeway', [TOLL, 'floodplain-orchard-warden']],
  ] as const)('is shorter than the way in was: %s', (_name, dropInId, backDoorId, beaten) => {
    const opened = getWorldMap('floodplain-relay', beaten).collision;
    const dropIn = RUN_INSERTIONS[dropInId].position;
    const wayIn = wayInBy(opened, backDoorId, dropIn);
    const fromDistrict = stepDistances(opened, dropIn, new Set());
    const wayBack = Math.min(
      ...homeBankExits
        .map((exit) => fromDistrict[exit.position.y][exit.position.x])
        .filter((steps) => steps >= 0),
    );

    expect(wayIn).toBeGreaterThan(0);
    expect(wayBack).toBeGreaterThan(0);
    expect(wayBack).toBeLessThan(wayIn);
  });

  it('puts Beacon Keep less than half as far from home as the way round to it', () => {
    // The reveal, as a number: the tower stared at from the front door turns
    // out to be next door once the causeway is out of the water.
    const opened = getWorldMap('floodplain-relay', [TOLL, 'floodplain-sluice-keeper']).collision;
    const keep = RUN_INSERTIONS['floodplain-beacon-keep'].position;
    const wayIn = wayInBy(opened, 'floodplain-relay-causeway', keep);
    const fromKeep = stepDistances(opened, keep, new Set());
    const ferry = homeBankExits.find((exit) => exit.label === 'FERRY DOCK')!.position;
    expect(fromKeep[ferry.y][ferry.x] * 2).toBeLessThan(wayIn);
    // And it is the front door it is next to, not only an exit: the quay the
    // causeway lands on is the one the raid started from.
    expect(fromKeep[insertion.position.y][insertion.position.x] * 1.5).toBeLessThan(wayIn);
  });
});
