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
const frontDoor = vi.hoisted((): { door: unknown } => ({ door: {} }));
vi.mock('../harbour/harbour', () => ({
  harbour: () => ({ seenAs: 'me', link: { nudge: () => undefined } }),
  harbourHouses: () => ({ service: {}, door: frontDoor.door }),
}));

import { BaseScene } from './BaseScene';
import { HouseDoor } from '../harbour/houseDoor';
import type { HouseService, KnockAtTheDoor } from '../harbour/houseService';
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

/**
 * The hint on THE BOLTHOLE's mat (playtest 48): everybody arrives on the mat,
 * and the house's own keys went unsaid there - only `[DOWN] OUT` - so K, which
 * knocks from inside, was never named to a player who had not stepped off it.
 */
describe('the hint on the house mat', () => {
  function hintOnMat(visit: boolean, keysLearned: string[] = []): string {
    const mat = { x: 4, y: 8 };
    const scene = Object.create(BaseScene.prototype) as Record<string, unknown>;
    Object.assign(scene, {
      place: { room: { room: { mat, keeper: null, things: [] }, home: {} } },
      currentTile: { ...mat },
      facing: 'down',
      partner: null,
      visit: visit ? { ownerId: 'pip-id', ownerName: 'PIP', game: {} } : null,
      savedGame: { raidProgress: { keysLearned } },
    });
    return (scene.hintHere as () => string).call(scene);
  }

  it('names decorating and knocking beside the way out', () => {
    expect(hintOnMat(false)).toBe('[H] DECORATE   [K] KNOCK   [DOWN] OUT');
  });

  it('stops naming a key once it has been used', () => {
    expect(hintOnMat(false, ['decorate', 'knock'])).toBe('[DOWN] OUT');
  });

  it("names none of them in somebody else's house", () => {
    expect(hintOnMat(true)).toBe('[DOWN] OUT');
  });
});

/**
 * A knock the knocker has walked away from (playtest 48, finding 8): the owner
 * was still asked "AMY is at your door." six seconds after AMY stopped
 * knocking, and LET THEM IN opened the door to nobody. The question is taken
 * down once the knock is no longer at the door - withdrawn by the knocker's
 * browser, or run out.
 */
describe('a knock that is no longer at the door', () => {
  async function askedAtHome() {
    let knocks: KnockAtTheDoor[] = [{ knockId: 'k-1', knockerName: 'AMY' }];
    const service = {
      atHome: () => Promise.resolve(),
      knocksAtMyDoor: () => Promise.resolve(knocks),
      answer: () => Promise.resolve(),
    } as unknown as HouseService;
    const door = new HouseDoor(service);
    frontDoor.door = door;
    door.inside({});
    door.tick(1);
    for (let turn = 0; turn < 3; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));
    const said: string[][] = [];
    let promptsUp = 0;
    let promptsDown = 0;
    const layout = undefined;
    const scene = Object.create(BaseScene.prototype) as Record<string, unknown>;
    Object.assign(scene, {
      place: { room: { home: true } },
      visit: null,
      savedGame: { raidProgress: { homeLayout: layout } },
      doorTold: true,
      doorLayout: layout,
      knockPrompt: null,
      knockScreen: null,
      namePrompt: null,
      decor: null,
      resting: false,
      leaving: false,
      targetTile: null,
      dialogBox: { visible: false },
      directionKeys: () => [],
      spentPresses: { spendHeld: () => undefined },
      say: (lines: readonly string[]) => said.push([...lines]),
      askToLetIn(this: Record<string, unknown>, knock: KnockAtTheDoor) {
        promptsUp += 1;
        this.knockPrompt = { knock, prompt: { destroy: () => (promptsDown += 1) } };
      },
    });
    const frame = (time: number) => (scene.watchFrontDoor as (time: number) => void).call(scene, time);
    frame(2);
    return {
      door,
      frame,
      said,
      scene,
      runOut: () => {
        knocks = [];
      },
      prompts: () => ({ up: promptsUp, down: promptsDown }),
    };
  }

  it('takes the question down once the knocker has stopped knocking', async () => {
    const home = await askedAtHome();
    expect(home.prompts()).toEqual({ up: 1, down: 0 });
    home.door.withdrawn('k-1');
    home.frame(3);
    expect(home.prompts()).toEqual({ up: 1, down: 1 });
    expect(home.scene.knockPrompt).toBeNull();
    expect(home.said).toEqual([['AMY has gone from the step.']]);
    // Nor is the owner asked about the same knock again on the next look.
    home.door.knocked();
    home.frame(4);
    for (let turn = 0; turn < 3; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));
    home.frame(5);
    expect(home.prompts().up).toBe(1);
  });

  it('takes the question down once the knock has run out', async () => {
    const home = await askedAtHome();
    home.runOut();
    home.door.knocked();
    home.frame(3);
    for (let turn = 0; turn < 3; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));
    home.frame(4);
    expect(home.prompts()).toEqual({ up: 1, down: 1 });
    expect(home.said).toEqual([['AMY has gone from the step.']]);
  });

  it('keeps asking while the knock is still at the door', async () => {
    const home = await askedAtHome();
    home.door.knocked();
    home.frame(3);
    for (let turn = 0; turn < 3; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));
    home.frame(4);
    expect(home.prompts()).toEqual({ up: 1, down: 0 });
    expect(home.said).toEqual([]);
  });
});
