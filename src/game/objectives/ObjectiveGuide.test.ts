import { describe, expect, it } from 'vitest';
import { Pokemon, BULBASAUR } from '../pokemon';
import { RunManager } from '../run';
import { createActiveRunSession } from '../run/RunSession';
import { generateRunPlan, RUN_INSERTIONS, type RunInsertionId } from '../run/runGeneration';
import { FIRST_CONTRACT } from './contracts';
import { objectivesForContract } from './RunObjectives';
import { buildObjectiveGuide } from './ObjectiveGuide';
import { EXTRACTION_POINTS } from '../world/extractionPoints';
import { WORLD_POIS, poisForMap } from '../world/pois';
import type { WorldMapId } from '../worldMap';

function createFirstContractSession() {
  const manager = new RunManager();
  manager.startRun(
    { party: [new Pokemon(BULBASAUR, 5)], items: [] },
    { mapId: 'floodplain-relay', durationMs: 60_000 },
  );
  return createActiveRunSession(
    manager,
    {},
    {},
    [],
    [],
    objectivesForContract(FIRST_CONTRACT),
    generateRunPlan(42, undefined, 'floodplain-relay', FIRST_CONTRACT),
  );
}

/** A raid with no contract left to run, which is when the guide falls back to the map's own landmarks. */
function createUncontractedSession(insertionId: RunInsertionId) {
  const manager = new RunManager();
  manager.startRun(
    { party: [new Pokemon(BULBASAUR, 5)], items: [] },
    { mapId: RUN_INSERTIONS[insertionId].mapId, durationMs: 60_000 },
  );
  return createActiveRunSession(
    manager,
    {},
    {},
    [],
    [],
    [],
    generateRunPlan(42, undefined, insertionId, undefined),
  );
}

