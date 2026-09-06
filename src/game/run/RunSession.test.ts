import { describe, expect, it } from 'vitest';
import { createBattleReturnLocation } from './RunSession';
import { generateRunPlan } from './runGeneration';

describe('raid session locations', () => {
  it('uses the selected insertion for a fresh raid regardless of an old extraction location', () => {
    const previousExtraction = { mapId: 'viridian-forest' as const, position: { x: 23, y: 32 } };
    const plan = generateRunPlan(7, undefined, 'town-square');

    expect(previousExtraction).toEqual({ mapId: 'viridian-forest', position: { x: 23, y: 32 } });
    expect(plan.insertion).toMatchObject({
      id: 'town-square',
      mapId: 'pallet-town',
      position: { x: 6, y: 8 },
    });
  });

  it('preserves the exact map, tile, and facing through a battle handoff', () => {
    const location = createBattleReturnLocation({
      mapId: 'viridian-forest',
      position: { x: 18, y: 24 },
      facing: 'left',
    });

    expect(location).toEqual({
      mapId: 'viridian-forest',
      position: { x: 18, y: 24 },
      facing: 'left',
    });
  });
});
