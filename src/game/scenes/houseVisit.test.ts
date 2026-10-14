import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Math: { Vector2: class { public x = 0; public y = 0; } },
    Geom: { Rectangle: class { public static Contains = () => true; } },
    Input: { Keyboard: { KeyCodes: {}, JustDown: () => false }, Events: {} },
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    Scale: { Events: { RESIZE: 'resize' } },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
    GameObjects: { Container: class {}, Sprite: class {}, Rectangle: class {}, Text: class {} },
  },
}));

const knockScreens = vi.hoisted(() => [] as unknown[][]);
vi.mock('../ui/KnockOverlay', () => ({
  openKnockScreen: (...args: unknown[]) => {
    knockScreens.push(args);
    return {};
  },
}));
vi.mock('../harbour/harbour', () => ({
  harbour: () => ({ seenAs: 'me', link: { nudge: () => undefined } }),
  harbourHouses: () => ({ service: {}, door: {} }),
}));

import { BaseScene } from './BaseScene';
import { knockScreenMarkup } from '../home/knocking';

/**
 * H in somebody else's house (playtest 48): it did nothing and said nothing,
 * so a visitor could not tell a refusal from a broken key. It says why now,
 * and in the player's own house it still picks the house up to decorate.
 */
function houseScene(visit: { ownerId: string; ownerName: string } | null) {
  const said: string[][] = [];
  let decorating = 0;
  const scene = Object.create(BaseScene.prototype) as Record<string, unknown>;
  Object.assign(scene, {
    visit: visit ? { ...visit, game: {} } : null,
    say: (lines: readonly string[]) => said.push([...lines]),
    startDecorating: () => {
      decorating += 1;
    },
  });
  const pressH = () => (scene.decorateHere as () => void).call(scene);
  return { pressH, said, decorating: () => decorating };
}

describe('H in a house', () => {
  it("tells a visitor the owner's things are not theirs to move", () => {
    const house = houseScene({ ownerId: 'pip-id', ownerName: 'PIP' });
    house.pressH();
    expect(house.said).toEqual([["This is PIP's house - nothing here is yours to move."]]);
    expect(house.decorating()).toBe(0);
  });

  it('picks up the player\'s own house to decorate, saying nothing', () => {
    const house = houseScene(null);
    house.pressH();
    expect(house.decorating()).toBe(1);
    expect(house.said).toEqual([]);
  });
});

/**
 * K on the step outside THE BOLTHOLE (playtest 48): the knock screen's way back
 * said HOUSE, though ESC put the player back in the yard they were standing in.
 */
describe('the knock screen says where ESC goes', () => {
  function knockFrom(room: object | undefined) {
    knockScreens.length = 0;
    const scene = Object.create(BaseScene.prototype) as Record<string, unknown>;
    Object.assign(scene, {
      place: { room },
      facing: 'down',
      learnKey: () => undefined,
      showHint: () => undefined,
      player: { stop: () => undefined, setFrame: () => undefined },
    });
    (scene.openKnock as () => void).call(scene);
    const from = knockScreens[0]?.[4] as 'house' | 'step';
    return knockScreenMarkup({ kind: 'houses', houses: [] }, from);
  }

  it('back to the yard when it was opened on the step', () => {
    const markup = knockFrom(undefined);
    expect(markup).toContain('>Yard</button>');
    expect(markup).not.toContain('>House</button>');
  });

  it('back into the house when it was opened inside', () => {
    expect(knockFrom({ id: 'bolthole', home: true })).toContain('>House</button>');
  });
});