describe('objective field guide', () => {
  it('binds objective completion and rewards to the live run snapshot', () => {
    const session = createFirstContractSession();

    expect(buildObjectiveGuide(session, {
      currentMapId: 'floodplain-relay',
      currentPosition: { x: 15, y: 3 },
      activatedPoiIds: new Set(),
    }).objectives).toEqual([
      expect.objectContaining({
        description: 'Recover the lost field kit at the Floodplain Relay',
        progress: '0/1',
        complete: false,
        reward: FIRST_CONTRACT.reward.summary,
      }),
    ]);

    session.manager.recoverFieldKit();
    expect(buildObjectiveGuide(session, {
      currentMapId: 'floodplain-relay',
      currentPosition: { x: 11, y: 23 },
      activatedPoiIds: new Set(),
    }).objectives[0]).toMatchObject({
      progress: '1/1',
      complete: true,
    });
  });

  it('gives the first contract a sequenced briefing, then shortens later runs', () => {
    const firstSession = createFirstContractSession();
    const firstGuide = buildObjectiveGuide(firstSession, {
      currentMapId: 'floodplain-relay',
      currentPosition: { x: 15, y: 3 },
      activatedPoiIds: new Set(),
    });
    const laterSession = createActiveRunSession(
      firstSession.manager,
      {},
      {},
      [],
      [],
      [],
      generateRunPlan(42, undefined, 'town-square', undefined),
    );
    const laterGuide = buildObjectiveGuide(laterSession, {
      currentMapId: 'pallet-town',
      currentPosition: { x: 6, y: 8 },
      activatedPoiIds: new Set(),
    });

    expect(firstGuide.hints.join(' ')).toContain('Floodplain Relay');
    expect(firstGuide.hints.join(' ')).toContain('reeds');
    expect(firstGuide.hints.join(' ')).toContain('lost field kit');
    expect(firstGuide.hints.join(' ')).toContain('Extract');
    expect(firstGuide.hints).toHaveLength(4);
    expect(laterGuide.isFirstContract).toBe(false);
    expect(laterGuide.hints).toHaveLength(2);
  });

  it('offers both routes to the field kit before it is recovered, then only the extraction', () => {
    const session = createFirstContractSession();
    // Asked at the front door, and then standing on the kit - both read from the
    // data, because the map has been redrawn once under typed coordinates.
    const before = buildObjectiveGuide(session, {
      currentMapId: 'floodplain-relay',
      currentPosition: RUN_INSERTIONS['floodplain-relay'].position,
      activatedPoiIds: new Set(),
    });

    // The priced road and the way round it, in the words the map's own sign uses.
    expect(before.hints.join(' ')).toContain('shore road');
    expect(before.hints.join(' ')).toContain('the reeds go round her');

    session.manager.recoverFieldKit();
    const after = buildObjectiveGuide(session, {
      currentMapId: 'floodplain-relay',
      currentPosition: FIRST_CONTRACT.markers[0].position,
      activatedPoiIds: new Set(),
    });

    expect(after.hints).toHaveLength(2);
    expect(after.hints[0]).toContain('Lost field kit secured');
    expect(after.hints.join(' ')).toContain('SOUTH GATE');
  });

  it('names the current area and keeps the first-contract direction live', () => {
    const session = createFirstContractSession();

    // Two places a first raid really stands, read from the data: the front door,
    // with the kit down in the reeds to the south-west of it, and the Radio Exit
    // out at the head of the flooded cut, with the kit back to the north-east.
    const frontDoor = RUN_INSERTIONS['floodplain-relay'].position;
    const radioExit = EXTRACTION_POINTS.find(
      (point) => point.mapId === 'floodplain-relay' && point.label === 'RADIO EXIT',
    )!.position;
    const insertionGuide = buildObjectiveGuide(session, {
      currentMapId: 'floodplain-relay',
      currentPosition: frontDoor,
      activatedPoiIds: new Set(),
    });
    const reedGuide = buildObjectiveGuide(session, {
      currentMapId: 'floodplain-relay',
      currentPosition: radioExit,
      activatedPoiIds: new Set(),
    });

    expect(insertionGuide.hints[0]).toContain('Floodplain Relay');
    // Two tiles west and eleven south is south, which is what the briefing calls it.
    expect(insertionGuide.hints[0]).toContain('to the south.');
    expect(reedGuide.hints[0]).toContain('north-east');
    expect(insertionGuide.hints.join(' ')).not.toContain('Viridian');
  });

  it('explains Floodplain route and Radio Exit trade-offs before and after Ranger activation', () => {
    const firstSession = createFirstContractSession();
    const session = createActiveRunSession(
      firstSession.manager,
      {},
      {},
      [],
      [],
      [],
      generateRunPlan(42, undefined, 'floodplain-relay', undefined),
    );
    const before = buildObjectiveGuide(session, {
      currentMapId: 'floodplain-relay',
      currentPosition: { x: 15, y: 3 },
      activatedPoiIds: new Set(),
    });
    const after = buildObjectiveGuide(session, {
      currentMapId: 'floodplain-relay',
      currentPosition: { x: 18, y: 8 },
      activatedPoiIds: new Set(['floodplain-ranger-radio']),
    });

    expect(before.hints.join(' ')).toContain('Maya');
    expect(before.hints.join(' ')).toContain('activates the Radio Exit');
    expect(after.hints.join(' ')).toContain('Radio Exit is active');

    // The cache it points at is read from the map's own landmarks, in order: the
    // one a fresh save can walk to first, and the next once that is worked. It
    // used to be a sentence about the supply vault typed out by hand, which went
    // on sending a fresh save to a cache that is now behind two bosses.
    const caches = poisForMap('floodplain-relay').filter((poi) => poi.effect === undefined);
    expect(caches.map((poi) => poi.label)).toEqual(['DROWNED CHAPEL', 'FLOODED SUPPLY VAULT']);
    expect(before.hints.join(' ')).toContain(caches[0].label);
    expect(before.hints.join(' ')).not.toContain(caches[1].label);
    const chapelWorked = buildObjectiveGuide(session, {
      currentMapId: 'floodplain-relay',
      currentPosition: caches[0].position,
      activatedPoiIds: new Set([caches[0].id]),
    });
    expect(chapelWorked.hints.join(' ')).toContain(caches[1].label);
  });

  it('names the landmark the map actually has, on every map', () => {
    const insertions: readonly { readonly id: RunInsertionId; readonly mapId: WorldMapId }[] = [
      { id: 'floodplain-relay', mapId: 'floodplain-relay' },
      { id: 'town-square', mapId: 'pallet-town' },
      { id: 'route-1', mapId: 'route-1' },
      { id: 'viridian-forest', mapId: 'viridian-forest' },
    ];

    for (const { id, mapId } of insertions) {
      const guide = buildObjectiveGuide(createUncontractedSession(id), {
        currentMapId: mapId,
        currentPosition: RUN_INSERTIONS[id].position,
        activatedPoiIds: new Set(),
      });
      const text = guide.hints.join(' ').toUpperCase();

      expect(text).toContain(poisForMap(mapId)[0].label.toUpperCase());
      for (const elsewhere of WORLD_POIS.filter((poi) => poi.mapId !== mapId)) {
        expect(text).not.toContain(elsewhere.label.toUpperCase());
      }
    }
  });

  it('moves on to the next landmark on a map that has two', () => {
    const guide = buildObjectiveGuide(createUncontractedSession('town-square'), {
      currentMapId: 'pallet-town',
      currentPosition: { x: 7, y: 6 },
      activatedPoiIds: new Set(['pallet-town-pump']),
    });

    expect(guide.hints[0]).toContain('SLUICE WHEEL');
    expect(guide.hints[0]).toContain('opens it as an exit');
  });
});
