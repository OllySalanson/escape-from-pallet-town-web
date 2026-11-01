import { afterEach, describe, expect, it } from 'vitest';
import { getWorldMap } from '../worldMap';
import { frontDoorFor } from '../run/runGeneration';
import { stepDistances } from '../world/mapStructure';
import { retireMapsForTests, RETIRED_MAPS } from '../world/mapRoster';
import { unregisterPlayerMap } from '../world/playerMaps';
import { PUBLISHED_FIXTURE_MAP_ID } from '../world/publishedMapFixture.testkit';
import { boardContracts, type StandingBoardProgress } from './standingBoard';

/**
 * A board turns over only when one of its contracts is banked, so a contract
 * behind a boss is all a one-map board holds until that boss falls. BOATSWAIN
 * CRAGG is the last rung of the ladder: a level-10 Squirtle with three Potions
 * never beats him. Dealt second, he stopped a new save's contracts dead.
 */
describe('a board of one map', () => {
  afterEach(() => retireMapsForTests([]));

  const progressAt = (standingContractsBanked: number): StandingBoardProgress => ({
    completedContracts: [],
    standingContractsBanked,
    defeatedBosses: [],
    workshopUpgrades: [],
    unlockedInsertions: [],
    reachedInsertions: [],
  });

  it('always deals a contract that can be finished without beating a boss', () => {
    retireMapsForTests(RETIRED_MAPS);
    unregisterPlayerMap(PUBLISHED_FIXTURE_MAP_ID);
    const map = getWorldMap('greystone-vale', []);
    const fromTheDoor = stepDistances(
      map.collision,
      frontDoorFor('greystone-vale')!.position,
      undefined,
      map.links,
    );

    for (let round = 0; round < 24; round += 1) {
      const board = boardContracts(progressAt(round));
      expect(board.map((contract) => contract.mapId)).toEqual(['greystone-vale']);
      const [contract] = board;
      expect(contract.sealedBehind, `round ${round}`).toBeUndefined();
      for (const { position } of contract.markers) {
        expect(fromTheDoor[position.y][position.x], `round ${round}`).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
