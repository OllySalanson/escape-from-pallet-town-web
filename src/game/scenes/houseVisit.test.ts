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
const frontDoor = vi.hoisted(
  (): { door: unknown; service: unknown; visit: unknown } => ({ door: {}, service: {}, visit: null }),
);
const others = vi.hoisted(
  (): { here: { tile: { x: number; y: number }; toward: null; id?: string; name?: string }[]; nudged: string[] } => ({
    here: [],
    nudged: [],
  }),
);
vi.mock('../harbour/harbour', () => ({
  harbour: () => ({
    seenAs: 'me',
    figuresHere: () => others.here,
    standing: () => true,
    link: { nudge: (to: string) => others.nudged.push(to) },
  }),
  harbourHouses: () => frontDoor,
}));

import { BaseScene } from './BaseScene';
import { HouseDoor } from '../harbour/houseDoor';
import type { HouseService, KnockAtTheDoor } from '../harbour/houseService';
import { HouseVisitWatch } from '../harbour/houseVisit';
import { KNOCK_SIGN_LINE, LET_STAY, SEE_OUT, knockScreenMarkup } from '../home/knocking';
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
      keyPresses: { justPressed: () => false },
      controls: { back: {} },
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
 * and the house's own keys went unsaid there - only `[DOWN] OUT` - so the key
 * that decorates was never named to a player who had not stepped off it. There
 * is no knock key to name: knocking is the garden sign. And it is named for
 * good, ahead of the partner beside the mat: the explorer run has learned every
 * key and the partner took the line, so furniture bought with tickets came home
 * to a house that never said how to put it out (the captain, 7 Nov 2026).
 */
describe('the hint on the house mat', () => {
  function hintOnMat(visit: boolean, keysLearned: string[] = [], facing = 'down', partnerInFront = false): string {
    const mat = { x: 4, y: 8 };
    const scene = Object.create(BaseScene.prototype) as Record<string, unknown>;
    Object.assign(scene, {
      place: { room: { room: { mat, keeper: null, things: [], stairs: [] }, home: {} } },
      currentTile: { ...mat },
      facing,
      partner: partnerInFront ? { name: 'CHARIZARD' } : null,
      partnerAt: () => partnerInFront,
      visit: visit ? { ownerId: 'pip-id', ownerName: 'PIP', game: {} } : null,
      savedGame: { raidProgress: { keysLearned } },
    });
    return (scene.hintHere as () => string).call(scene);
  }

  it('names the decorate key beside the way out', () => {
    expect(hintOnMat(false)).toBe('[H] DECORATE   [DOWN] OUT');
  });

  it('keeps naming it once it has been used, and ahead of the partner on the way in', () => {
    expect(hintOnMat(false, ['decorate'])).toBe('[H] DECORATE   [DOWN] OUT');
    expect(hintOnMat(false, ['decorate'], 'up', true)).toBe('[H] DECORATE   [DOWN] OUT');
    // In somebody else's house the partner still has the line.
    expect(hintOnMat(true, [], 'up', true)).toBe('[SPACE] CHARIZARD   [DOWN] OUT');
  });

  it("names none of them in somebody else's house", () => {
    expect(hintOnMat(true)).toBe('[DOWN] OUT');
  });

  it('says Space waves at another player standing in front of the mat', () => {
    // Playtest 49: facing somebody said nothing, so waving was never found.
    others.here = [{ tile: { x: 4, y: 7 }, toward: null }];
    try {
      expect(hintOnMat(true, [], 'up')).toBe('[SPACE] WAVE   [DOWN] OUT');
      // Facing away from them, the mat says what it always said.
      expect(hintOnMat(true, [], 'left')).toBe('[DOWN] OUT');
    } finally {
      others.here = [];
    }
  });
});

