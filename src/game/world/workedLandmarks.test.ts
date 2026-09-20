import { describe, expect, it } from 'vitest';
import {
  exitsOpenForGood,
  isLandmarkWorked,
  withWorkedExitsOpen,
  workLeftByContract,
  workedLandmarkCaption,
  workedLandmarksOn,
  WORKED_LANDMARKS,
} from './workedLandmarks';
import { EXTRACTION_POINTS, extractionCaption, isExtractionAvailable } from './extractionPoints';
import { WORLD_POIS } from './pois';
import { RAID_CONTRACTS } from '../objectives/contracts';
import { DEFAULT_RAID_PROGRESS } from '../save/SaveManager';
import { getWorldMap } from '../worldMap';
import { MINIMAP_PALETTE } from './minimap';
import { frontDoorFor, generateRunPlan } from '../run/runGeneration';
import { buildDropInBriefing, placePicture, type DropInContext } from '../hub/dropIn';

const poiOf = (poiId: string) => WORLD_POIS.find((poi) => poi.id === poiId)!;
const everyContract = RAID_CONTRACTS.map((contract) => contract.id);

/**
 * The map is meant to carry what a contract finished. These hold the two halves
 * of that: the authored rows are honest about the landmark and the contract
 * they name, and the world they produce is the world every other screen reads.
 */
describe('a landmark the world keeps worked', () => {
  it('names a landmark that exists, and a contract on that landmark’s own map', () => {
    for (const work of WORKED_LANDMARKS) {
      const poi = WORLD_POIS.find((candidate) => candidate.id === work.poiId);
      const contract = RAID_CONTRACTS.find((candidate) => candidate.id === work.contractId);
      expect(`${work.poiId}: landmark ${poi ? 'exists' : 'missing'}`).toBe(
        `${work.poiId}: landmark exists`,
      );
      expect(`${work.contractId}: contract ${contract ? 'exists' : 'missing'}`).toBe(
        `${work.contractId}: contract exists`,
      );
      // A contract banked on one map may not finish a landmark on another: the
      // player has to have stood there, or the map carries work nobody did.
      expect(`${work.poiId} on ${poi!.mapId}`).toBe(`${work.poiId} on ${contract!.mapId}`);
    }
  });

  it('gives one contract one landmark, and one landmark one contract', () => {
    const poiIds = WORKED_LANDMARKS.map((work) => work.poiId);
    const contractIds = WORKED_LANDMARKS.map((work) => work.contractId);
    expect(new Set(poiIds).size).toBe(poiIds.length);
    expect(new Set(contractIds).size).toBe(contractIds.length);
  });

  /**
   * The survey's warning about contracts applies here: a changed object has to
   * change a route, a risk or a reward or it is scenery. Every landmark in this
   * game that is worth finishing seals a way out, so that is the rule - and it
   * is the exit that makes the finished landmark worth anything.
   */
  it('changes a route: every finished landmark holds a way out open', () => {
    for (const work of WORKED_LANDMARKS) {
      const poi = poiOf(work.poiId);
      expect(`${work.poiId}: ${poi.effect ?? 'nothing'}`).toBe(`${work.poiId}: unlock-extraction`);
      expect(
        EXTRACTION_POINTS.some(
          (point) => point.mapId === poi.mapId && point.label === poi.unlockedExtractionLabel,
        ),
      ).toBe(true);
    }
  });

  it('gives every map in the game one, so no map is the one that never changes', () => {
    const maps = new Set(WORKED_LANDMARKS.map((work) => poiOf(work.poiId).mapId));
    expect([...maps].sort()).toEqual(
      ['floodplain-relay', 'pallet-town', 'route-1', 'viridian-forest'],
    );
  });

  it('says on the result screen exactly which door it opened', () => {
    for (const work of WORKED_LANDMARKS) {
      const exit = poiOf(work.poiId).unlockedExtractionLabel!;
      expect(`${work.contractId}: ${work.note.includes(exit) ? exit : work.note}`).toBe(
        `${work.contractId}: ${exit}`,
      );
    }
  });

  it('holds its caption to the width every other map caption is held to', () => {
    // The same rule and the same number as `extractionPoints.test.ts`: a wider
    // window than this has nowhere to sit on the base stage.
    const longestNameOnAMap = 'HELD BY SLUICE KEEPER DANE'.length;
    for (const work of WORKED_LANDMARKS) {
      const lines = workedLandmarkCaption(poiOf(work.poiId), work).split('\n');
      const widest = Math.max(...lines.map((line) => line.length));
      expect(`${work.poiId}: ${lines.length} lines, ${widest} wide`).toBe(
        `${work.poiId}: ${Math.min(lines.length, 3)} lines, ${Math.min(widest, longestNameOnAMap)} wide`,
      );
    }
  });
});

