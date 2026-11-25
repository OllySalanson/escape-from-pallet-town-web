import { afterEach, describe, expect, it } from 'vitest';
import { getWorldMap } from '../worldMap';
import { frontDoorFor } from '../run/runGeneration';
import { encounterTableAt } from '../world/localEncounters';
import { placedAreaAt } from '../world/mapAreas';
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
    // Told what a survey stake is, as a save is once it has spoken to the Gym Guide.
    firstWordsHeard: ['stakes'],
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

  it('never stakes a survey out inside a cave or a room', () => {
    // Tester 4's release blocker 3 (22 Nov 2026): a stake on GREYSTONE CAVES B5F
    // could not be read and walked out from in one raid.
    retireMapsForTests(RETIRED_MAPS);
    unregisterPlayerMap(PUBLISHED_FIXTURE_MAP_ID);
    const map = getWorldMap('greystone-vale', []);
    let surveys = 0;
    for (let round = 0; round < 24; round += 1) {
      for (const contract of boardContracts(progressAt(round)).filter((each) => each.name === 'Line survey')) {
        surveys += 1;
        for (const { position } of contract.markers) {
          const place = map.areas ? placedAreaAt(map.areas, position) : undefined;
          expect(place?.id === undefined ? undefined : place.name, `round ${round} ${position.x},${position.y}`).toBeUndefined();
        }
      }
    }
    expect(surveys).toBeGreaterThan(0);
  });

  it('pays a Pokemon of the place the job went to, not the same four whatever the place', () => {
    retireMapsForTests(RETIRED_MAPS);
    unregisterPlayerMap(PUBLISHED_FIXTURE_MAP_ID);

    const paid = new Set<string>();
    for (let round = 2; round < 26; round += 1) {
      const [contract] = boardContracts(progressAt(round));
      const [pokemon] = contract.reward.pokemon ?? [];
      expect(pokemon, `round ${round}`).toBeDefined();
      const lives = encounterTableAt('greystone-vale', contract.markers[0].position, undefined);
      if (lives) {
        expect(
          lives.entries.filter(({ speciesId, minLevel }) => speciesId === pokemon.speciesId && minLevel === pokemon.level),
          `round ${round}: ${pokemon.speciesId} at ${pokemon.level}`,
        ).not.toHaveLength(0);
      }
      paid.add(pokemon.speciesId);
    }
    expect(paid.size).toBeGreaterThan(4);
  });
});