describe('the hint in the yard, facing another player', () => {
  it('says Space waves at them', () => {
    others.here = [{ tile: { x: 21, y: 12 }, toward: null }];
    try {
      const scene = Object.create(BaseScene.prototype) as Record<string, unknown>;
      Object.assign(scene, {
        place: { room: undefined },
        currentTile: { x: 20, y: 12 },
        facing: 'right',
        partner: null,
        visit: null,
        savedGame: { raidProgress: { keysLearned: ['look'] } },
      });
      expect((scene.hintHere as () => string).call(scene)).toBe('[SPACE] WAVE');
    } finally {
      others.here = [];
    }
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

/**
 * A visitor at the owner's PC (the multiplayer bug hunt of 12 Nov 2026): MY PC
 * opened the visitor's own boxes, and backing out of them put the visitor in
 * their own house, ending the visit without a word. The PC is the owner's, as
 * the bed, the console and the wardrobe are, so it says so and opens nothing.
 */
describe("the owner's PC in somebody else's house", () => {
  function facingThePc(visit: boolean) {
    const said: string[][] = [];
    const opened: unknown[] = [];
    const pc = { name: visit ? "PIP'S PC" : 'MY PC', note: '', tiles: [{ x: 0, y: 1 }], opens: 'boxes' };
    const scene = Object.create(BaseScene.prototype) as Record<string, unknown>;
    Object.assign(scene, {
      place: { room: { room: { id: 'house-upstairs', mat: { x: 4, y: 8 }, things: [pc], stairs: [] }, home: {} } },
      currentTile: { x: 0, y: 2 },
      facing: 'up',
      visit: visit ? { ownerId: 'pip-id', ownerName: 'PIP', game: {} } : null,
      savedGame: { raidProgress: { keysLearned: [] } },
      choosing: false,
      rivalHere: false,
      arena: null,
      readPlaytestBoard: () => false,
      partnerAt: () => false,
      leaderOn: () => undefined,
      waveAt: () => false,
      facesTheStands: () => false,
      atTelescope: () => false,
      thingFaced: () => pc,
      say: (lines: readonly string[]) => said.push([...lines]),
      openHub: (payload: unknown) => opened.push(payload),
    });
    (scene.tryInteract as () => void).call(scene);
    return { said, opened };
  }

  it("tells a visitor it is the owner's, and opens nothing", () => {
    const visitor = facingThePc(true);
    expect(visitor.opened).toEqual([]);
    expect(visitor.said).toEqual([["That's PIP's. Better not touch."]]);
  });

  it("opens the player's own boxes in their own house", () => {
    const owner = facingThePc(false);
    expect(owner.said).toEqual([]);
    expect(owner.opened).toEqual([expect.objectContaining({ view: 'stash', from: 'house-upstairs' })]);
  });
});

/**
 * A visit lasts until the visitor walks out or the owner sees them out (the
 * captain, 12 Nov 2026: why only ten minutes?). The owner's side: facing
 * somebody in their own house asks whether to see them out, the cursor on
 * LET THEM STAY. The visitor's side: told why, and walked out to their own step.
 */
describe('seeing a visitor out of your own house', () => {
  function ownHouseFacingAmy() {
    others.here = [{ tile: { x: 4, y: 7 }, toward: null, id: 'amy-id', name: 'AMY' }];
    others.nudged = [];
    const shownOut: string[] = [];
    frontDoor.service = {
      showOut: (visitor: string) => {
        shownOut.push(visitor);
        return Promise.resolve(true);
      },
    };
    const said: string[][] = [];
    const asked: { question: string; answer: (yes: boolean) => void; options: unknown }[] = [];
    const scene = Object.create(BaseScene.prototype) as Record<string, unknown>;
    Object.assign(scene, {
      place: { room: { room: { id: 'bolthole', mat: { x: 4, y: 8 }, keeper: null, screen: null, things: [], stairs: [] }, home: {} } },
      currentTile: { x: 4, y: 8 },
      facing: 'up',
      partner: null,
      partnerAt: () => false,
      visit: null,
      savedGame: { raidProgress: { keysLearned: [] } },
      choosing: false,
      rivalHere: false,
      arena: null,
      readPlaytestBoard: () => false,
      leaderOn: () => undefined,
      player: { stop: () => undefined, setFrame: () => undefined },
      say: (lines: readonly string[]) => said.push([...lines]),
      askInBox: (question: string, answer: (yes: boolean) => void, options: unknown) =>
        asked.push({ question, answer, options }),
    });
    return { scene, said, asked, shownOut };
  }

  it('names the visitor on the hint line, rather than offering a wave', () => {
    const home = ownHouseFacingAmy();
    try {
      expect((home.scene.hintHere as () => string).call(home.scene)).toBe('[SPACE] AMY   [DOWN] OUT');
    } finally {
      others.here = [];
    }
  });

  it('asks whether to see them out, starting on LET THEM STAY, and sees them out on SEE THEM OUT', async () => {
    const home = ownHouseFacingAmy();
    try {
      (home.scene.tryInteract as () => void).call(home.scene);
      expect(home.asked).toHaveLength(1);
      expect(home.asked[0].question).toBe('AMY is visiting. See them out?');
      expect(home.asked[0].options).toEqual({ startOnNotNow: true, options: [SEE_OUT, LET_STAY] });
      home.asked[0].answer(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(home.shownOut).toEqual(['amy-id']);
      // AMY's browser is told to look now, so she hears at once.
      expect(others.nudged).toEqual(['amy-id']);
      expect(home.said).toEqual([['You see AMY to the door.']]);
    } finally {
      others.here = [];
    }
  });

  it('lets them stay on LET THEM STAY', () => {
    const home = ownHouseFacingAmy();
    try {
      (home.scene.tryInteract as () => void).call(home.scene);
      home.asked[0].answer(false);
      expect(home.shownOut).toEqual([]);
      expect(home.said).toEqual([]);
    } finally {
      others.here = [];
    }
  });
});

describe('a visit that ends while the visitor is inside', () => {
  function visitorIn(ending: 'shown-out' | 'owner-gone' | 'over') {
    const said: { lines: string[]; then?: () => void }[] = [];
    const went: unknown[] = [];
    const watch = { ownerId: 'pip-id', tick: () => undefined, ended: ending };
    frontDoor.visit = watch;
    const scene = Object.create(BaseScene.prototype) as Record<string, unknown>;
    Object.assign(scene, {
      visit: { ownerId: 'pip-id', ownerName: 'PIP', game: {} },
      visitEnding: false,
      leaving: false,
      dialogBox: { visible: false },
      boxQuestion: null,
      targetTile: null,
      facing: 'down',
      savedGame: { raidProgress: {} },
      player: { stop: () => undefined, setFrame: () => undefined },
      closePhrases: () => undefined,
      say: (lines: readonly string[], _about: unknown, then?: () => void) => said.push({ lines: [...lines], then }),
      goTo: (data: unknown) => went.push(data),
    });
    const frame = () => (scene.watchVisit as (time: number) => void).call(scene, 0);
    return { scene, said, went, frame };
  }

  it.each([
    ['shown-out', 'PIP sees you to the door. Time to head home.'],
    ['owner-gone', 'PIP has left the harbour, so you let yourself out.'],
    ['over', "Your visit to PIP's house is over. You head home."],
  ] as const)('says why (%s), once, and walks the visitor out to their own step after', (ending, line) => {
    const visitor = visitorIn(ending);
    visitor.frame();
    visitor.frame();
    expect(visitor.said.map((each) => each.lines)).toEqual([[line]]);
    expect(visitor.went).toEqual([]);
    visitor.said[0].then?.();
    expect(visitor.went).toEqual([expect.objectContaining({ from: 'bolthole' })]);
    frontDoor.visit = null;
  });

  it('waits for whatever is being read to be read first', () => {
    const visitor = visitorIn('shown-out');
    (visitor.scene.dialogBox as { visible: boolean }).visible = true;
    visitor.frame();
    expect(visitor.said).toEqual([]);
    (visitor.scene.dialogBox as { visible: boolean }).visible = false;
    visitor.frame();
    expect(visitor.said).toHaveLength(1);
    frontDoor.visit = null;
  });
});

describe('the watch on a visit', () => {
  it('begins on stepping into a house, is kept up and down its stairs, and tells the database on walking out', () => {
    const left: string[] = [];
    frontDoor.service = { leaveHouse: (owner: string) => (left.push(owner), Promise.resolve()) };
    frontDoor.visit = null;
    const scene = Object.create(BaseScene.prototype) as Record<string, unknown>;
    const keep = (visit: { ownerId: string } | null) => {
      scene.visit = visit;
      (scene.keepVisitWatch as () => void).call(scene);
    };
    keep({ ownerId: 'pip-id' });
    const watch = frontDoor.visit as HouseVisitWatch;
    expect(watch).toBeInstanceOf(HouseVisitWatch);
    expect(watch.ownerId).toBe('pip-id');
    // Upstairs is the same visit.
    keep({ ownerId: 'pip-id' });
    expect(frontDoor.visit).toBe(watch);
    expect(left).toEqual([]);
    // Out on the visitor's own step.
    keep(null);
    expect(frontDoor.visit).toBeNull();
    expect(left).toEqual(['pip-id']);
  });
});