describe('the world a fresh save walks into', () => {
  it('has finished nothing, so every sealed exit is still sealed', () => {
    expect(DEFAULT_RAID_PROGRESS.completedContracts).toEqual([]);
    for (const work of WORKED_LANDMARKS) {
      expect(isLandmarkWorked(work.poiId, DEFAULT_RAID_PROGRESS.completedContracts)).toBeUndefined();
    }
    const points = withWorkedExitsOpen(EXTRACTION_POINTS, DEFAULT_RAID_PROGRESS.completedContracts);
    expect(points).toEqual(EXTRACTION_POINTS);
    for (const point of points) {
      if (point.requirement?.kind === 'poi-activated') {
        expect(isExtractionAvailable(point, 300_000, new Set())).toBe(false);
      }
    }
  });
});

describe('the world a contract leaves behind', () => {
  it('opens the landmark’s own exit from the first second, and nothing else', () => {
    for (const work of WORKED_LANDMARKS) {
      const poi = poiOf(work.poiId);
      const opened = withWorkedExitsOpen(EXTRACTION_POINTS, [work.contractId]);
      const changed = opened.filter(
        (point, index) => point.requirement !== EXTRACTION_POINTS[index].requirement,
      );
      expect(changed.map((point) => `${point.mapId}/${point.label}`)).toEqual([
        `${poi.mapId}/${poi.unlockedExtractionLabel}`,
      ]);
      // Open with nothing activated this raid, and at zero on the clock.
      expect(isExtractionAvailable(changed[0], 0, new Set())).toBe(true);
      expect(extractionCaption(changed[0], true, 0)).toBe(
        `${poi.unlockedExtractionLabel}\nEXTRACT OPEN`,
      );
    }
  });

  it('never opens an exit that was waiting on the clock rather than on a landmark', () => {
    const opened = withWorkedExitsOpen(EXTRACTION_POINTS, everyContract);
    EXTRACTION_POINTS.forEach((point, index) => {
      if (point.requirement?.kind !== 'poi-activated') {
        expect(`${point.mapId}/${point.label}`).toBe(`${opened[index].mapId}/${opened[index].label}`);
        expect(opened[index]).toBe(point);
      }
    });
  });

  it('leaves the landmark standing, so the map is where you read your own work', () => {
    for (const work of WORKED_LANDMARKS) {
      const poi = poiOf(work.poiId);
      const map = getWorldMap(poi.mapId);
      expect(map.pois.some((candidate) => candidate.id === work.poiId)).toBe(true);
      expect(workedLandmarkCaption(poi, work).startsWith(`${poi.label}\n`)).toBe(true);
    }
  });

  it('is the same world however many times it is asked for', () => {
    const once = withWorkedExitsOpen(EXTRACTION_POINTS, everyContract);
    expect(withWorkedExitsOpen(once, everyContract)).toEqual(once);
  });

  it('costs Route 1 the cache it also stops sealing, which is the one that is a trade', () => {
    const paying = WORKED_LANDMARKS.filter((work) => poiOf(work.poiId).reward.length > 0);
    expect(paying.map((work) => work.poiId)).toEqual(['oak-field-station-relay']);
    // The cache is real, so the mark is a real price: it is a standing supply
    // of two Poke Balls and a Potion, handed out on every raid until now.
    expect(poiOf('oak-field-station-relay').reward).toEqual([
      { itemId: 'poke-ball', quantity: 2 },
      { itemId: 'potion', quantity: 1 },
    ]);
    expect(paying[0].standing).toContain('CACHE EMPTY');
  });
});

