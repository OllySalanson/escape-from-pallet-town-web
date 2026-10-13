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
