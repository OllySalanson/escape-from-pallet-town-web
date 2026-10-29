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
  harbour: () => ({ seenAs: 'me', figuresHere: () => [], link: { nudge: () => undefined } }),
  harbourHouses: () => ({ service: {}, door: frontDoor.door }),
}));

import { BaseScene } from './BaseScene';
import { HouseDoor } from '../harbour/houseDoor';
import type { HouseService, KnockAtTheDoor } from '../harbour/houseService';
import { KNOCK_SIGN_LINE, knockScreenMarkup } from '../home/knocking';
import { HOME_SIGN } from '../base/baseMap';

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
 * Knocking is a sign, not a key (the captain, 23 Oct): THE BOLTHOLE's garden
 * sign is read like any other, says in the ordinary text box whose door to
 * pick, and once that line is read the list of players comes up, opened from
 * the yard so ESC goes back to it.
 */
describe('the knock sign in the garden', () => {
  function yardBeforeTheSign() {
    knockScreens.length = 0;
    const shown: string[][] = [];
    const dialogBox = {
      x: 0,
      visible: false,
      isCurrentMessageComplete: true,
      setY: () => dialogBox,
      showMessages: (lines: string[]) => {
        shown.push(lines);
        dialogBox.visible = true;
      },
      advance: () => {
        dialogBox.visible = false;
        return true;
      },
      skip: () => undefined,
    };
    let pressed = false;
    const scene = Object.create(BaseScene.prototype) as Record<string, unknown>;
    Object.assign(scene, {
      place: { room: undefined },
      // On the path beside the sign, facing it.
      currentTile: { x: HOME_SIGN.x - 1, y: HOME_SIGN.y },
      facing: 'right',
      fixtures: [],
      afterSaid: null,
      leaving: false,
      partnerAt: () => false,
      dialogBox,
      cameras: { main: { worldView: { left: 0, top: 0 } } },
      scale: { height: 240 },
      spentPresses: { spendHeld: () => undefined },
      directionKeys: () => [],
      isInteractionPressed: () => pressed,
      showHint: () => undefined,
      player: { stop: () => undefined, setFrame: () => undefined },
    });
    const press = () => {
      pressed = true;
      (scene.handleDialogInput as () => void).call(scene);
      pressed = false;
    };
    return { scene, shown, press, dialogBox };
  }

  it('asks whose door in the text box, then opens the list of players once that is read', () => {
    const yard = yardBeforeTheSign();
    (yard.scene.tryInteract as () => void).call(yard.scene);
    expect(yard.shown).toEqual([[KNOCK_SIGN_LINE]]);
    expect(KNOCK_SIGN_LINE).toBe('Select the player you want to knock on the door of.');
    // The list waits until the line has been read.
    expect(knockScreens).toHaveLength(0);
    yard.press();
    expect(yard.dialogBox.visible).toBe(false);
    expect(knockScreens).toHaveLength(1);
    expect(yard.scene.knockScreen).toBeTruthy();
  });

  it('opens the list once only, however many more lines are said after', () => {
    const yard = yardBeforeTheSign();
    (yard.scene.tryInteract as () => void).call(yard.scene);
    yard.press();
    (yard.scene.say as (lines: string[], about: unknown[]) => void).call(yard.scene, ['Something else.'], []);
    yard.press();
    expect(knockScreens).toHaveLength(1);
  });

  it('lists every player by name, and goes back to the yard', () => {
    const markup = knockScreenMarkup({
      kind: 'houses',
      houses: [
        { id: 'amy-id', name: 'AMY', atHome: true },
        { id: 'pip-id', name: 'PIP', atHome: false },
      ],
    });
    expect(markup).toContain('data-knock="amy-id"');
    expect(markup).toContain('<strong class="px-name">AMY</strong>');
    expect(markup).toContain('<strong class="px-name">PIP</strong>');
    expect(markup).toContain('2 players');
    expect(markup).toContain('>Yard</button>');
  });
});

/**
 * The hint on THE BOLTHOLE's mat (playtest 48): everybody arrives on the mat,
 * and the house's own keys went unsaid there - only `[DOWN] OUT` - so H, which
 * decorates, was never named to a player who had not stepped off it. There is
 * no knock key to name: knocking is the garden sign.
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

  it('names decorating beside the way out', () => {
    expect(hintOnMat(false)).toBe('[H] DECORATE   [DOWN] OUT');
  });

  it('stops naming a key once it has been used', () => {
    expect(hintOnMat(false, ['decorate'])).toBe('[DOWN] OUT');
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
  async function askedAtHome({ decorating = false } = {}) {
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
      decor: decorating ? { draw: () => undefined } : null,
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

  it('asks an owner who is decorating, rather than leaving the knocker to be told nobody came', async () => {
    // Playtest 49: the question waited for the decorating to end, which can
    // be minutes, and the knock ran out with the owner home and busy.
    const home = await askedAtHome({ decorating: true });
    expect(home.prompts()).toEqual({ up: 1, down: 0 });
  });
});
