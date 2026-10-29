import { beforeEach, describe, expect, it, vi } from 'vitest';

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

/** The question as the dialogue box would draw it, with the answer the cursor rests on. */
interface AskedQuestion {
  readonly lines: readonly string[];
  readonly options: readonly string[];
  readonly selected: number;
  readonly onChoose: (index: number) => void;
  destroyed: boolean;
}
const questions = vi.hoisted(() => [] as AskedQuestion[]);
vi.mock('../ui/ChoicePrompt', () => ({
  ChoicePrompt: class {
    public readonly asked: AskedQuestion;
    public constructor(_scene: unknown, options: Omit<AskedQuestion, 'destroyed'>) {
      this.asked = { ...options, destroyed: false };
      questions.push(this.asked);
    }
    public confirm(): void {
      this.asked.onChoose(this.asked.selected);
    }
    public destroy(): void {
      this.asked.destroyed = true;
    }
  },
}));

import { BaseScene } from './BaseScene';
import { Bag } from '../items';
import { CHARMANDER, PokemonParty } from '../pokemon';
import { createStartingStash } from '../stash';
import { FIRST_CONTRACT_ID } from '../objectives/contracts';
import {
  CONTRACT_REWARD_INSERTIONS,
  DEFAULT_RAID_PROGRESS,
  SaveManager,
  type RaidProgress,
  type StorageLike,
} from '../save/SaveManager';
import { roomNamed } from '../base/rooms';
import { errandOf, forgetDeclinedErrands, type ErrandRecord } from '../hub/errands';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
  public removeItem(key: string): void {
    this.values.delete(key);
  }
}

const BROCK = errandOf('workshop')!;

/**
 * Brock's workshop with the player on its mat: a save that has opened his
 * crate's map, these favours in hand and this much in the vault. Saying, the
 * question and opening the screen are caught rather than drawn.
 */
function workshop(errands: readonly ErrandRecord[] = [], vault: Record<string, number> = {}, raidProgress: Partial<RaidProgress> = {}) {
  questions.length = 0;
  const storage = new MemoryStorage();
  const saves = new SaveManager(storage);
  const stash = createStartingStash(CHARMANDER);
  for (const [itemId, quantity] of Object.entries(vault)) {
    stash.addItem(itemId, quantity);
  }
  saves.save({
    party: new PokemonParty(),
    mapId: 'pallet-town',
    position: { x: 6, y: 8 },
    bag: new Bag(),
    stash,
    starterSpeciesId: 'charmander',
    raidProgress: {
      ...DEFAULT_RAID_PROGRESS,
      completedContracts: [FIRST_CONTRACT_ID],
      unlockedInsertions: ['floodplain-relay', ...CONTRACT_REWARD_INSERTIONS, 'greystone-vale'],
      errands: [...errands],
      ...raidProgress,
    },
  });
  const room = roomNamed('brocks-workshop')!;
  const said: string[][] = [];
  const screens: string[] = [];
  let afterSaid: (() => void) | null = null;
  let lineShown: ((index: number) => void) | undefined;
  const scene = Object.create(BaseScene.prototype) as Record<string, unknown>;
  Object.assign(scene, {
    saveManager: saves,
    savedGame: saves.load()!,
    place: { room: { room } },
    currentTile: room.mat!,
    facing: 'up',
    partnerAt: () => false,
    dialogBox: { x: 44, y: 176 },
    player: { stop: () => undefined, setFrame: () => undefined },
    showHint: () => undefined,
    spentPresses: { spendHeld: () => undefined },
    directionKeys: () => [],
    keeperMark: null,
    say: (lines: readonly string[], _about: unknown, then?: () => void, onLine?: (index: number) => void) => {
      said.push([...lines]);
      afterSaid = then ?? null;
      lineShown = onLine;
    },
    openScreen: (_room: unknown, screen: string) => screens.push(screen),
  });
  const talk = (): void => (scene.tryInteract as () => void).call(scene);
  /** Reads the box to its end, as the key does. */
  const read = (): void => {
    const then = afterSaid;
    afterSaid = null;
    then?.();
  };
  const answer = (choice: 'YES' | 'NOT NOW'): void => {
    const question = questions.at(-1)!;
    question.onChoose(question.options.indexOf(choice));
  };
  const stored = () => new SaveManager(storage).load()!;
  return { scene, said, screens, talk, read, answer, stored, lineShown: () => lineShown };
}