describe('what the rest of the game reads off it', () => {
  it('lists a map’s finished landmarks and its opened exits from the one list', () => {
    for (const work of WORKED_LANDMARKS) {
      const poi = poiOf(work.poiId);
      const mapId = poi.mapId;
      expect(workedLandmarksOn(mapId, [work.contractId])).toEqual([work]);
      expect(exitsOpenForGood(mapId, [work.contractId])).toEqual([poi.unlockedExtractionLabel]);
      expect(workedLandmarksOn(mapId, [])).toEqual([]);
      expect(exitsOpenForGood(mapId, [])).toEqual([]);
    }
  });

  it('hands the result screen the work its own contract left', () => {
    for (const work of WORKED_LANDMARKS) {
      expect(workLeftByContract(work.contractId)).toBe(work);
    }
    expect(workLeftByContract('no-such-contract')).toBeUndefined();
  });

  /**
   * The lobby promises and the raid delivers, off the same list. These used to
   * be able to disagree: the screen read the authored exits and the raid read
   * the plan, so a door that was open in the field still said WORK RANGER
   * STATION on the way in.
   */
  it('opens the door in the raid the lobby promised it in, and says so at base', () => {
    for (const work of WORKED_LANDMARKS) {
      const poi = poiOf(work.poiId);
      const mapId = poi.mapId;
      const insertionId = frontDoorFor(mapId)!.id;
      const plan = generateRunPlan(
        0x5eed_1234,
        undefined,
        insertionId,
        undefined,
        undefined,
        [],
        {},
        [work.contractId],
      );
      const inTheRaid = plan.extractionPoints.find(
        (point) => point.label === poi.unlockedExtractionLabel,
      )!;
      expect(isExtractionAvailable(inTheRaid, 0, new Set())).toBe(true);
      expect(plan.completedContracts).toEqual([work.contractId]);

      const context: DropInContext = {
        map: getWorldMap(mapId),
        defeatedBosses: [],
        openedGates: [],
        completedContracts: [work.contractId],
        raidRecord: undefined,
        surveyed: undefined,
        insertionIds: [insertionId],
        partyLevels: [],
        contract: undefined,
      };
      const atBase = buildDropInBriefing(insertionId, context).exits.find(
        (exit) => exit.label === poi.unlockedExtractionLabel,
      )!;
      expect(`${poi.unlockedExtractionLabel}: ${atBase.opens}, worked ${atBase.worked === true}`).toBe(
        `${poi.unlockedExtractionLabel}: OPEN, worked true`,
      );
      // And the picture the screen leads with carries it, lit and glyphed, on
      // ground the survey has never reached.
      const picture = placePicture(insertionId, context);
      expect(picture.rows[poi.position.y][poi.position.x]).toBe('K');
      expect(
        placePicture(insertionId, { ...context, completedContracts: [] }).rows[poi.position.y][
          poi.position.x
        ],
      ).not.toBe('K');
    }
  });

  it('has an ink for the glyph the lobby’s map draws it with', () => {
    expect(MINIMAP_PALETTE.K).toBeDefined();
    expect(MINIMAP_PALETTE.K).not.toBe(MINIMAP_PALETTE.X);
    expect(MINIMAP_PALETTE.K).not.toBe(MINIMAP_PALETTE.O);
  });
});
