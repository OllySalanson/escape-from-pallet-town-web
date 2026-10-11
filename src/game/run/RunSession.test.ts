import { describe, expect, it } from 'vitest';
import { rollShiny } from '../pokemon/shiny';
import { RunManager } from './RunManager';
import { createActiveRunSession, createBattleReturnLocation } from './RunSession';
import { generateRunPlan } from './runGeneration';

describe('raid session locations', () => {
  it('uses the selected insertion for a fresh raid regardless of an old extraction location', () => {
    const previousExtraction = { mapId: 'viridian-forest' as const, position: { x: 23, y: 32 } };
    const plan = generateRunPlan(7, undefined, 'town-square');

    expect(previousExtraction).toEqual({ mapId: 'viridian-forest', position: { x: 23, y: 32 } });
    expect(plan.insertion).toMatchObject({
      id: 'town-square',
      mapId: 'pallet-town',
      position: { x: 7, y: 9 },
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

describe('the shiny stream', () => {
  const session = (seed: number) =>
    createActiveRunSession(new RunManager(), {}, {}, [], [], [], generateRunPlan(seed, undefined, 'town-square'));

  it('is a stream of its own: rolling shinies moves no roll of the raid', () => {
    const rolled = session(7);
    const untouched = session(7);
    for (let roll = 0; roll < 50; roll += 1) {
      rollShiny(rolled.shinyRng);
    }
    expect([rolled.rng!.next(), rolled.rng!.next()]).toEqual([untouched.rng!.next(), untouched.rng!.next()]);
  });

  it('plays the same raid the same way: one seed, one run of shiny rolls', () => {
    const first = session(11);
    const again = session(11);
    expect([first.shinyRng!.next(), first.shinyRng!.next()]).toEqual([again.shinyRng!.next(), again.shinyRng!.next()]);
    expect(first.shinyRng!.next()).not.toBe(session(11).rng!.next());
  });
});
