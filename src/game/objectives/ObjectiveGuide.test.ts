import { describe, expect, it } from 'vitest';
import { Pokemon, BULBASAUR } from '../pokemon';
import { RunManager } from '../run';
import { createActiveRunSession } from '../run/RunSession';
import { generateRunPlan, RUN_INSERTIONS, type RunInsertionId, requireInsertion } from '../run/runGeneration';
import { FIRST_CONTRACT, getContract } from './contracts';
import { objectivesForContract } from './RunObjectives';
import { buildObjectiveGuide } from './ObjectiveGuide';
import { ERRANDS, errandLoot } from '../hub/errands';
import { EXTRACTION_POINTS } from '../world/extractionPoints';
import { WORLD_POIS, poisForMap } from '../world/pois';
import { WORKED_LANDMARKS } from '../world/workedLandmarks';
import { getWorldMap, type WorldMapId } from '../worldMap';
import { walkingStepsFrom } from '../world/nearestExit';

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
    { mapId: requireInsertion(insertionId).mapId, durationMs: 60_000 },
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

    // The cache it points at is read from the map's own landmarks: the nearest
    // still to work, and the next nearest once that is worked. It used to be a
    // sentence about the supply vault typed out by hand, which went on sending a
    // fresh save to a cache that is now behind two bosses.
    const caches = poisForMap('floodplain-relay').filter((poi) => poi.effect === undefined);
    expect(caches.map((poi) => poi.label)).toEqual([
      'DROWNED CHAPEL',
      'FLOODED SUPPLY VAULT',
      'STRANDED LIGHTER',
      // And one for every place the map grew into, so a raid dropped at any of
      // its ten landings has something to detour for without crossing it.
      'POWDER HOUSE',
      'THE PRESS HOUSE',
      "SHEPHERD'S HUT",
      "OSIER CUTTER'S STORE",
      'PUMPING ENGINE',
      'STRANDED BARGE',
      'CHURCH FARM',
      'THE DECOY',
      'THE WRECK',
      // And the locked crate, which a Lockpick opens.
      'BECK STRONGBOX',
    ]);
    expect(before.hints.join(' ')).toContain(caches[0].label);
    expect(before.hints.join(' ')).not.toContain(caches[1].label);
    const chapelWorked = buildObjectiveGuide(session, {
      currentMapId: 'floodplain-relay',
      currentPosition: caches[0].position,
      activatedPoiIds: new Set([caches[0].id]),
    });
    // From the chapel the lighter on the bar is nearer than the vault.
    expect(chapelWorked.hints.join(' ')).toContain('The nearest landmark still to work is STRANDED LIGHTER');
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
        currentPosition: requireInsertion(id).position,
        activatedPoiIds: new Set(),
      });
      const text = guide.hints.join(' ').toUpperCase();

      expect(poisForMap(mapId).some((poi) => text.includes(poi.label.toUpperCase()))).toBe(true);
      for (const elsewhere of WORLD_POIS.filter((poi) => poi.mapId !== mapId)) {
        expect(text).not.toContain(elsewhere.label.toUpperCase());
      }
    }
  });

  it('moves on to the next landmark once one is worked', () => {
    const guide = buildObjectiveGuide(createUncontractedSession('town-square'), {
      currentMapId: 'pallet-town',
      currentPosition: { x: 3, y: 17 },
      activatedPoiIds: new Set(['pallet-town-pump']),
    });

    expect(guide.hints[0]).not.toContain('TOWN PUMP');
    expect(guide.hints[0]).toContain('THE SCARE POST');
  });

  it('names the landmark nearest the player and which way it is, not the first on the map', () => {
    // Standing in THE QUARRY, the far east of the valley: the Green's pump is
    // fifty tiles west and the adit is two tiles away.
    const guide = buildObjectiveGuide(createUncontractedSession('town-square'), {
      currentMapId: 'pallet-town',
      currentPosition: { x: 53, y: 19 },
      activatedPoiIds: new Set(),
    });

    expect(guide.hints[0]).not.toContain('TOWN PUMP');
    expect(guide.hints[0]).toContain('The nearest landmark still to work is THE ADIT, to the north.');
  });

  it('passes over a landmark a banked contract finished for good', () => {
    const session = createUncontractedSession('town-square');
    const worked = WORLD_POIS.find((poi) => poi.id === 'pallet-sluice-wheel')!;
    const contractId = WORKED_LANDMARKS.find((work) => work.poiId === worked.id)!.contractId;
    const plan = { ...session.plan!, completedContracts: [contractId] };
    const guide = buildObjectiveGuide({ ...session, plan }, {
      currentMapId: 'pallet-town',
      currentPosition: worked.position,
      activatedPoiIds: new Set(),
    });

    expect(guide.hints[0]).not.toContain(worked.label);
    const unbanked = buildObjectiveGuide(session, {
      currentMapId: 'pallet-town',
      currentPosition: worked.position,
      activatedPoiIds: new Set(),
    });
    expect(unbanked.hints[0]).toContain(`${worked.label}, right here.`);
  });
});

