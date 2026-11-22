import { describe, expect, it } from 'vitest';
import { districtAt } from './districts';
import { entitiesForMap } from './npcs';
import { MISTY_BOSS_ID, valeGyms } from './valeQuarters';
import vale from './maps/greystoneVale.json';

/**
 * MISTY's answer is the Pokémon a player can see on the way to her.
 *
 * Her Gym Guide says to bring Electric or Grass, and the Pikachu, Oddish and
 * Bellsprout standing about the vale were how a newcomer read that - but some
 * of them were scenery, and pressing SPACE on one only got its cry (AI
 * playtests 3 and 5, 22 Nov 2026: six of sixteen quits were at her door). Now
 * every one of them is a fight that can end in a catch, and both her guides say
 * where they are.
 */

const COUNTERS = ['pikachu', 'oddish', 'bellsprout'] as const;
const standing = entitiesForMap('greystone-vale').filter(
  (entity) => entity.pokemon !== undefined && (COUNTERS as readonly string[]).includes(entity.pokemon),
);

describe("MISTY's counters on the map", () => {
  it('are every one of them a wild fight, never scenery', () => {
    expect(standing.length).toBeGreaterThan(0);
    expect(standing.filter((entity) => entity.wildLevel === undefined).map((entity) => entity.id)).toEqual([]);
  });

  it("stand where Cerulean Gym's guide says they do, each one a fight", () => {
    const guide = vale.people.find(
      (person) => person.name === 'Gym Guide' && person.lines.some((line) => line.includes('MISTY')),
    );
    const words = guide!.lines.join(' ');
    for (const [species, place] of [
      ['PIKACHU', 'PINE HOLLOW'],
      ['ODDISH', 'REEDMERE'],
      ['BELLSPROUT', 'REEDMERE'],
    ] as const) {
      expect(words).toContain(species);
      expect(words).toContain(place);
      const there = standing.filter(
        (entity) =>
          entity.pokemon === species.toLowerCase() &&
          entity.secret === undefined &&
          districtAt('greystone-vale', entity.position)?.name === place,
      );
      expect(there.length, `${species} in ${place}`).toBeGreaterThan(0);
    }
  });

  it('are named by the Gym Guide at the Raid Arena door too', () => {
    const misty = valeGyms().find((gym) => gym.bossId === MISTY_BOSS_ID)!;
    expect(misty.advice.join(' ')).toMatch(/PIKACHU.*PINE HOLLOW.*ODDISH.*BELLSPROUT.*REEDMERE/);
  });
});
