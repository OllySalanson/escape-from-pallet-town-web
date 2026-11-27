import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Math: { Vector2: class { public x = 0; public y = 0; } },
    Geom: { Rectangle: class { public static Contains = () => true; } },
    Input: { Keyboard: { KeyCodes: {}, JustDown: () => false }, Events: {} },
    Scenes: { Events: { SHUTDOWN: 'shutdown', UPDATE: 'update', RESUME: 'resume' } },
    Scale: { Events: { RESIZE: 'resize' } },
    BlendModes: { ADD: 1 },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
    GameObjects: { Container: class {}, Sprite: class {}, Rectangle: class {}, Text: class {} },
  },
}));
// The shared harbour is nobody's here.
vi.mock('../harbour/harbour', () => ({ harbour: () => null, harbourHouses: () => null }));

import { BaseScene } from './BaseScene';
import { roomNamed, type BaseRoom } from '../base/rooms';
import type { BaseScreen } from '../base/doors';
import { KEEPER_GREETINGS } from '../hub/keeperGreetings';
import { errandOf, forgetDeclinedErrands } from '../hub/errands';
import { FIRST_CONTRACT_ID } from '../objectives/contracts';
import { Bag } from '../items';
import { CHARMANDER, PokemonParty } from '../pokemon';
import { createStartingStash } from '../stash';
import { shareLine } from '../ui/dialogBoxes';
import { retireMapsForTests, RETIRED_MAPS } from '../world/mapRoster';
import { DEFAULT_RAID_PROGRESS, SAVE_KEY, SaveManager, type RaidProgress, type StorageLike } from '../save/SaveManager';
import sam from './keeperVisits.sam.fixture.json';
import jo from './keeperVisits.jo.fixture.json';

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

/** The harbour's dialogue box as words: two rows of about 38 characters (`ui/dialogBoxes.test.ts`). */
const wrap = (text: string): string[] => {
  const rows: string[] = [];
  for (const word of text.split(' ')) {
    const last = rows[rows.length - 1];
    if (last !== undefined && `${last} ${word}`.length <= 38) {
      rows[rows.length - 1] = `${last} ${word}`;
    } else {
      rows.push(word);
    }
  }
  return rows;
};

/** A save as the harbour critic tour stored it: Sam just home from the first raid, Jo ten raids in. */
function stored(json: unknown): SaveManager {
  const storage = new MemoryStorage();
  storage.setItem(SAVE_KEY, JSON.stringify(json));
  return new SaveManager(storage);
}

function fresh(raidProgress: Partial<RaidProgress> = {}, vault: Record<string, number> = {}): SaveManager {
  const manager = new SaveManager(new MemoryStorage());
  const stash = createStartingStash(CHARMANDER);
  for (const [itemId, quantity] of Object.entries(vault)) {
    stash.addItem(itemId, quantity);
  }
  manager.save({
    party: new PokemonParty(),
    mapId: 'pallet-town',
    position: { x: 6, y: 8 },
    bag: new Bag(),
    stash,
    starterSpeciesId: 'charmander',
    raidProgress: { ...DEFAULT_RAID_PROGRESS, ...raidProgress },
  });
  return manager;
}

/**
 * A save every keeper with a favour wants a word with: a raid gone on and a job
 * banked, so favours are asked (`mayAskAFavour`), and Brock's crate fetched.
 */
const favoursDue = (): SaveManager =>
  fresh(
    {
      completedContracts: [FIRST_CONTRACT_ID],
      standingContractsBanked: 1,
      raidRecord: { 'greystone-vale': { deployed: 2, extracted: 2, wiped: 0 } },
      errands: [{ id: 'brocks-crate', status: 'started', found: 1, lossesHeard: 0 }],
    },
    { 'brocks-crate': 1 },
  );

type Said = { readonly kind: 'box'; readonly text: string } | { readonly kind: 'question'; readonly text: string } | { readonly kind: 'opens'; readonly what: string };

/**
 * A keeper's room on a stand-in of the scene: the real talk, with every box
 * read at once and every question answered `answer`, and what it said, asked
 * and opened written down in order.
 */
function visit(manager: SaveManager, answer: boolean) {
  const log: Said[] = [];
  const scene = Object.create(BaseScene.prototype) as Record<string, unknown>;
  const resumed: (() => void)[] = [];
  Object.assign(scene, {
    saveManager: manager,
    savedGame: manager.load()!,
    currentTile: { x: 7, y: 8 },
    facing: 'up',
    visit: null,
    leaving: false,
    player: { stop: () => undefined, setFrame: () => undefined },
    showHint: () => undefined,
    clearKeeperMark: () => undefined,
    standStill: () => undefined,
    dressPlayer: () => undefined,
    spentPresses: { spendHeld: () => undefined },
    directionKeys: () => [],
    say: (lines: readonly string[], _about: unknown, then?: () => void) => {
      for (const line of lines) {
        for (const text of shareLine(line, 2, wrap)) log.push({ kind: 'box', text });
      }
      then?.();
    },
    askInBox: (question: string, answered: (yes: boolean) => void) => {
      log.push({ kind: 'question', text: question });
      answered(answer);
    },
    openHub: (payload: { view: string }) => log.push({ kind: 'opens', what: payload.view }),
    openBoutique: () => log.push({ kind: 'opens', what: 'boutique' }),
    openDojoCounter: () => log.push({ kind: 'opens', what: 'dojo counter' }),
    openGameCorner: (mode: string, after?: () => void) => {
      log.push({ kind: 'opens', what: `game corner ${mode}` });
      if (after) resumed.push(after);
    },
    goTo: (data: { said?: readonly string[] }) => log.push({ kind: 'opens', what: `the room again: ${(data.said ?? []).join(' ')}` }),
  });
  const speak = (room: BaseRoom): void => {
    scene.place = { room: { room } };
    if (room.screen === 'arena') {
      (scene.speakToMarshal as (room: BaseRoom) => void).call(scene, room);
    } else {
      (scene.speakToKeeper as (room: BaseRoom, screen: BaseScreen) => void).call(scene, room, room.screen!);
    }
  };
  /** The base started again in this room, as a screen closing back into it does. */
  const backFromTheScreen = (room: BaseRoom): void => {
    (scene.favourOwedIn as (room: BaseRoom) => (() => void) | undefined).call(scene, room)?.();
    for (const after of resumed.splice(0)) after();
  };
  return { log, speak, backFromTheScreen };
}