/**
 * A favour is asked the way anybody in the harbour speaks: in the dialogue box
 * over the room, a few short lines, then a question with YES and NOT NOW under
 * it - and only after that the keeper's screen, which is what the key was for.
 * It used to be laid over the screen and taken before it was read.
 */
describe("a keeper's favour, asked in the room", () => {
  beforeEach(() => forgetDeclinedErrands());

  it('sets the scene, says what to fetch, and asks - YES first, as FireRed asks', () => {
    const brock = workshop();
    brock.talk();
    expect(brock.said).toEqual([BROCK.asks]);
    // Nothing is taken on, and nothing opened, until it is answered.
    expect(questions).toHaveLength(0);
    brock.read();
    expect(questions).toHaveLength(1);
    expect(questions[0].lines).toEqual([BROCK.question]);
    expect(questions[0].options).toEqual(['YES', 'NOT NOW']);
    expect(questions[0].selected).toBe(0);
    expect(brock.screens).toEqual([]);
    expect(brock.stored().raidProgress.errands).toEqual([]);
  });

  it('takes the favour on a YES, says so, and then opens his screen', () => {
    const brock = workshop();
    brock.talk();
    brock.read();
    brock.answer('YES');
    expect(questions[0].destroyed).toBe(true);
    expect(brock.said.at(-1)).toEqual([BROCK.accepted]);
    expect(brock.stored().raidProgress.errands).toEqual([
      { id: BROCK.id, status: 'started', found: 0, lossesHeard: 0 },
    ]);
    expect(brock.screens).toEqual([]);
    brock.read();
    expect(brock.screens).toEqual(['workshop']);
  });

  it('leaves a NOT NOW untaken, opens his screen, and asks again only after the next raid', () => {
    const brock = workshop();
    brock.talk();
    brock.read();
    brock.answer('NOT NOW');
    expect(brock.said.at(-1)).toEqual([BROCK.declined]);
    expect(brock.stored().raidProgress.errands).toEqual([]);
    brock.read();
    expect(brock.screens).toEqual(['workshop']);

    // Back at his counter before going anywhere: straight to the screen.
    brock.talk();
    expect(brock.said).toHaveLength(2);
    expect(brock.screens).toEqual(['workshop', 'workshop']);

    // A raid later, the same save is asked again.
    const later = workshop([], {}, { raidRecord: { 'floodplain-relay': { deployed: 1, extracted: 1, wiped: 0 } } });
    later.talk();
    expect(later.said).toEqual([BROCK.asks]);
  });

  it('asks nothing of a favour already taken, and goes straight to the screen', () => {
    const brock = workshop([{ id: BROCK.id, status: 'started', found: 0, lossesHeard: 0 }]);
    brock.talk();
    expect(brock.said).toEqual([]);
    expect(brock.screens).toEqual(['workshop']);
  });

  it('takes the crate and pays as it is said, then opens the screen', () => {
    const brock = workshop([{ id: BROCK.id, status: 'started', found: 1, lossesHeard: 0 }], { [BROCK.itemId]: 1 });
    brock.talk();
    expect(brock.said).toEqual([
      ["You handed over Brock's crate.", ...BROCK.thanks, 'You received TM39 from Brock.'],
    ]);
    // Paid before a word is read, so it is paid once however the room is left.
    const after = brock.stored();
    expect(after.stash.itemCount(BROCK.itemId)).toBe(0);
    expect(after.stash.itemCount('tm39-rock-tomb')).toBe(1);
    expect(after.raidProgress.errands?.[0].status).toBe('completed');
    expect(brock.lineShown()).toBeTypeOf('function');
    brock.read();
    expect(brock.screens).toEqual(['workshop']);
  });

  it('asks after a crate that was found and lost, once', () => {
    const brock = workshop([{ id: BROCK.id, status: 'started', found: 1, lossesHeard: 0 }]);
    brock.talk();
    expect(brock.said).toEqual([BROCK.lost]);
    expect(brock.stored().raidProgress.errands?.[0].lossesHeard).toBe(1);
    brock.read();
    brock.talk();
    expect(brock.said).toHaveLength(1);
    expect(brock.screens).toEqual(['workshop', 'workshop']);
  });
});
