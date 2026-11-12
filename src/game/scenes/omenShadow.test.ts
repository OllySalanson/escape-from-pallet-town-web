import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

const played: { name: string; species?: number }[] = [];
vi.mock('../audio/AudioManager', () => ({
  audioManager: new Proxy(
    {},
    {
      get: (_target, key) =>
        key === 'play' ? (name: string, options?: { species?: number }) => played.push({ name, species: options?.species }) : vi.fn(),
    },
  ),
}));

import { buildObjectiveGuide } from '../objectives/ObjectiveGuide';
import { getSpeciesById } from '../pokemon/species';
import { OMEN_CROSSING_MS, OMEN_SHADOW_SCALE, type Omen } from '../world/omens';
import { getWorldMap } from '../worldMap';
import { WorldScene } from './WorldScene';

/**
 * A raid's omen through the real WorldScene (`world/omens.ts`): nothing until
 * its moment on the raid's clock, then the bird's cry and its shadow across
 * the screen towards its roost, once - and from then on the field guide says
 * which way it went.
 */

const VALE = 'greystone-vale';
const MILL_SQUARE = { x: 94, y: 160 };
const VIEW = { x: 1000, y: 2000, width: 400, height: 256 };

function raidWithOmen(omen: Omen | undefined, options: { indoors?: boolean; reducedMotion?: boolean } = {}) {
  let elapsedMs = 0;
  const shadows: { x: number; y: number; visible: boolean; destroyed: boolean; scale: number; alpha: number; key: string }[] = [];
  const session = {
    plan: { omen, insertion: { mapId: VALE } },
    manager: { snapshot: () => ({ elapsedMs }) },
    omenSeen: undefined as boolean | undefined,
  };
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    currentMap: getWorldMap(VALE),
    currentTile: { ...MILL_SQUARE },
    currentArea: () => (options.indoors ? { kind: 'inside' } : undefined),
    reducedMotion: options.reducedMotion ?? false,
    mapObjects: [],
    omenFlight: null,
    runSession: session,
    textures: { exists: () => true },
    cameras: { main: { worldView: VIEW } },
    add: {
      image: (x: number, y: number, key: string) => {
        const shadow = {
          x,
          y,
          key,
          visible: true,
          destroyed: false,
          scale: 1,
          alpha: 1,
          setOrigin: () => shadow,
          setScale(scale: number) {
            shadow.scale = scale;
            return shadow;
          },
          setTintFill: () => shadow,
          setAlpha(alpha: number) {
            shadow.alpha = alpha;
            return shadow;
          },
          setDepth: () => shadow,
          setVisible(visible: boolean) {
            shadow.visible = visible;
            return shadow;
          },
          setPosition(nextX: number, nextY: number) {
            shadow.x = nextX;
            shadow.y = nextY;
            return shadow;
          },
          destroy() {
            shadow.destroyed = true;
          },
        };
        shadows.push(shadow);
        return shadow;
      },
    },
  });
  const internals = scene as unknown as { updateOmen(deltaMs: number): void };
  return {
    session,
    shadows,
    tick: (deltaMs: number) => {
      elapsedMs += deltaMs;
      internals.updateOmen(deltaMs);
    },
  };
}

describe('an omen in a raid', () => {
  const zapdos: Omen = { speciesId: 'zapdos', atMs: 30_000 };
  const dexId = getSpeciesById('zapdos')!.dexId;

  it('is nothing until its moment, then the bird’s cry and its shadow, once', () => {
    played.length = 0;
    const { session, shadows, tick } = raidWithOmen(zapdos);
    tick(29_900);
    expect(shadows).toEqual([]);
    expect(played).toEqual([]);
    expect(session.omenSeen).toBeUndefined();

    tick(200);
    expect(played).toEqual([{ name: 'cry', species: dexId }]);
    expect(session.omenSeen).toBe(true);
    expect(shadows).toHaveLength(1);
    expect(shadows[0].key).toBe(`pokemon-front-${dexId}`);
    expect(shadows[0].scale).toBe(OMEN_SHADOW_SCALE);
    expect(shadows[0].alpha).toBeLessThan(0.5);
    expect(shadows[0].visible).toBe(true);

    // It crosses the screen and is gone, and does not come again.
    for (let frame = 0; frame < Math.ceil(OMEN_CROSSING_MS / 100) + 2; frame += 1) tick(100);
    expect(shadows[0].destroyed).toBe(true);
    tick(60_000);
    expect(shadows).toHaveLength(1);
    expect(played).toHaveLength(1);
  });

  it('flies for its roost: the Power Station is north and east of Mill Square', () => {
    const { shadows, tick } = raidWithOmen(zapdos);
    tick(30_000);
    const start = { x: shadows[0].x, y: shadows[0].y };
    tick(OMEN_CROSSING_MS / 2);
    // Through the middle of the screen it set off over.
    expect({ x: shadows[0].x, y: shadows[0].y }).toEqual({ x: VIEW.x + VIEW.width / 2, y: VIEW.y + VIEW.height / 2 });
    expect(shadows[0].x).toBeGreaterThan(start.x);
    expect(shadows[0].y).toBeLessThan(start.y);
  });

  it('waits while the player is under a roof, and crosses when they come out', () => {
    const indoors = raidWithOmen(zapdos, { indoors: true });
    indoors.tick(60_000);
    expect(indoors.shadows).toEqual([]);
    expect(indoors.session.omenSeen).toBeUndefined();
  });

  it('is heard and told with no shadow for a player who asked for less motion', () => {
    played.length = 0;
    const { session, shadows, tick } = raidWithOmen(zapdos, { reducedMotion: true });
    tick(30_000);
    expect(played).toHaveLength(1);
    expect(session.omenSeen).toBe(true);
    expect(shadows).toEqual([]);
  });

  it('is nothing at all on a raid with no omen', () => {
    played.length = 0;
    const { shadows, tick } = raidWithOmen(undefined);
    tick(120_000);
    expect(shadows).toEqual([]);
    expect(played).toEqual([]);
  });

  it('is in the field guide only once it has crossed, with the way it went', () => {
    const session = {
      plan: { omen: zapdos, insertion: { mapId: VALE }, extractionPoints: [], loot: {} },
      objectives: [],
      manager: { snapshot: () => ({ elapsedMs: 0, contractSteps: [], foundItems: [], caughtPokemon: [] }) },
      omenSeen: false,
    };
    const hints = () =>
      buildObjectiveGuide(session as never, { currentMapId: VALE, currentPosition: MILL_SQUARE, activatedPoiIds: new Set() }).hints.filter((hint) =>
        hint.includes('shadow'),
      );
    expect(hints()).toEqual([]);
    session.omenSeen = true;
    // The Power Station lies three districts east of Mill Square and one north: east, to the nearest of eight.
    expect(hints()).toEqual([
      'A great shadow crossed the vale, heading east. That cry was ZAPDOS. They say it roosts in the TURBINE HALL at THE POWER STATION.',
    ]);
  });
});