const KEEPERS: readonly { readonly room: string; readonly opens: boolean }[] = [
  { room: 'oaks-lab', opens: true },
  { room: 'pokemon-centre', opens: true },
  { room: 'brocks-workshop', opens: true },
  { room: 'bills-cottage', opens: true },
  { room: 'boutique', opens: true },
  { room: 'prize-window', opens: true },
  { room: 'battle-arena', opens: true },
  // Nothing to open: the greeting is all there is, and the place is walked.
  { room: 'game-corner', opens: false },
  { room: 'raid-arena', opens: false },
];

const SAVES: readonly [string, () => SaveManager][] = [
  ['a fresh save', () => fresh()],
  ["Sam's save, home from the first raid", () => stored(sam)],
  ["Jo's save, ten raids in with MISTY beaten", () => stored(jo)],
  ['a save every keeper with a favour wants a word with', favoursDue],
];

/** The boxes said before the first question or screen, or all of them when nothing opens. */
const boxesBefore = (log: readonly Said[]): readonly string[] => {
  const first = log.findIndex((said) => said.kind !== 'box');
  return (first < 0 ? log : log.slice(0, first)).flatMap((said) => (said.kind === 'box' ? [said.text] : []));
};

/**
 * The harbour audit of 27 Nov 2026 counted four to six boxes in front of a
 * keeper's menu on a first visit home. FireRed's nurse says two lines and
 * asks; its clerk says one and opens the shop. Here every keeper says one.
 */
describe('one box before a keeper opens anything, on any visit, in any save', () => {
  beforeEach(() => {
    retireMapsForTests(RETIRED_MAPS);
    forgetDeclinedErrands();
    return () => retireMapsForTests([]);
  });

  describe.each(SAVES)('%s', (_name, make) => {
    it.each(KEEPERS)('$room: its greeting, then what it keeps, on the first visit and the next', ({ room: id, opens }) => {
      const room = roomNamed(id)!;
      const manager = make();
      for (const answer of [false, true, false]) {
        const { log, speak, backFromTheScreen } = visit(manager, answer);
        speak(room);
        expect(boxesBefore(log)).toEqual([KEEPER_GREETINGS[room.screen!]]);
        if (opens) {
          expect(log[1]?.kind).not.toBe('box');
        } else {
          expect(log).toHaveLength(1);
        }
        backFromTheScreen(room);
      }
    });
  });
});

describe("a keeper's favour waits until what they keep is done with", () => {
  beforeEach(() => {
    retireMapsForTests(RETIRED_MAPS);
    forgetDeclinedErrands();
    return () => retireMapsForTests([]);
  });
  const BROCK = errandOf('workshop')!;

  it('thanks Brock for his crate as his screen closes back into the room, and only then', () => {
    const manager = favoursDue();
    const room = roomNamed('brocks-workshop')!;
    const { log, speak, backFromTheScreen } = visit(manager, false);
    speak(room);
    expect(log).toEqual([
      { kind: 'box', text: KEEPER_GREETINGS.workshop },
      { kind: 'opens', what: 'workshop' },
    ]);
    // The crate is still the player's until he thanks them for it.
    expect(manager.load()!.stash.itemCount(BROCK.itemId)).toBe(1);
    backFromTheScreen(room);
    expect(log.slice(2).map((said) => (said.kind === 'box' ? said.text : '')).join(' ')).toContain("You handed over Brock's crate.");
    expect(manager.load()!.stash.itemCount(BROCK.itemId)).toBe(0);
    // Said once: the next time the room starts, nobody turns to you.
    const again = log.length;
    backFromTheScreen(room);
    expect(log).toHaveLength(again);
  });

  it('asks a favour after the question is answered, whichever way', () => {
    for (const answer of [false, true]) {
      forgetDeclinedErrands();
      const manager = fresh({ completedContracts: [FIRST_CONTRACT_ID], standingContractsBanked: 1, raidRecord: { 'greystone-vale': { deployed: 1, extracted: 1, wiped: 0 } } });
      const { log, speak } = visit(manager, answer);
      speak(roomNamed('oaks-lab')!);
      const question = log.findIndex((said) => said.kind === 'question');
      const favour = log.findIndex((said) => said.kind === 'box' && said.text.includes('Before you go!'));
      expect(question).toBe(1);
      expect(favour).toBeGreaterThan(question);
    }
  });

  it('is nobody\'s favour in a room the base starts in by any other way', () => {
    const manager = favoursDue();
    const { log, speak, backFromTheScreen } = visit(manager, false);
    speak(roomNamed('brocks-workshop')!);
    backFromTheScreen(roomNamed('oaks-lab')!);
    expect(log).toHaveLength(2);
  });
});
