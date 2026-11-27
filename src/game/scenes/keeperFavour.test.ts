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

// The shared harbour is nobody's here: nobody to wave at.
vi.mock('../harbour/harbour', () => ({ harbour: () => null, harbourHouses: () => null }));

import { BaseScene } from './BaseScene';
import { KEEPER_GREETINGS } from '../hub/keeperGreetings';
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
import { errandOf, forgetDeclinedErrands, harbourGiver, type ErrandRecord } from '../hub/errands';
import { HARBOUR_PEOPLE } from '../base/harbourLife';
import { KOGA_BOSS_ID, MISTY_BOSS_ID } from '../world/valeQuarters';

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
const GREETING = [KEEPER_GREETINGS.workshop];

/**
 * Brock's workshop with the player on its mat: a save that has opened his
 * crate's map, these favours in hand and this much in the vault. Saying and the
 * question are caught rather than drawn.
 */
function workshop(
  errands: readonly ErrandRecord[] = [],
  vault: Record<string, number> = {},
  raidProgress: Partial<RaidProgress> = {},
  where: 'workshop' | 'pier' = 'workshop',
) {
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
  const captain = HARBOUR_PEOPLE.find((person) => person.id === 'ss-anne-captain')!;
  const faced: string[] = [];
  const said: string[][] = [];
  const opened: string[] = [];
  let afterSaid: (() => void) | null = null;
  let lineShown: ((index: number) => void) | undefined;
  const scene = Object.create(BaseScene.prototype) as Record<string, unknown>;
  Object.assign(scene, {
    saveManager: saves,
    savedGame: saves.load()!,
    ...(where === 'workshop'
      ? { place: { room: { room } }, currentTile: room.mat!, facing: 'up' }
      : {
          // On the long pier, just south of the captain and facing him.
          place: { room: undefined },
          currentTile: { x: captain.position.x, y: captain.position.y + 1 },
          facing: 'up',
          harbourLife: {
            at: (tile: { x: number; y: number }) =>
              tile.x === captain.position.x && tile.y === captain.position.y ? captain : undefined,
            face: (id: string) => faced.push(id),
          },
          harbourMarks: new Map(),
        }),
    partnerAt: () => false,
    dialogBox: { x: 44, y: 176 },
    player: { stop: () => undefined, setFrame: () => undefined },
    showHint: () => undefined,
    spentPresses: { spendHeld: () => undefined },
    directionKeys: () => [],
    keeperMark: null,
    leaving: false,
    visit: null,
    openHub: (payload: { view: string }) => opened.push(payload.view),
    say: (lines: readonly string[], _about: unknown, then?: () => void, onLine?: (index: number) => void) => {
      said.push([...lines]);
      afterSaid = then ?? null;
      lineShown = onLine;
    },
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
  /** His screen closed, back into his room: the base starts there again (`BaseScene.favourOwedIn`). */
  const back = (): void => (scene.favourOwedIn as (room: unknown) => (() => void) | undefined).call(scene, room)?.();
  return { scene, said, faced, opened, talk, read, back, answer, stored, lineShown: () => lineShown };
}

/**
 * A favour is asked the way anybody in the harbour speaks: in the dialogue box
 * over the room, a few short lines, then a question with YES and NOT NOW under
 * it. It is asked after what the key was for, never in front of it: Brock
 * greets and his screen opens, and he asks as it closes back into his room.
 * Said first, it stacked three boxes and a question before the screen the
 * player came in for (the harbour audit, 27 Nov 2026).
 */
describe("a keeper's favour, asked in the room", () => {
  beforeEach(() => forgetDeclinedErrands());

  it('waits for his screen to close, then sets the scene, says what to fetch, and asks - YES first, as FireRed asks', () => {
    const brock = workshop();
    brock.talk();
    expect(brock.said).toEqual([GREETING]);
    brock.read();
    expect(brock.opened).toEqual(['workshop']);
    expect(questions).toHaveLength(0);
    brock.back();
    expect(brock.said.at(-1)).toEqual(BROCK.asks);
    // Nothing is taken on until it is answered.
    expect(questions).toHaveLength(0);
    brock.read();
    expect(questions).toHaveLength(1);
    expect(questions[0].lines).toEqual([BROCK.question]);
    expect(questions[0].options).toEqual(['YES', 'NOT NOW']);
    expect(questions[0].selected).toBe(0);
    expect(brock.stored().raidProgress.errands).toEqual([]);
  });

  it('is the keeper\'s key on the mat even with the partner standing in front, where it arrives', () => {
    const brock = workshop();
    const partnerTalks: number[] = [];
    Object.assign(brock.scene, { partnerAt: () => true, talkToPartner: () => partnerTalks.push(1) });
    brock.talk();
    expect(partnerTalks).toEqual([]);
    expect(brock.said).toEqual([GREETING]);
  });

  it('takes the favour on a YES and says so', () => {
    const brock = workshop();
    brock.talk();
    brock.read();
    brock.back();
    brock.read();
    brock.answer('YES');
    expect(questions[0].destroyed).toBe(true);
    expect(brock.said.at(-1)).toEqual([BROCK.accepted]);
    expect(brock.stored().raidProgress.errands).toEqual([
      { id: BROCK.id, status: 'started', found: 0, lossesHeard: 0 },
    ]);
  });

  it('leaves a NOT NOW untaken, and asks again only after the next raid', () => {
    const brock = workshop();
    brock.talk();
    brock.read();
    brock.back();
    brock.read();
    brock.answer('NOT NOW');
    expect(brock.said.at(-1)).toEqual([BROCK.declined]);
    expect(brock.stored().raidProgress.errands).toEqual([]);

    // Back at his counter before going anywhere: his greeting and his screen, and no favour.
    brock.talk();
    expect(brock.said.at(-1)).toEqual(GREETING);
    brock.read();
    brock.back();
    expect(brock.said.at(-1)).toEqual(GREETING);
    expect(brock.said.filter((lines) => lines[0] === BROCK.asks[0])).toHaveLength(1);

    // A raid later, the same save is asked again.
    const later = workshop([], {}, { raidRecord: { 'floodplain-relay': { deployed: 1, extracted: 1, wiped: 0 } } });
    later.talk();
    later.read();
    later.back();
    expect(later.said).toEqual([GREETING, BROCK.asks]);
  });

  it('asks nothing of a favour already taken', () => {
    const brock = workshop([{ id: BROCK.id, status: 'started', found: 0, lossesHeard: 0 }]);
    brock.talk();
    brock.read();
    brock.back();
    expect(brock.said).toEqual([GREETING]);
  });

  it('greets the same on every visit, whatever the save has heard', () => {
    const brock = workshop([], {}, { firstWordsHeard: [] });
    brock.talk();
    expect(brock.said[0]).toEqual(GREETING);
    brock.read();
    brock.back();
    expect(brock.said[1]).toEqual(BROCK.asks);
  });

  it('takes the crate and pays as his screen closes, paid as it is said', () => {
    const brock = workshop([{ id: BROCK.id, status: 'started', found: 1, lossesHeard: 0 }], { [BROCK.itemId]: 1 });
    brock.talk();
    brock.read();
    // His screen is open on his ladder, and the crate is still the player's.
    expect(brock.stored().stash.itemCount(BROCK.itemId)).toBe(1);
    brock.back();
    expect(brock.said.at(-1)).toEqual(["You handed over Brock's crate.", ...BROCK.thanks, 'You received TM39 from Brock.']);
    // Paid before a word is read, so it is paid once however the room is left.
    const after = brock.stored();
    expect(after.stash.itemCount(BROCK.itemId)).toBe(0);
    expect(after.stash.itemCount('tm39-rock-tomb')).toBe(1);
    expect(after.raidProgress.errands?.[0].status).toBe('completed');
    expect(brock.lineShown()).toBeTypeOf('function');
  });

  it('asks after a crate that was found and lost, once', () => {
    const brock = workshop([{ id: BROCK.id, status: 'started', found: 1, lossesHeard: 0 }]);
    brock.talk();
    brock.read();
    brock.back();
    expect(brock.said.at(-1)).toEqual(BROCK.lost);
    expect(brock.stored().raidProgress.errands?.[0].lossesHeard).toBe(1);
    brock.talk();
    brock.read();
    brock.back();
    expect(brock.said.filter((lines) => lines[0] === BROCK.lost[0])).toHaveLength(1);
  });
});

/**
 * The captain's ask was for people walking about who give you missions: the
 * S.S. Anne's captain on the long pier asks his favour in the same box, and
 * with no counter behind him there is nothing to open after it.
 */
describe('a favour asked by somebody about the harbour', () => {
  beforeEach(() => forgetDeclinedErrands());
  const LOG = errandOf(harbourGiver('ss-anne-captain'))!;

  it('waits to ask while the Marsh his ship lies in is shut behind Koga', () => {
    const pier = workshop([], {}, { defeatedBosses: [MISTY_BOSS_ID] }, 'pier');
    pier.talk();
    expect(pier.said).not.toContainEqual(LOG.asks);
    expect(pier.stored().raidProgress.errands ?? []).toEqual([]);
  });

  it('turns to the player, asks, and takes a YES with nothing opened after', () => {
    // THE WRECK is in the Marsh, so the log is asked for once Koga is beaten.
    const pier = workshop([], {}, { defeatedBosses: [MISTY_BOSS_ID, KOGA_BOSS_ID] }, 'pier');
    pier.talk();
    expect(pier.faced).toEqual(['ss-anne-captain']);
    expect(pier.said).toEqual([LOG.asks]);
    pier.read();
    expect(questions.at(-1)!.lines).toEqual([LOG.question]);
    pier.answer('YES');
    expect(pier.said.at(-1)).toEqual([LOG.accepted]);
    expect(pier.stored().raidProgress.errands).toEqual([{ id: LOG.id, status: 'started', found: 0, lossesHeard: 0 }]);
    pier.read();
    expect(pier.said.at(-1)).toEqual([LOG.accepted]);
  });

  it('hands the log over on the pier and pays HM01', () => {
    const pier = workshop([{ id: LOG.id, status: 'started', found: 1, lossesHeard: 0 }], { [LOG.itemId]: 1 }, {}, 'pier');
    pier.talk();
    expect(pier.said).toEqual([["You handed over Ship's log.", ...LOG.thanks, 'You received HM01 from Captain Hale.']]);
    expect(pier.stored().stash.itemCount('hm01-cut')).toBe(1);
    expect(pier.stored().stash.itemCount(LOG.itemId)).toBe(0);
  });
});
