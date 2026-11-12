import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

const played: string[] = [];
vi.mock('../audio/AudioManager', () => ({
  audioManager: new Proxy(
    {},
    { get: (_target, key) => (key === 'play' ? (name: string) => played.push(name) : vi.fn()) },
  ),
}));

import { generateRunPlan } from '../run/runGeneration';
import { SHIMMER_SHINY_ODDS } from '../world/shimmer';
import { getWorldMap } from '../worldMap';
import { WorldScene } from './WorldScene';

/**
 * The shimmering grass (`world/shimmer.ts`) through the real WorldScene: the
 * glitter is drawn over this raid's patch and nowhere else, stepping into it
 * is its Pokemon at once, and a patch something has been through is neither
 * drawn nor met again - which has to survive the world being rebuilt after
 * the fight, so it is the session that remembers.
 */

const VALE = 'greystone-vale';

function raidOnTheVale(shinyRoll = 0.5) {
  const plan = generateRunPlan(7, undefined, VALE);
  const shimmer = plan.shimmer!;
  const drawn: { x: number; y: number; depth: number }[] = [];
  const tweens: { repeat: number }[] = [];
  const battles: { wild?: { speciesId: string; level: number; shiny?: boolean }; teachingBattle?: boolean }[] = [];
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    currentMap: getWorldMap(VALE),
    currentTile: { ...plan.insertion.position },
    mapObjects: [],
    runSession: { plan, shinyRng: { next: () => shinyRoll } },
    add: {
      graphics: () => {
        const twinkle = {
          x: 0,
          y: 0,
          depth: 0,
          setDepth(depth: number) {
            twinkle.depth = depth;
            return twinkle;
          },
          fillStyle: () => twinkle,
          fillRect: () => twinkle,
          setPosition(x: number, y: number) {
            twinkle.x = x;
            twinkle.y = y;
            return twinkle;
          },
          setAlpha: () => twinkle,
        };
        drawn.push(twinkle);
        return twinkle;
      },
    },
    tweens: { add: (config: { repeat: number }) => tweens.push(config) },
    transitionToBattle: (encounter: (typeof battles)[number]) => battles.push(encounter),
  });
  const internals = scene as unknown as {
    createShimmer(): void;
    tryShimmer(): boolean;
    currentTile: { x: number; y: number };
    currentMap: unknown;
    runSession: { shimmerMet?: boolean };
  };
  return { plan, shimmer, drawn, tweens, battles, internals };
}

describe('the shimmering grass in a raid', () => {
  it('glitters over this raid’s patch: three glints on its tile, above the grass and never still', () => {
    const { shimmer, drawn, tweens, internals } = raidOnTheVale();
    internals.createShimmer();
    expect(drawn).toHaveLength(3);
    for (const glint of drawn) {
      expect(Math.floor(glint.x / 16)).toBe(shimmer.position.x);
      expect(Math.floor(glint.y / 16)).toBe(shimmer.position.y);
      // The canopy band: over the figures, as a prize's light is.
      expect(glint.depth).toBeGreaterThan(2.5);
    }
    expect(tweens).toHaveLength(3);
    expect(tweens.every((tween) => tween.repeat === -1)).toBe(true);
  });

  it('is its place’s rare Pokemon at once on the step into it, and nothing on any other step', () => {
    const { shimmer, battles, internals } = raidOnTheVale();
    expect(internals.tryShimmer()).toBe(false);
    expect(battles).toEqual([]);

    internals.currentTile = { ...shimmer.position };
    played.length = 0;
    expect(internals.tryShimmer()).toBe(true);
    expect(battles).toEqual([
      { wild: { speciesId: shimmer.speciesId, level: shimmer.level, shiny: false }, teachingBattle: false },
    ]);
    expect(played).toEqual(['encounter']);
  });

  it('is met once: the grass stops glittering and holds nothing more, however the fight went', () => {
    const { shimmer, drawn, battles, internals } = raidOnTheVale();
    internals.currentTile = { ...shimmer.position };
    expect(internals.tryShimmer()).toBe(true);
    expect(internals.runSession.shimmerMet).toBe(true);

    // The world is rebuilt after the fight from what the session carries.
    internals.createShimmer();
    expect(drawn).toEqual([]);
    expect(internals.tryShimmer()).toBe(false);
    expect(battles).toHaveLength(1);
  });

  it('rolls its shiny on the raid’s own shiny stream, one time in fifty, and says so to the fight either way', () => {
    const lucky = raidOnTheVale(1 / SHIMMER_SHINY_ODDS - 0.001);
    lucky.internals.currentTile = { ...lucky.shimmer.position };
    lucky.internals.tryShimmer();
    expect(lucky.battles[0].wild?.shiny).toBe(true);

    // An answer of no is an answer: the fight must not roll the wild's own odds on top.
    const plain = raidOnTheVale(1 / SHIMMER_SHINY_ODDS + 0.001);
    plain.internals.currentTile = { ...plain.shimmer.position };
    plain.internals.tryShimmer();
    expect(plain.battles[0].wild?.shiny).toBe(false);
  });

  it('is on the map the raid landed on, and not drawn or met on another', () => {
    const { shimmer, drawn, internals } = raidOnTheVale();
    internals.currentMap = getWorldMap('pallet-town');
    internals.currentTile = { ...shimmer.position };
    internals.createShimmer();
    expect(drawn).toEqual([]);
    expect(internals.tryShimmer()).toBe(false);
  });
});
