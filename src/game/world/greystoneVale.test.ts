import { describe, expect, it } from 'vitest';
import { playtestRaidProgress } from '../dev/playtestSave';
import { RAID_CONTRACTS } from '../objectives';
import { contractUnlockedInsertionIds } from '../objectives/contracts';
import { deployableMapIds } from '../objectives/standingBoard';
import {
  availableInsertionIds,
  generateRunPlan,
  insertionsOn,
  RUN_INSERTIONS,
} from '../run/runGeneration';
import { DEFAULT_RAID_PROGRESS } from '../save/SaveManager';
import { BUILT_IN_MAP_IDS, isMapInProgress, MAPS_IN_PROGRESS } from '../worldMap';
import { districtsForMap } from './districts';
import { extractionPointsOn } from './extractionPoints';
import { entitiesForMap } from './npcs';
import { builtInFileMap, isPublishedMap } from './playerMaps';

/**
 * Greystone Vale is the game's own map, drawn district by district with
 * `tools/mapcraft` and shipped as the stitched file `maps/greystoneVale.json`.
 * Until its districts are drawn it is on `MAPS_IN_PROGRESS`: held to every
 * structure rule now, reached only by the explorer run, and never offered to a
 * save - its boss, key exit and caches arrive with the districts that hold them.
 */
describe('Greystone Vale, still being drawn', () => {
  const vale = builtInFileMap('greystone-vale')!;

  it('is the one map on the in-progress list', () => {
    expect([...MAPS_IN_PROGRESS]).toEqual(['greystone-vale']);
    expect(BUILT_IN_MAP_IDS).toContain('greystone-vale');
    expect(isMapInProgress('greystone-vale')).toBe(true);
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

  describe.each([...MAPS_IN_PROGRESS])('%s', (mapId) => {
    // Everything a save could ever hold: every contract banked, every landing
    // they open, and every landing on every finished map walked to.
    const everything = {
      ...DEFAULT_RAID_PROGRESS,
      completedContracts: RAID_CONTRACTS.map((contract) => contract.id),
      unlockedInsertions: [
        ...DEFAULT_RAID_PROGRESS.unlockedInsertions,
        ...contractUnlockedInsertionIds(RAID_CONTRACTS.map((contract) => contract.id)),
      ],
      reachedInsertions: Object.values(RUN_INSERTIONS)
        .filter((insertion) => !isMapInProgress(insertion.mapId))
        .map((insertion) => insertion.id),
    };

    it('is never offered to a save, however far it has got', () => {
      expect(RAID_CONTRACTS.filter((contract) => contract.mapId === mapId)).toEqual([]);
      for (const progress of [DEFAULT_RAID_PROGRESS, everything]) {
        expect(
          availableInsertionIds(progress).filter(
            (id) => RUN_INSERTIONS[id as keyof typeof RUN_INSERTIONS]?.mapId === mapId,
          ),
        ).toEqual([]);
        expect(deployableMapIds(progress)).not.toContain(mapId);
      }
      expect(isPublishedMap(mapId)).toBe(false);
    });

    it('is reached by the explorer run, from the title', () => {
      expect(availableInsertionIds(playtestRaidProgress())).toContain(insertionsOn(mapId)[0].id);
    });

    it('is left out of a raid on a finished map, so no roll there moves', () => {
      const plan = generateRunPlan(7, undefined, 'floodplain-relay', undefined);
      expect(Object.keys(plan.loot)).not.toContain(mapId);
      expect(plan.trainers.filter((trainer) => trainer.mapId === mapId)).toEqual([]);
      expect(plan.extractionPoints.filter((point) => point.mapId === mapId)).toEqual([]);
    });

    it('is laid for a raid on itself, with a way out open from the first second', () => {
      const plan = generateRunPlan(7, undefined, insertionsOn(mapId)[0].id, undefined);
      expect(plan.insertion.mapId).toBe(mapId);
      const exits = plan.extractionPoints.filter((point) => point.mapId === mapId);
      expect(exits.length).toBeGreaterThanOrEqual(2);
      expect(
        exits.some((point) => point.unlockAtMs === 0 && point.requirement?.kind === 'always'),
      ).toBe(true);
    });
  });
});