describe('the Floodplain field notes, from a far landing', () => {
  // THE LIGHT, the map's south-east corner: the Drowned Chapel, first in the
  // map's list, is a hundred tiles west, and so is the South Gate.
  const light = requireInsertion('floodplain-light').position;
  const map = getWorldMap('floodplain-relay');
  const stepsTo = walkingStepsFrom(light, map.collision, map.links);
  const guide = (nearestOpenExit?: { readonly label: string; readonly position: { x: number; y: number } }) =>
    buildObjectiveGuide(createUncontractedSession('floodplain-light'), {
      currentMapId: 'floodplain-relay',
      currentPosition: light,
      activatedPoiIds: new Set(),
      stepsTo,
      ...(nearestOpenExit ? { nearestOpenExit } : {}),
    }).hints;

  it('names the landmark nearest on foot, not the first in the map list', () => {
    const caches = poisForMap('floodplain-relay').filter(
      (poi) => poi.effect === undefined && stepsTo(poi.position) !== undefined,
    );
    const nearest = caches.reduce((best, poi) => (stepsTo(poi.position)! < stepsTo(best.position)! ? poi : best));
    const text = guide().join(' ');

    expect(nearest.label).not.toBe('DROWNED CHAPEL');
    expect(text).not.toContain('DROWNED CHAPEL');
    expect(text).toContain(`The nearest landmark still to work is ${nearest.label}, `);
  });

  it('names the nearest open exit rather than gates across the map', () => {
    const exit = EXTRACTION_POINTS.find((point) => point.mapId === 'floodplain-relay' && point.label === 'CUTTER\'S GATE')!;
    const text = guide({ label: exit.label, position: exit.position }).join(' ');

    expect(text).toContain("The nearest open exit is CUTTER'S GATE, ");
    expect(text).not.toContain('South Gate is always open');
    expect(text).toContain('Ranger Station gives a hunter forecast and activates the Radio Exit.');
  });

  it('never names a landmark it cannot walk to', () => {
    const text = buildObjectiveGuide(createUncontractedSession('floodplain-light'), {
      currentMapId: 'floodplain-relay',
      currentPosition: light,
      activatedPoiIds: new Set(),
      stepsTo: () => undefined,
    }).hints.join(' ');

    expect(text).toContain('No marked cache in reach is left to work this raid.');
  });
});

describe('the exit the field guide names', () => {
  // Standing on the quarry's landing, nine steps from the QUARRY TRACK; the
  // SOUTH GATE, first in Pallet's list, is the far side of the valley.
  const quarryTrack = EXTRACTION_POINTS.find((point) => point.label === 'QUARRY TRACK')!;
  const here = requireInsertion('pallet-quarry').position;

  it('names the nearest open exit and which way it is, not the first in the map list', () => {
    const guide = buildObjectiveGuide(createUncontractedSession('pallet-quarry'), {
      currentMapId: 'pallet-town',
      currentPosition: here,
      activatedPoiIds: new Set(),
      nearestOpenExit: { label: quarryTrack.label, position: quarryTrack.position },
    });

    expect(guide.hints.join(' ')).not.toContain('SOUTH GATE');
    expect(guide.hints).toContain('The nearest open exit is QUARRY TRACK, to the north-east. Use it to bank your haul.');
  });

  it('banks a contract at the nearest open exit too, unless the contract names its own', () => {
    const contracted = createActiveRunSession(
      new RunManager(),
      {},
      {},
      [],
      [],
      objectivesForContract(FIRST_CONTRACT),
      generateRunPlan(42, undefined, 'floodplain-relay', FIRST_CONTRACT),
    );
    const southGate = EXTRACTION_POINTS.find((point) => point.mapId === 'floodplain-relay' && point.label === 'SOUTH GATE')!;
    const guide = buildObjectiveGuide(contracted, {
      currentMapId: 'floodplain-relay',
      currentPosition: southGate.position,
      activatedPoiIds: new Set(),
      nearestOpenExit: { label: southGate.label, position: southGate.position },
    });

    expect(guide.hints).toContain(
      'The nearest open exit is SOUTH GATE, right here. Extract there to bank the contract and your haul.',
    );
  });

  it('falls back to the map list when no open exit was measured', () => {
    const guide = buildObjectiveGuide(createUncontractedSession('pallet-quarry'), {
      currentMapId: 'pallet-town',
      currentPosition: here,
      activatedPoiIds: new Set(),
    });

    expect(guide.hints).toContain('Use SOUTH GATE on this map to bank your haul.');
  });
});

