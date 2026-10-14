import { describe, expect, it } from 'vitest';
import { playtestRaidProgress } from '../dev/playtestSave';
import { RAID_CONTRACTS } from '../objectives';
import {
  contractUnlockedInsertionIds,
  isChainFinished,
  MAPS_OPENED_BY_THE_FINISHED_CHAIN,
} from '../objectives/contracts';
import { deployableMapIds } from '../objectives/standingBoard';
import {
  availableInsertionIds,
  generateRunPlan,
  insertionsOn,
  requireInsertion,
  RUN_INSERTIONS,
} from '../run/runGeneration';
import { DEFAULT_RAID_PROGRESS } from '../save/SaveManager';
import { BUILT_IN_MAP_IDS, isLazyMap, isMapInProgress, LAZY_MAPS } from '../worldMap';
import { districtsForMap } from './districts';
import { extractionPointsOn } from './extractionPoints';
import { entitiesForMap } from './npcs';
import { builtInFileMap, isPublishedMap } from './playerMaps';

/**
 * Greystone Vale is the game's own map, drawn district by district with
 * `tools/mapcraft` and shipped as the stitched file `maps/greystoneVale.json`.
 * It carries everything a finished map does and every test that asks that of
 * a map asks it of the vale. Being 384 tiles square it is built only when
 * something asks for it (`LAZY_MAPS`); and whether a save may go there is
 * still the captain's call (`MAPS_IN_PROGRESS`), so until it comes off that
 * list only the explorer run reaches it - and then it opens with the chain.
 */
describe('Greystone Vale', () => {
  const vale = builtInFileMap('greystone-vale')!;

  it('is the one map built only when asked for', () => {
    expect([...LAZY_MAPS]).toEqual(['greystone-vale']);
    expect(BUILT_IN_MAP_IDS).toContain('greystone-vale');
    expect(isLazyMap('greystone-vale')).toBe(true);
  });

  it('lands where its file says: the front door at its first drop-in, and one landing a drop-in', () => {
    expect(insertionsOn('greystone-vale')[0].id).toBe('greystone-vale');
    expect(insertionsOn('greystone-vale').map((insertion) => insertion.position)).toEqual(
      vale.insertions.map((insertion) => insertion.position),
    );
  });

  it('reaches the game through the same lookups as any map', () => {
    expect(extractionPointsOn('greystone-vale').map((exit) => exit.label)).toEqual(
      vale.exits.map((exit) => exit.label),
    );
    expect(
      extractionPointsOn('greystone-vale').some((exit) => exit.requirement?.kind === 'always'),
    ).toBe(true);
    expect(entitiesForMap('greystone-vale').map((entity) => entity.id)).toEqual(
      vale.entities.map((entity) => entity.id),
    );
    expect(districtsForMap('greystone-vale').map((district) => district.name)).toContain(
      'MILLBROOK',
    );
  });

  describe('opening to a save', () => {
    const banked = (contracts: readonly string[]) => ({
      ...DEFAULT_RAID_PROGRESS,
      completedContracts: contracts,
      unlockedInsertions: [
        ...DEFAULT_RAID_PROGRESS.unlockedInsertions,
        ...contractUnlockedInsertionIds(contracts),
      ],
    });
    const onTheVale = (progress: Parameters<typeof availableInsertionIds>[0]) =>
      availableInsertionIds(progress).filter((id) => requireInsertion(id).mapId === 'greystone-vale');
    const chain = RAID_CONTRACTS.map((contract) => contract.id);

    it("is no contract's map and no contract's reward: the finished chain is what opens it", () => {
      expect(RAID_CONTRACTS.filter((contract) => contract.mapId === 'greystone-vale')).toEqual([]);
      expect(
        contractUnlockedInsertionIds(chain).filter(
          (id) => RUN_INSERTIONS[id as keyof typeof RUN_INSERTIONS]?.mapId === 'greystone-vale',
        ),
      ).toEqual([]);
      expect(MAPS_OPENED_BY_THE_FINISHED_CHAIN).toEqual(['greystone-vale']);
      expect(isPublishedMap('greystone-vale')).toBe(false);
    });

    it('says the chain is finished only once its last contract is banked', () => {
      expect(isChainFinished([])).toBe(false);
      for (let count = 1; count < chain.length; count += 1) {
        expect(isChainFinished(chain.slice(0, count))).toBe(false);
      }
      expect(isChainFinished(chain)).toBe(true);
    });

    // Whether it is open to saves at all is the captain's call, held by
    // `MAPS_IN_PROGRESS`: asked both ways, so taking it off that list is the
    // whole of opening it.
    it('offers its front door once the chain is finished - if it is open to saves - and never before', () => {
      const open = !isMapInProgress('greystone-vale');
      const everything = {
        ...banked(chain),
        reachedInsertions: Object.values(RUN_INSERTIONS)
          .filter((insertion) => insertion.mapId !== 'greystone-vale')
          .map((insertion) => insertion.id),
      };
      for (const progress of [DEFAULT_RAID_PROGRESS, banked(chain.slice(0, 1)), banked(chain.slice(0, chain.length - 1))]) {
        expect(onTheVale(progress)).toEqual([]);
        expect(deployableMapIds(progress)).not.toContain('greystone-vale');
      }
      for (const progress of [banked(chain), everything]) {
        expect(onTheVale(progress)).toEqual(open ? ['greystone-vale'] : []);
        expect(deployableMapIds(progress).includes('greystone-vale')).toBe(open);
      }
    });

    it('offers each other landing only once it has been walked to, as every map does', () => {
      const walked = { ...banked(chain), reachedInsertions: ['greystone-vale-the-dam'] };
      expect(onTheVale(walked)).toEqual([
        ...(isMapInProgress('greystone-vale') ? [] : ['greystone-vale']),
        'greystone-vale-the-dam',
      ]);
    });

    it('is reached by the explorer run, from the title', () => {
      expect(availableInsertionIds(playtestRaidProgress())).toContain('greystone-vale');
    });
  });

  it('is left out of a raid on another map, so no roll there moves and nothing builds it', () => {
    const plan = generateRunPlan(7, undefined, 'floodplain-relay', undefined);
    expect(Object.keys(plan.loot)).not.toContain('greystone-vale');
    expect(plan.trainers.filter((trainer) => trainer.mapId === 'greystone-vale')).toEqual([]);
    expect(plan.extractionPoints.filter((point) => point.mapId === 'greystone-vale')).toEqual([]);
  });

  it('is laid for a raid on itself, with a way out open from the first second', () => {
    const plan = generateRunPlan(7, undefined, 'greystone-vale', undefined);
    expect(plan.insertion.mapId).toBe('greystone-vale');
    const exits = plan.extractionPoints.filter((point) => point.mapId === 'greystone-vale');
    expect(exits.length).toBeGreaterThanOrEqual(2);
    expect(
      exits.some((point) => point.unlockAtMs === 0 && point.requirement?.kind === 'always'),
    ).toBe(true);
  });
});
