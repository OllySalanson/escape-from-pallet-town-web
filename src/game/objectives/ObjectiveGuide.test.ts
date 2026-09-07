import { describe, expect, it } from 'vitest';
import { Pokemon, BULBASAUR } from '../pokemon';
import { RunManager } from '../run';
import { createActiveRunSession } from '../run/RunSession';
import { generateRunPlan } from '../run/runGeneration';
import { RUN_OBJECTIVES } from './RunObjectives';
import { buildObjectiveGuide } from './ObjectiveGuide';

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
    RUN_OBJECTIVES,
    generateRunPlan(42, undefined, 'floodplain-relay', true),
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
        reward: '1× super potion',
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
      generateRunPlan(42, undefined, 'town-square', false),
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
    const before = buildObjectiveGuide(session, {
      currentMapId: 'floodplain-relay',
      currentPosition: { x: 15, y: 3 },
      activatedPoiIds: new Set(),
    });

    expect(before.hints.join(' ')).toContain('central road');
    expect(before.hints.join(' ')).toContain('west reeds');

    session.manager.recoverFieldKit();
    const after = buildObjectiveGuide(session, {
      currentMapId: 'floodplain-relay',
      currentPosition: { x: 11, y: 23 },
      activatedPoiIds: new Set(),
    });

    expect(after.hints).toHaveLength(2);
    expect(after.hints[0]).toContain('Field kit secured');
    expect(after.hints.join(' ')).toContain('SOUTH GATE');
  });

  it('names the current area and keeps the first-contract direction live', () => {
    const session = createFirstContractSession();

    const insertionGuide = buildObjectiveGuide(session, {
      currentMapId: 'floodplain-relay',
      currentPosition: { x: 15, y: 3 },
      activatedPoiIds: new Set(),
    });
    const reedGuide = buildObjectiveGuide(session, {
      currentMapId: 'floodplain-relay',
      currentPosition: { x: 7, y: 22 },
      activatedPoiIds: new Set(),
    });

    expect(insertionGuide.hints[0]).toContain('Floodplain Relay');
    expect(insertionGuide.hints[0]).toContain('south-west');
    expect(reedGuide.hints[0]).toContain('south-east');
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
      generateRunPlan(42, undefined, 'floodplain-relay', false),
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
    expect(before.hints.join(' ')).toContain('Flooded Supply Vault');
    expect(before.hints.join(' ')).toContain('activates the Radio Exit');
    expect(after.hints.join(' ')).toContain('Radio Exit is active');
  });
});