describe('a contract only one exit banks', () => {
  // The cordon ledger, picked up in the Allotments: only the WEST CULVERT, far
  // to the south-west, banks it, and the SLUICE WHEEL at the east end of the
  // south bank has to be wound first. The guide named the culvert and nothing
  // else - not which way it was, nor that it was still shut.
  const ledger = getContract('cordon-ledger')!;
  const inHand = () => {
    const manager = new RunManager();
    manager.startRun(
      { party: [new Pokemon(BULBASAUR, 5)], items: [] },
      { mapId: 'pallet-town', durationMs: 60_000 },
    );
    manager.registerContractStep(ledger.markers[0].id);
    return createActiveRunSession(
      manager,
      {},
      {},
      [],
      [],
      objectivesForContract(ledger),
      generateRunPlan(42, undefined, 'town-square', ledger),
    );
  };
  const here = ledger.markers[0].position;

  it('says which way the exit is and which landmark still seals it', () => {
    const guide = buildObjectiveGuide(inHand(), {
      currentMapId: 'pallet-town',
      currentPosition: here,
      activatedPoiIds: new Set(),
    });

    expect(guide.hints).toContain(
      'Only WEST CULVERT, to the south-west, banks this contract. It stays sealed until SLUICE WHEEL is worked, to the south-east. Any other gate ends the raid and leaves it unpaid.',
    );
  });

  it('drops the seal once the landmark is worked', () => {
    const guide = buildObjectiveGuide(inHand(), {
      currentMapId: 'pallet-town',
      currentPosition: here,
      activatedPoiIds: new Set(['pallet-sluice-wheel']),
    });

    expect(guide.hints).toContain(
      'Only WEST CULVERT, to the south-west, banks this contract. Any other gate ends the raid and leaves it unpaid.',
    );
  });
});

describe('a shiny in the field guide', () => {
  it('names a shiny caught this raid in the field notes, and an ordinary catch not at all', () => {
    const session = createFirstContractSession();
    const shiny = new Pokemon(BULBASAUR, 4);
    shiny.shiny = true;
    session.manager.registerCaughtPokemon(new Pokemon(BULBASAUR, 3));
    session.manager.registerCaughtPokemon(shiny);

    const hints = buildObjectiveGuide(session, {
      currentMapId: 'floodplain-relay',
      currentPosition: { x: 15, y: 3 },
      activatedPoiIds: new Set(),
    }).hints;

    expect(hints.filter((hint) => hint.includes('shiny'))).toEqual([
      'You are carrying a shiny Bulbasaur. It is only yours once you extract.',
    ]);
  });
});

describe('an errand in the field guide', () => {
  /** A Pallet Town raid with Brock's crate laid in THE QUARRY. */
  function createErrandSession() {
    const manager = new RunManager();
    manager.startRun(
      { party: [new Pokemon(BULBASAUR, 5)], items: [] },
      { mapId: 'pallet-town', durationMs: 60_000 },
    );
    const brock = ERRANDS.find((errand) => errand.id === 'brocks-crate')!;
    return createActiveRunSession(
      manager,
      {},
      {},
      [],
      [],
      [],
      generateRunPlan(7, undefined, 'town-square', undefined, undefined, [], {}, [], [], false, [], [errandLoot(brock)]),
    );
  }

  const errandHints = (session: ReturnType<typeof createErrandSession>, carried: number) =>
    buildObjectiveGuide(session, {
      currentMapId: 'pallet-town',
      currentPosition: { x: 7, y: 9 },
      activatedPoiIds: new Set(),
      carried: (itemId) => (itemId === 'brocks-crate' ? carried : 0),
    }).hints.filter((hint) => hint.includes('crate'));

  it('says where the thing lies, then that it is being carried', () => {
    const session = createErrandSession();
    expect(errandHints(session, 0)).toEqual([expect.stringMatching(/^Brock's errand: Brock's crate lies in THE QUARRY, /)]);

    session.manager.registerFoundItem('brocks-crate', 1);
    expect(errandHints(session, 1)).toEqual([
      "You are carrying Brock's crate for Brock. Walk out with it and it is theirs; wipe and it is lost with the pack.",
    ]);
  });

  it('never says it is being carried once it has been dropped out of the pack', () => {
    const session = createErrandSession();
    session.manager.registerFoundItem('brocks-crate', 1);

    // Picked up, then put down for good to make room: the pack no longer holds it.
    expect(errandHints(session, 0)).toEqual([
      "You put Brock's crate down. Brock is still waiting for it, and it will be out here again next raid.",
    ]);
  });
});
