import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Math: { Vector2: class { public x = 0; public y = 0; } },
    Geom: { Rectangle: class { public static Contains = () => true; } },
    Input: { Keyboard: { KeyCodes: {}, JustDown: () => false }, Events: {} },
    Scenes: { Events: { SHUTDOWN: 'shutdown', UPDATE: 'update' } },
    Scale: { Events: { RESIZE: 'resize' } },
    BlendModes: { ADD: 1 },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
    GameObjects: { Container: class {}, Sprite: class {}, Rectangle: class {}, Text: class {} },
  },
}));

import { ballAt, ballsLeftFor, ballTiles, FIRST_STANDING, LAB_TABLE, OAK_DONT_GO, OAK_GO_ON, oakOpeningLines, receivedLine, starterQuestion } from '../base/starterTable';
import { buildRoom, roomNamed } from '../base/rooms';
import { FIRST_WORDS } from '../hub/firstWords';
import { gameBeforeChoosing, startNewGame } from '../save/newGame';
import { SAVE_KEY, SaveManager, type StorageLike } from '../save/SaveManager';
import { getStarterSpecies, STARTER_SPECIES, type StarterSpeciesId } from '../stash';
import { BaseScene } from './BaseScene';

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

const lab = roomNamed('oaks-lab')!;
const table = buildRoom(lab, gameBeforeChoosing(), new Date(2026, 9, 31), { choosing: true });

/** The real choosing, on a stand-in of the room, with the question answered by `answers` in turn. */
function room(storage: StorageLike, answers: readonly boolean[] = []) {
  const said: string[][] = [];
  const asked: { question: string; spendsForGood: boolean }[] = [];
  const went: Record<string, unknown>[] = [];
  const started: unknown[][] = [];
  const left = [...answers];
  const scene = BaseScene.prototype as unknown as Record<string, unknown>;
  const stand = {
    choosing: true,
    ready: true,
    leaving: false,
    saveManager: new SaveManager(storage),
    savedGame: gameBeforeChoosing(),
    currentTile: { x: 9, y: 6 },
    facing: 'up',
    askedBall: null as StarterSpeciesId | null,
    player: { stop: () => undefined, setFrame: () => undefined },
    place: { room: table },
    scene: { start: (...args: unknown[]) => started.push(args) },
    thingFaced: scene.thingFaced,
    onMat: scene.onMat,
    askForBall: scene.askForBall,
    takeBall: scene.takeBall,
    say: (lines: readonly string[]) => said.push([...lines]),
    goTo: (data: Record<string, unknown>) => went.push(data),
    askInBox: (question: string, answer: (yes: boolean) => void, options: { spendsForGood?: boolean } = {}) => {
      asked.push({ question, spendsForGood: options.spendsForGood === true });
      stand.askedAtAnswer = stand.askedBall;
      answer(left.shift() ?? false);
    },
    askedAtAnswer: null as StarterSpeciesId | null,
  };
  const pressAt = (x: number, y: number): void => {
    (scene.chooseAt as (this: typeof stand, entered: unknown, target: unknown) => void).call(stand, lab, { x, y });
  };
  const leave = (): void => {
    (scene.leaveRoom as (this: typeof stand, entered: unknown) => void).call(stand, lab);
  };
  return { said, asked, went, started, stand, pressAt, leave, scene };
}

describe('the three balls on Oak’s table', () => {
  it('stand one to a tile along the table, and every tile of it answers for the ball on it', () => {
    STARTER_SPECIES.forEach(({ id }, index) => {
      const tiles = ballTiles(id);
      expect(tiles[0]).toEqual({ x: LAB_TABLE.x + index, y: LAB_TABLE.y });
      for (const tile of tiles) {
        expect(ballAt(tile)).toBe(id);
        // Solid, so a ball is faced rather than walked over.
        expect(table.collision[tile.y][tile.x]).toBe(true);
      }
    });
    expect(ballAt({ x: LAB_TABLE.x - 1, y: LAB_TABLE.y })).toBeNull();
  });

  it('can each be walked up to, and a new game stands a step short of them with no ball faced', () => {
    for (const { id } of STARTER_SPECIES) {
      const front = ballTiles(id)[1];
      expect(table.collision[front.y + 1][front.x]).toBe(false);
    }
    expect(table.collision[FIRST_STANDING.y][FIRST_STANDING.x]).toBe(false);
    expect(ballAt({ x: FIRST_STANDING.x, y: FIRST_STANDING.y - 1 })).toBeNull();
  });

  it('are all out while choosing, each a thing that says which it is', () => {
    expect(table.sprites).toHaveLength(3);
    expect(table.things.flatMap((thing) => thing.starter ?? [])).toEqual(STARTER_SPECIES.map(({ id }) => id));
  });

  it('leave the other two on the table once one is taken, and put the old one back on a swap', () => {
    const storage = new MemoryStorage();
    const game = startNewGame(new SaveManager(storage), 'charmander')!;
    const built = buildRoom(lab, game, new Date(2026, 9, 31));
    expect(built.sprites).toHaveLength(2);
    expect(built.things.some((thing) => thing.starter)).toBe(false);
    expect(ballsLeftFor('charmander')).toEqual(['bulbasaur', 'squirtle']);
    expect(ballsLeftFor('squirtle')).toEqual(['bulbasaur', 'charmander']);
  });

  it('are asked about in a line that fits the box, with room for its answers', () => {
    // Longer than this wraps onto the answers' own row (`ChoicePrompt`).
    for (const { id } of STARTER_SPECIES) {
      expect(starterQuestion(getStarterSpecies(id)).length).toBeLessThanOrEqual(28);
    }
  });

  it('are said over in boxes that hold, whatever the player is called', () => {
    for (const line of [...oakOpeningLines('ABCDEFGHIJ'), OAK_GO_ON, OAK_DONT_GO, receivedLine('ABCDEFGHIJ', getStarterSpecies('charmander'))]) {
      expect(line.length).toBeLessThanOrEqual(68);
    }
  });
});

