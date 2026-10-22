import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createStartingStash } from '../stash';
import { CHARMANDER } from '../pokemon';
import { restoreBase } from '../base/baseGames.testkit';
import { wallMapOrder } from '../base/wallMap';
import {
  availableContracts,
  FIRST_CONTRACT_ID,
  isChainFinished,
  RAID_CONTRACTS,
} from '../objectives/contracts';
import { boardContracts, deployableMapIds } from '../objectives/standingBoard';
import { availableInsertionIds, frontDoorFor, requireInsertion } from '../run/runGeneration';
import { DEFAULT_RAID_PROGRESS, type RaidProgress } from '../save/SaveManager';
import { BUILT_IN_MAP_IDS } from '../worldMap';
import { isMapOffered, isMapRetired, retireMapsForTests, RETIRED_MAPS } from './mapRoster';
import { PUBLISHED_FIXTURE_MAP_ID } from './publishedMapFixture.testkit';

/**
 * What a player is offered with the shipped roster: the suite runs with no map
 * retired (`mapRoster.testkit.ts`), so this file puts the real list back.
 */
describe('the shipped roster: Greystone Vale alone', () => {
  beforeEach(() => retireMapsForTests(RETIRED_MAPS));
  afterEach(() => retireMapsForTests([]));

  const progress = (overrides: Partial<RaidProgress> = {}): RaidProgress => ({
    ...DEFAULT_RAID_PROGRESS,
    ...overrides,
  });
  const shippedMapsOffered = (offered: readonly string[]) =>
    offered.filter((mapId) => (BUILT_IN_MAP_IDS as readonly string[]).includes(mapId));

  it('offers Greystone Vale and retires every other shipped map, keeping them in the game', () => {
    expect(BUILT_IN_MAP_IDS.filter(isMapOffered)).toEqual(['greystone-vale']);
    for (const mapId of BUILT_IN_MAP_IDS.filter((id) => id !== 'greystone-vale')) {
      expect(isMapRetired(mapId)).toBe(true);
    }
    // A player's map is never retired.
    expect(isMapOffered(PUBLISHED_FIXTURE_MAP_ID)).toBe(true);
  });

  it('drops a brand new save straight into Greystone Vale, by its front door alone', () => {
    const offered = availableInsertionIds(progress());
    expect(offered.filter((id) => requireInsertion(id).mapId === 'greystone-vale')).toEqual([
      frontDoorFor('greystone-vale')!.id,
    ]);
    expect(shippedMapsOffered(deployableMapIds(progress()))).toEqual(['greystone-vale']);
  });

  it('puts the authored chain away with its maps, so the board deals on the vale from the first raid', () => {
    expect(availableContracts([])).toEqual([]);
    expect(isChainFinished([])).toBe(true);
    const board = boardContracts(progress());
    expect(board.length).toBeGreaterThan(0);
    expect(board.map((contract) => contract.mapId)).toContain('greystone-vale');
    expect(board.every((contract) => !isMapRetired(contract.mapId))).toBe(true);
  });

  it('lands a save that knows only retired maps in Greystone Vale, and keeps the vale ground it walked', () => {
    // Half way through the old chain: every landing it holds is on a retired map.
    const midChain = progress({
      firstContractExtracted: true,
      completedContracts: [FIRST_CONTRACT_ID, RAID_CONTRACTS[1].id],
      unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'],
      reachedInsertions: ['greystone-vale-the-quarry'],
    });
    const offered = availableInsertionIds(midChain);
    expect(
      offered
        .map((id) => requireInsertion(id).mapId)
        .every((mapId) => mapId === 'greystone-vale' || !isMapRetired(mapId)),
    ).toBe(true);
    expect(offered).toContain(frontDoorFor('greystone-vale')!.id);
    expect(offered).toContain('greystone-vale-the-quarry');
  });

  it('hangs only the vale on Oak’s wall', () => {
    expect(wallMapOrder(restoreBase(createStartingStash(CHARMANDER), {}))).toEqual([
      'greystone-vale',
    ]);
  });
});
