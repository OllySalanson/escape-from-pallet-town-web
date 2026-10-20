import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

import { getContract } from '../objectives/contracts';
import { Pokemon, BULBASAUR } from '../pokemon';
import { RunManager } from '../run';
import { generateRunPlan } from '../run/runGeneration';
import { getWorldMap } from '../worldMap';
import { WorldScene } from './WorldScene';

/** What the objective chip reads, asked of the real scene. */
interface Driven {
  contractNavigationCue(contractSteps: readonly string[]): string | undefined;
  nearestExitCue(): { readonly label: string; readonly heading: string } | undefined;
}

const LEDGER = getContract('cordon-ledger')!;

/** The player in Pallet's Allotments with the cordon ledger just picked up. */
function ledgerInHand(activated: readonly string[] = []): Driven {
  const manager = new RunManager();
  manager.startRun(
    { party: [new Pokemon(BULBASAUR, 5)], items: [] },
    { mapId: 'pallet-town', durationMs: 60_000 },
  );
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    currentMap: getWorldMap('pallet-town'),
    currentTile: LEDGER.markers[0].position,
    activatedPoiIds: new Set(activated),
    runSession: { manager, plan: generateRunPlan(42, undefined, 'town-square', LEDGER) },
  });
  return scene as unknown as Driven;
}

describe('the objective chip on a contract only one exit banks', () => {
  it('points at the landmark that still seals the exit, then names the exit', () => {
    // It read "BANK VIA WEST CULVERT" with no way to it, while the culvert
    // was shut and the wheel that opens it was across the south bank.
    expect(ledgerInHand().contractNavigationCue([LEDGER.markers[0].id])).toBe(
      'SLUICE WHEEL: SE, THEN WEST CULVERT',
    );
  });

  it('says which way the exit is once nothing seals it', () => {
    expect(ledgerInHand(['pallet-sluice-wheel']).contractNavigationCue([LEDGER.markers[0].id])).toBe(
      'BANK VIA WEST CULVERT: SW',
    );
  });
});

describe('the objective chip once the job is done', () => {
  /** A Floodplain raid with no contract, the player standing where `at` says. */
  function standingAt(at: { readonly x: number; readonly y: number }): Driven {
    const manager = new RunManager();
    manager.startRun(
      { party: [new Pokemon(BULBASAUR, 5)], items: [] },
      { mapId: 'floodplain-relay', durationMs: 300_000 },
    );
    const map = getWorldMap('floodplain-relay');
    const scene = Object.create(WorldScene.prototype) as WorldScene;
    Object.assign(scene as object, {
      currentMap: map,
      currentTile: at,
      collisionData: map.collision,
      activatedPoiIds: new Set<string>(),
      exitCueKey: '',
      runSession: { manager, exitsOpened: [], plan: generateRunPlan(42, undefined, 'floodplain-relay', undefined) },
    });
    return scene as unknown as Driven;
  }

  it('names the nearest open exit and which way it is (playtest 47)', () => {
    // After the kit the chip read EXTRACT WITH YOUR HAUL with no direction in
    // it, where a moment before it had said LOST KIT: S.
    const plan = generateRunPlan(42, undefined, 'floodplain-relay', undefined);
    const landing = plan.insertion.position;
    const cue = standingAt(landing).nearestExitCue();

    expect(cue).toBeDefined();
    expect(plan.extractionPoints.map((point) => point.label)).toContain(cue!.label);
    expect(cue!.heading).toMatch(/^(N|NE|E|SE|S|SW|W|NW)$/);
  });

  it('names the way out once every stop of a contract is made, pack empty or not', () => {
    // Route 1's braid survey is three stakes and no thing to carry, so with
    // the third one read the chip fell through to FIND LOOT, THEN EXTRACT -
    // sending a player with the job done off looking, when walking out is
    // the one thing left that banks it.
    const survey = getContract('survey-the-braid')!;
    const manager = new RunManager();
    manager.startRun(
      { party: [new Pokemon(BULBASAUR, 5)], items: [] },
      { mapId: 'route-1', durationMs: 300_000 },
    );
    const map = getWorldMap('route-1');
    const scene = Object.create(WorldScene.prototype) as WorldScene;
    Object.assign(scene as object, {
      currentMap: map,
      currentTile: survey.markers[survey.markers.length - 1].position,
      collisionData: map.collision,
      activatedPoiIds: new Set<string>(),
      exitCueKey: '',
      runSession: { manager, exitsOpened: [], plan: generateRunPlan(42, undefined, 'route-1', survey) },
    });
    const driven = scene as unknown as Driven;
    const exit = driven.nearestExitCue();

    expect(exit).toBeDefined();
    expect(driven.contractNavigationCue(survey.markers.map((marker) => marker.id))).toBe(
      `BANK VIA ${exit!.label.toUpperCase()}: ${exit!.heading}`,
    );
  });
});