describe('choosing, from the room', () => {
  it('asks about the ball faced, on the safe answer, and writes nothing for a NOT NOW', () => {
    const storage = new MemoryStorage();
    const { asked, went, stand, pressAt } = room(storage, [false]);

    pressAt(9, 5);

    expect(asked).toEqual([{ question: starterQuestion(getStarterSpecies('charmander')), spendsForGood: true }]);
    expect(stand.askedAtAnswer).toBe('charmander');
    expect(stand.askedBall).toBeNull();
    expect(went).toEqual([]);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });

  it('starts the game on YES, in the same room on the same tile, with the ball handed over', () => {
    const storage = new MemoryStorage();
    const { went, pressAt } = room(storage, [true]);

    pressAt(10, 4);

    expect(new SaveManager(storage).load()?.starterSpeciesId).toBe('squirtle');
    expect(went).toHaveLength(1);
    expect(went[0]).toMatchObject({ room: 'oaks-lab', at: { x: 9, y: 6 }, facing: 'up', chose: 'squirtle' });
    expect((went[0].savedGame as { starterSpeciesId: string }).starterSpeciesId).toBe('squirtle');
  });

  it('goes to the cannot-save screen if the browser will not keep the game', () => {
    class Refusing extends MemoryStorage {
      public override setItem(): void {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      }
    }
    const { started, went, pressAt } = room(new Refusing(), [true]);

    pressAt(8, 5);

    expect(went).toEqual([]);
    expect(started).toEqual([['starter', { refused: true }]]);
  });

  it('has Oak say to get on with it, and everything else in the room wait', () => {
    const storage = new MemoryStorage();
    const { said, asked, pressAt } = room(storage);

    pressAt(lab.keeper!.position.x, lab.keeper!.position.y);
    expect(said.at(-1)).toEqual([OAK_GO_ON]);

    const wallMap = table.things.find((thing) => thing.name === 'THE WALL MAP')!;
    expect(wallMap.opens).toBeUndefined();
    pressAt(wallMap.tiles[0].x, wallMap.tiles[0].y);
    expect(said.at(-1)).toEqual(wallMap.lines);

    const board = table.things.find((thing) => thing.name === 'THE BOARD')!;
    expect(board.reads).toBeUndefined();
    expect(asked).toEqual([]);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });

  it('lets nobody out of the door without a partner', () => {
    const { said, went, leave } = room(new MemoryStorage());

    leave();

    expect(said).toEqual([[OAK_DONT_GO]]);
    expect(went).toEqual([]);
  });

  it('gives a driver its partner straight out in the yard, and only while there is one to choose', () => {
    const storage = new MemoryStorage();
    const { started, stand, scene } = room(storage);
    const take = scene.takeStarterForDriver as (this: typeof stand, starter: string) => boolean;

    expect(take.call(stand, 'mewtwo')).toBe(false);
    expect(take.call(stand, 'charmander')).toBe(true);
    expect(started[0][0]).toBe('base');
    expect(stand.ready).toBe(false);
    stand.ready = true;
    stand.choosing = false;
    expect(take.call(stand, 'squirtle')).toBe(false);
    expect(new SaveManager(storage).load()?.starterSpeciesId).toBe('charmander');
  });

  it('never writes over a game started in another tab while the table stood open', () => {
    const storage = new MemoryStorage();
    const { stand, scene, went } = room(storage);
    const played = startNewGame(new SaveManager(storage), 'squirtle')!;
    played.stash.addItem('money', 555);
    new SaveManager(storage).save(played);

    (scene.takeBall as (this: typeof stand, starter: string) => void).call(stand, 'charmander');

    const game = new SaveManager(storage).load()!;
    expect(game.starterSpeciesId).toBe('squirtle');
    expect(game.stash.itemCount('money')).toBe(555);
    expect(went[0]).not.toHaveProperty('chose');
    expect(went[0].room).toBe('oaks-lab');
  });

  it('hands the ball over and says what a raid is, once', () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    const game = startNewGame(manager, 'bulbasaur')!;
    const said: string[] = [];
    const scene = BaseScene.prototype as unknown as Record<string, unknown>;
    const stand = {
      saveManager: manager,
      savedGame: game,
      hearFirstWords: scene.hearFirstWords,
      say: (lines: readonly string[]) => said.push(...lines),
    };

    (scene.handOverPartner as (this: typeof stand, starter: string, about: unknown[]) => void).call(stand, 'bulbasaur', []);

    expect(said[0]).toContain('BULBASAUR');
    expect(said.slice(1)).toEqual(FIRST_WORDS.lab.lines);
    expect(manager.load()?.raidProgress.firstWordsHeard).toContain('lab');
  });
});
