import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { HUNTER_SPAWN_DISTANCE } from './hunter';
import { HUNTER_ARRIVAL_MINIMUM_STEPS, hasPlayerSetOff } from './hunterArrival';

const worldSource = await readFile(new URL('../scenes/WorldScene.ts', import.meta.url), 'utf8');

/**
 * Playtest 3, D3: the hunter's first arrival landed on a player still parked at
 * the insertion, between them and everything else, and had them in two steps.
 */
describe("the hunter's first arrival", () => {
  it('waits for a player who has not set off yet', () => {
    expect(hasPlayerSetOff(undefined)).toBe(false);
    expect(hasPlayerSetOff(0)).toBe(false);
    expect(hasPlayerSetOff(HUNTER_ARRIVAL_MINIMUM_STEPS - 1)).toBe(false);
    expect(hasPlayerSetOff(HUNTER_ARRIVAL_MINIMUM_STEPS)).toBe(true);
  });

  it('asks for no more walking than the lead the arrival itself gives', () => {
    // A floor, never a second delay: anyone who is playing crosses it in the
    // first few seconds of a raid whose hunter is most of a minute away.
    expect(HUNTER_ARRIVAL_MINIMUM_STEPS).toBeLessThanOrEqual(HUNTER_SPAWN_DISTANCE);
  });

  it('gates only the first arrival, and counts steps where a battle cannot reset them', () => {
    const placement = worldSource.slice(
      worldSource.indexOf('private placeHunterIfDue('),
      worldSource.indexOf('private isHunterEligible('),
    );
    const awaitingSpawn = placement.slice(
      placement.indexOf('const awaitingSpawn'),
      placement.indexOf('const awaitingPlacement'),
    );
    expect(awaitingSpawn).toContain('hasPlayerSetOff(this.runSession.stepsTaken)');
    expect(placement.slice(placement.indexOf('const awaitingPlacement'))).not.toContain('hasPlayerSetOff');
    expect(worldSource).toContain('this.runSession.stepsTaken = (this.runSession.stepsTaken ?? 0) + 1;');
  });
});
