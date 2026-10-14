import { describe, expect, it } from 'vitest';
import { getWorldMap } from '../../../../src/game/worldMap';
import { districtAt } from '../../../../src/game/world/districts';
import { stepDistances } from '../../../../src/game/world/mapStructure';
import { playerLinks } from '../../../../src/game/world/sailing';
import { insertionsOn } from '../../../../src/game/run/runGeneration';
import { nightDoors } from '../../../../src/game/world/gates';

/**
 * The Moor Chapel is the one far place nothing on the moor points to: by day
 * the fog turns the sheep track back and the chapel is not there. So by day
 * no ground a raid can walk to is named for it. The head of the track - the
 * four tiles between the fogged wood and the seam, walked from the shepherd's
 * clearing - used to be the chapel's own, and the arrival plate said THE MOOR
 * CHAPEL in a wood with the fog lines up (the vale's playtest, B5).
 */
describe('the Moor Chapel by day', () => {
  const CHAPEL = ['THE MOOR CHAPEL', 'THE CHURCHYARD', 'THE CRYPT', 'THE NAVE'];

  function namedFromEveryLanding(night: boolean): Set<string> {
    const map = getWorldMap('greystone-vale', nightDoors(night));
    const names = new Set<string>();
    for (const landing of insertionsOn('greystone-vale')) {
      const walk = stepDistances(map.collision, landing.position, undefined, playerLinks(map));
      walk.forEach((row, y) =>
        row.forEach((steps, x) => {
          if (steps >= 0) names.add(districtAt('greystone-vale', { x, y })?.name ?? '');
        }),
      );
    }
    return names;
  }

  it('names nothing a raid can walk to for the chapel', () => {
    const named = namedFromEveryLanding(false);
    expect(CHAPEL.filter((name) => named.has(name))).toEqual([]);
    // The track's head is still somewhere: the sheep track the shepherd names.
    expect(named.has('THE SHEEP TRACK')).toBe(true);
  });

  it('is there by night, through the same track', () => {
    expect(namedFromEveryLanding(true).has('THE MOOR CHAPEL')).toBe(true);
  });
});
