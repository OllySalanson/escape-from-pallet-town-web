import { describe, expect, it } from 'vitest';
import { Pokemon, BULBASAUR } from '../pokemon';
import { RunManager } from '../run';
import { createActiveRunSession } from '../run/RunSession';
import { generateRunPlan } from '../run/runGeneration';
import { RUN_OBJECTIVES } from './RunObjectives';
import { buildObjectiveGuide } from './ObjectiveGuide';

function createFirstContractSession() {
  const manager = new RunManager();
  manager.startRun({ party: [new Pokemon(BULBASAUR, 5)], items: [] }, { mapId: 'pallet-town', durationMs: 60_000 });
  return createActiveRunSession(
    manager,
    {},
    {},
    [],
    [],
    RUN_OBJECTIVES,
    generateRunPlan(42, undefined, 'town-square', true),
  );
}

describe('objective field guide', () => {
  it('binds objective completion and rewards to the live run snapshot', () => {
    const session = createFirstContractSession();

    expect(buildObjectiveGuide(session, { currentMapId: 'pallet-town', activatedPoiIds: new Set() }).objectives).toEqual([
      expect.objectContaining({
        description: 'Recover the lost field kit on Route 1',
        progress: '0/1',
        complete: false,
        reward: '1× super potion',
      }),
    ]);

    session.manager.recoverFieldKit();
    expect(buildObjectiveGuide(session, { currentMapId: 'route-1', activatedPoiIds: new Set() }).objectives[0]).toMatchObject({
      progress: '1/1',
      complete: true,
    });
  });

  it('gives the first contract a sequenced briefing, then shortens later runs', () => {
    const firstSession = createFirstContractSession();
    const firstGuide = buildObjectiveGuide(firstSession, { currentMapId: 'pallet-town', activatedPoiIds: new Set() });
    const laterSession = createActiveRunSession(
      firstSession.manager,
      {},
      {},
      [],
      [],
      [],
      generateRunPlan(42, undefined, 'town-square', false),
    );
    const laterGuide = buildObjectiveGuide(laterSession, { currentMapId: 'pallet-town', activatedPoiIds: new Set() });

    expect(firstGuide.hints.join(' ')).toContain('Route 1');
    expect(firstGuide.hints.join(' ')).toContain('Field Station');
    expect(firstGuide.hints.join(' ')).toContain('lost field kit');
    expect(firstGuide.hints.join(' ')).toContain('Extract');
    expect(firstGuide.hints).toHaveLength(4);
    expect(laterGuide.isFirstContract).toBe(false);
    expect(laterGuide.hints).toHaveLength(2);
  });

  it('only calls the field station secured after its actual activation', () => {
    const session = createFirstContractSession();
    const before = buildObjectiveGuide(session, { currentMapId: 'route-1', activatedPoiIds: new Set() });
    const after = buildObjectiveGuide(session, {
      currentMapId: 'route-1',
      activatedPoiIds: new Set(['oak-field-station-relay']),
    });

    expect(before.hints.join(' ')).not.toContain('cache is secured');
    expect(after.hints.join(' ')).toContain('cache is secured');
  });
});
