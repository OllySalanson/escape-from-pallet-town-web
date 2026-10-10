import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: {
      Container: class {},
    },
    Cameras: {
      Scene2D: {
        Events: {
          FADE_OUT_COMPLETE: 'fade-out-complete',
        },
      },
    },
  },
}));

import { Bag } from '../items';
import {
  CHARMANDER,
  Pokemon,
  PokemonParty,
  experienceAwardForDefeat,
  experienceForLevel,
} from '../pokemon';
import {
  createBattleState,
  createTrainerBattleState,
  slotRef,
  unitAt,
  type BattleState,
} from '../pokemon/battle/battleEngine';
import { BULBASAUR, PIDGEY, SQUIRTLE, getSpeciesById } from '../pokemon/species';
import { Move } from '../pokemon/Move';
import { GROWL } from '../pokemon/moves';
import { pokemonCargo } from '../pokemon/pokemonCargo';
import { RunManager } from '../run/RunManager';
import { createActiveRunSession } from '../run/RunSession';
import { HUNTER_SEARCH_MS, createHunterState } from '../world/hunter';
import { BattleScene } from './BattleScene';
import { combatantSpot } from './battlePresentation';
import { iconTextureKey, itemIconName } from '../ui/icons';

/** The width the stub reports for "▶ ", which is how far every row is moved right. */
const CURSOR_GUTTER = 10;

const cursors = new WeakMap<RenderedText[], { cursor: RenderedText; after: number }[]>();
const cursorsOf = (texts: RenderedText[]): { cursor: RenderedText; after: number }[] => {
  const known = cursors.get(texts) ?? [];
  cursors.set(texts, known);
  return known;
};

/**
 * The texts as a player reads them: a row the cursor is on reads "▶ ROW" and
 * every other row of a list "  ROW", at the place the row's gutter starts.
 * The scene draws the cursor as its own text in a gutter (so a row never moves
 * when the cursor lands on it); this puts the two back together so a test can
 * say what is selected the way it always said it.
 */
const read = (texts: RenderedText[]): RenderedText[] =>
  texts.map((text, index) => {
    if (text.setX.mock.calls.length === 0) {
      return text;
    }
    const own = cursorsOf(texts).find(({ after }) => after > index)?.cursor;
    const home = text.x - CURSOR_GUTTER;
    const chosen = own !== undefined && own.visible && own.x === home && own.y === text.y;
    return { ...text, x: home, text: `${chosen ? '▶ ' : '  '}${text.text}` };
  });

interface RenderedText {
  x: number;
  y: number;
  width: number;
  visible: boolean;
  readonly style: Record<string, unknown>;
  text: string;
  readonly handlers: Record<string, () => void>;
  setInteractive: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  setText: ReturnType<typeof vi.fn>;
  setBackgroundColor: ReturnType<typeof vi.fn>;
  setOrigin: ReturnType<typeof vi.fn>;
  setColor: ReturnType<typeof vi.fn>;
  setDepth: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  setX: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
  setVisible: ReturnType<typeof vi.fn>;
  setFixedSize: ReturnType<typeof vi.fn>;
  setWordWrapWidth: ReturnType<typeof vi.fn>;
}

interface HarnessOptions {
  /** Builds the hunter pursuit battle instead of the default wild encounter. */
  readonly hunterBattle?: boolean;
  /** Fights an authored trainer, which is the battle that cannot be left. */
  readonly authoredTrainer?: boolean;
  /**
   * The authored trainer's own party. A second Pokemon is what keeps a battle
   * alive across a knockout, which is the only way a level-up is ever seen
   * from inside one.
   */
  readonly trainerParty?: readonly Pokemon[];
  readonly runSession?: ReturnType<typeof createActiveRunSession>;
  /** The raid bag this fight is carrying. Defaults to two Potions and five balls. */
  readonly bag?: Bag;
  readonly party?: PokemonParty;
}

const graphicsStub = () => ({
  clear: vi.fn().mockReturnThis(),
  fillStyle: vi.fn().mockReturnThis(),
  fillRect: vi.fn().mockReturnThis(),
  lineStyle: vi.fn().mockReturnThis(),
  strokeRect: vi.fn().mockReturnThis(),
});

const spriteStub = () => ({
  x: 0,
  scaleX: 1,
  scaleY: 1,
  setTintFill: vi.fn().mockReturnThis(),
  clearTint: vi.fn().mockReturnThis(),
  setTexture: vi.fn().mockReturnThis(),
  setPosition: vi.fn().mockReturnThis(),
  setAlpha: vi.fn().mockReturnThis(),
});

function createBattleSceneHarness(options: HarnessOptions = {}): {
  scene: BattleScene;
  renderedTexts: RenderedText[];
  dialog: {
    setVisible: ReturnType<typeof vi.fn>;
    showMessage: ReturnType<typeof vi.fn>;
    showMessages: ReturnType<typeof vi.fn>;
    advance: ReturnType<typeof vi.fn>;
    isCurrentMessageComplete: boolean;
    visibleText: string;
    shownMessages: string[];
  };
  commandContainer: {
    add: ReturnType<typeof vi.fn>;
    removeAll: ReturnType<typeof vi.fn>;
    setVisible: ReturnType<typeof vi.fn>;
  };
} {
  const renderedTexts: RenderedText[] = [];
  const dialog = {
    setVisible: vi.fn(),
    showMessage: vi.fn((message: string) => {
      dialog.visibleText = message;
      dialog.shownMessages.push(message);
    }),
    showMessages: vi.fn((messages: string[]) => {
      dialog.visibleText = messages[0] ?? '';
      dialog.shownMessages.push(...messages);
    }),
    advance: vi.fn(),
    isCurrentMessageComplete: false,
    visibleText: '',
    shownMessages: [] as string[],
  };
  const commandContainer = {
    add: vi.fn(),
    removeAll: vi.fn(),
    setVisible: vi.fn(),
  };
  const player = options.party?.pokemon[0] ?? new Pokemon(CHARMANDER, 12);
  const enemy = new Pokemon(BULBASAUR, 10);
  const trainer = options.hunterBattle
    ? {
        id: 'rival-hunter',
        name: 'BLUE',
        party: [new Pokemon(PIDGEY, 6)],
        defeatText: 'What?! I was just warming up... Smell ya later!',
        getawayText: 'BLUE: "Run, then!"',
      }
    : options.authoredTrainer
      ? {
          id: 'floodplain-checkpoint-maya',
          name: 'RAIDER MAYA',
          party: options.trainerParty ?? [new Pokemon(PIDGEY, 7)],
          defeatText: 'The checkpoint is open.',
        }
      : undefined;
  const state = trainer
    ? createTrainerBattleState(player, trainer)
    : createBattleState(player, enemy);
  const scene = Object.create(BattleScene.prototype) as BattleScene;

  // The scene keeps one plate per slot, so the harness builds one per slot too.
  // `playerLevelText` used to be a field of its own because a level reached
  // mid-battle has to reach the plate; it is now the plate's own.
  const plates = new Map<string, unknown>();
  const sprites = new Map<string, unknown>();
  const displayed = new Map<string, Pokemon>();
  const displayedHp = new Map<string, number>();
  for (const side of ['player', 'enemy'] as const) {
    for (const slot of [0, 1]) {
      const combatant = unitAt(state, slotRef(side, slot));
      if (!combatant) {
        continue;
      }
      const key = `${side}${slot}`;
      plates.set(key, {
        container: { destroy: vi.fn() },
        hpBar: graphicsStub(),
        barX: 0,
        barY: 0,
        barWidth: 88,
        hpText: { setText: vi.fn() },
        statusText: { setText: vi.fn() },
        levelText: {
          text: `Lv ${combatant.pokemon.level}`,
          setText: vi.fn(function (this: { text: string }, value: string) {
            this.text = value;
          }),
        },
        banner: { setText: vi.fn(), destroy: vi.fn() },
      });
      sprites.set(key, spriteStub());
      displayed.set(key, combatant.pokemon);
      displayedHp.set(key, combatant.currentHp);
    }
  }

  Object.assign(scene as object, {
    add: {
      // The party screen - the target picker for an item as well as the switch
      // menu - is built inside a container, so the harness has to hold one.
      container: vi.fn(() => {
        const children: unknown[] = [];
        const stub: Record<string, unknown> = {
          children,
          add: vi.fn((child: unknown) => children.push(child)),
          destroy: vi.fn(),
          // A name plate is a container that is depth-sorted against the
          // combatant sprites, so the stub has to answer `setDepth` too.
          setDepth: vi.fn(() => stub),
        };
        return stub;
      }),
      // The ball a throw puts on the field.
      image: vi.fn(() => ({
        ...spriteStub(),
        setDepth: vi.fn().mockReturnThis(),
        setAngle: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      })),
      graphics: vi.fn(() => ({
        clear: vi.fn().mockReturnThis(),
        fillStyle: vi.fn().mockReturnThis(),
        fillRect: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        strokeRect: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
      })),
      text: vi.fn((x: number, y: number, raw: string, style: Record<string, unknown>) => {
        const text = raw.replace(/\u2004/g, ' ');
        const rendered = {
          x,
          y,
          style,
          text,
          handlers: {},
          setInteractive: vi.fn().mockReturnThis(),
          on: vi.fn(function (this: RenderedText, event: string, handler: () => void) {
            this.handlers[event] = handler;
            return this;
          }),
          // A caption line's wide word space reads as a space; the width it is
          // drawn at is `battlePresentation.test.ts`'s business, not this file's.
          setText: vi.fn(function (this: RenderedText, value: string) {
            this.text = value.replace(/\u2004/g, ' ');
            return this;
          }),
          setBackgroundColor: vi.fn().mockReturnThis(),
          setColor: vi.fn().mockReturnThis(),
          setDepth: vi.fn().mockReturnThis(),
          setOrigin: vi.fn().mockReturnThis(),
          // A plate's banner is a text, and a plate is torn down when the next
          // Pokemon is sent into its slot.
          destroy: vi.fn(),
          // The list cursor stands in a gutter of its own: rows are moved right
          // by its width once and the cursor is moved from row to row. The
          // stub's text has no width, so the gutter here is the stub's own.
          width: text === '▶ ' ? CURSOR_GUTTER : 0,
          setX: vi.fn(function (this: { x: number }, value: number) {
            this.x = value;
            return this;
          }),
          setPosition: vi.fn(function (this: { x: number; y: number }, x: number, y: number) {
            this.x = x;
            this.y = y;
            return this;
          }),
          setVisible: vi.fn(function (this: { visible: boolean }, value: boolean) {
            this.visible = value;
            return this;
          }),
          visible: true,
          setFixedSize: vi.fn().mockReturnThis(),
          setWordWrapWidth: vi.fn().mockReturnThis(),
        } satisfies RenderedText;
        // The cursor and the probe that measures its gutter are the list's
        // furniture, not its rows: they are kept apart so a test reads the
        // rows exactly as it always has, through `read`.
        if (text === '▶' || text === '▶ ') {
          if (text === '▶') {
            cursorsOf(renderedTexts).push({ cursor: rendered, after: renderedTexts.length });
          }
          return rendered;
        }
        renderedTexts.push(rendered);
        return rendered;
      }),
    },
    commandContainer,
    dialog,
    // One plate and one sprite per occupied slot, keyed the way the scene keys
    // them. A single battle is two of each; a double is four.
    plates,
    sprites,
    displayed,
    displayedHp,
    pendingCombatMessages: [],
    pendingChoices: [],
    choosingSlot: 0,
    aimingMoveIndex: 0,
    replacementSlot: 0,
    tweens: { add: vi.fn(), addCounter: vi.fn(), killTweensOf: vi.fn() },
    cameras: { main: { flash: vi.fn(), shake: vi.fn(), fadeOut: vi.fn(), once: vi.fn() } },
    // Raid resolution waits a beat before handing over; run it now.
    time: { delayedCall: vi.fn((_delayMs: number, callback: () => void) => callback()) },
    hunterBattle: options.hunterBattle ?? false,
    hunterState: options.hunterBattle
      ? { ...createHunterState(), spawned: true, mapId: 'route-1', position: { x: 4, y: 4 } }
      : undefined,
    runSession: options.runSession,
    bag: options.bag ?? new Bag({ potion: 2, 'poke-ball': 5 }),
    pendingItem: undefined,
    wildEscapeAttempts: 0,
    pendingBattleExit: false,
    defeatedTrainerIds: new Set(),
    collectedLootIds: new Set(),
    seenPrizeIds: new Set(),
    activatedPoiIds: new Set(),
    forcedReplacement: false,
    isPresentingCombatEvents: false,
    // The question held over a trainer's next Pokemon, and which of its party
    // has already been asked about.
    aboutToUse: null,
    aboutToUseOffered: new Set<number>(),
    aboutToUseSwitching: false,
    // Class fields do not run for an Object.create'd scene, and experience is
    // awarded by walking this set.
    foesFacedBy: new Map(),
    // Whose faint has been put on screen - also a class field.
    fallen: new Set(),
    victoryRewardsGranted: false,
    // The list cursor's own state - class fields, which an Object.create'd
    // scene does not run.
    cursorRows: [],
    rowHomes: new WeakMap(),
    cursorGutters: new Map(),
    // Caption lines are fitted to the panel by measuring them on the game's own
    // text, which the stub cannot do: every line fits here.
    captionWidth: () => 0,
    mode: 'events',
    party: options.party ?? new PokemonParty([player]),
    selectedCommand: 0,
    lastMainCommand: 0,
    lastMoveOf: new Map(),
    state,
    trainer,
  });

  // Whoever is out faces whoever is out opposite, as a battle opens.
  (scene as unknown as { noteWhoFacesWhom(): void }).noteWhoFacesWhom();

  return { scene, renderedTexts, dialog, commandContainer };
}

describe('BattleScene command presentation', () => {
  it('renders the opening main commands, then restores them after move selection', () => {
    const { scene, renderedTexts, dialog } = createBattleSceneHarness();

    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();

    // The dialogue panel is depth 1000 and occupies the command area. This
    // explicit handoff is the screenshot regression: PR #55 rendered the
    // labels but left this masking layer eligible to cover them.
    expect(dialog.setVisible).toHaveBeenCalledWith(false);
    expect(read(renderedTexts).map(({ text, x, y }) => ({ text, x, y }))).toEqual([
      { text: '▶ FIGHT', x: 18, y: 185 },
      { text: '  BALL x5', x: 112, y: 185 },
      { text: '  POKéMON', x: 206, y: 185 },
      // What the loadout packed, counted on the command itself.
      { text: '  ITEM x2', x: 18, y: 210 },
      // The escape command prices itself: Charmander outruns Bulbasaur 12 to 9.
      { text: '  RUN 57%', x: 112, y: 210 },
    ]);
    // Five commands are three columns of the same two rows four commands use:
    // as a third row the last one sat six pixels off the panel's border.
    expect(read(renderedTexts).every(({ y }) => y >= 174 && y < 238)).toBe(true);
    expect(read(renderedTexts).every(({ style }) => !('fixedWidth' in style))).toBe(true);

    read(renderedTexts)[0].handlers.pointerdown();

    // Two guidance lines are laid out first, then one row per known move.
    const [summaryLine, matchupLine, ...moveTexts] = read(renderedTexts).slice(5);
    expect(moveTexts).toHaveLength(3);
    expect([summaryLine, matchupLine, ...moveTexts].every(({ y }) => y >= 174 && y < 238)).toBe(
      true,
    );
    expect(moveTexts.map(({ text }) => text)).toEqual(['▶ SCRATCH', '  GROWL', '  EMBER']);
    expect(moveTexts.every(({ style }) => style.fixedWidth === 136 && style.fixedHeight === 16)).toBe(
      true,
    );
    // Charmander's Scratch is highlighted, so the panel describes that move.
    expect(summaryLine.text).toBe('NORMAL · PHYSICAL · POWER 40 · PP 35/35');
    expect(matchupLine.text).toBe('vs BULBASAUR: NORMAL DAMAGE x1');

    (scene as unknown as { goBack(): void }).goBack();

    expect(read(renderedTexts).slice(10).map(({ text }) => text)).toEqual([
      '▶ FIGHT',
      '  BALL x5',
      '  POKéMON',
      '  ITEM x2',
      '  RUN 57%',
    ]);
  });

  it('keeps every row still and moves only the cursor (playtest section 3, item 2)', () => {
    const { scene, renderedTexts } = createBattleSceneHarness();
    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    const rows = renderedTexts.slice(0, 5);
    const before = rows.map(({ x, y, text }) => `${text}@${x},${y}`);
    const cursor = cursorsOf(renderedTexts).at(-1)!.cursor;
    const first = { x: cursor.x, y: cursor.y };

    (scene as unknown as { moveSelection(direction: string): void }).moveSelection('down');

    // The text of a row never carries the cursor, so nothing about a row
    // changes when the cursor lands on it: only the cursor moves.
    expect(rows.map(({ x, y, text }) => `${text}@${x},${y}`)).toEqual(before);
    expect(rows.every(({ text }) => !text.startsWith('▶'))).toBe(true);
    expect({ x: cursor.x, y: cursor.y }).not.toEqual(first);
    expect(read(renderedTexts).slice(0, 5).map(({ text }) => text)).toContain('▶ ITEM x2');
  });

  it('rewrites the guidance lines when the highlighted move changes', () => {
    const { scene, renderedTexts } = createBattleSceneHarness();

    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    read(renderedTexts)[0].handlers.pointerdown();

    const [summaryLine, matchupLine, , , emberRow] = read(renderedTexts).slice(5);
    emberRow.handlers.pointerover();

    expect(summaryLine.text).toBe('FIRE · SPECIAL · POWER 40 · PP 25/25 · SAME-TYPE x1.5');
    expect(matchupLine.text).toBe('vs BULBASAUR: SUPER EFFECTIVE x2');
    expect(matchupLine.setColor).toHaveBeenLastCalledWith('#166534');
  });

  it('shows the Run outcome as visible dialogue and returns map control after it advances', () => {
    const { scene, renderedTexts, dialog, commandContainer } = createBattleSceneHarness();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    let returnedParty: PokemonParty | undefined;
    const start = vi.fn((sceneKey: string, data: { party: PokemonParty }) => {
      expect(sceneKey).toBe('world');
      returnedParty = data.party;
    });
    const fadeOut = vi.fn();

    Object.assign(scene as object, {
      launchedFromWorld: true,
      cameras: {
        main: {
          fadeOut,
          once: vi.fn((_event: unknown, callback: () => void) => callback()),
        },
      },
      scene: { manager: { keys: { world: {} } }, start },
    });

    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    read(renderedTexts)[4].handlers.pointerdown();

    expect(dialog.visibleText).toBe('Got away safely!');
    expect(dialog.showMessage).toHaveBeenCalledWith('Got away safely!');
    expect(commandContainer.setVisible).toHaveBeenLastCalledWith(false);
    expect((scene as unknown as { mode: string }).mode).toBe('events');

    dialog.isCurrentMessageComplete = true;
    (scene as unknown as { confirm(): void }).confirm();
    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();

    expect(dialog.advance).toHaveBeenCalledOnce();
    expect(fadeOut).toHaveBeenCalledWith(180, 0, 0, 0);
    expect(start).toHaveBeenCalledOnce();
    expect(returnedParty).toBeInstanceOf(PokemonParty);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const startedRunSession = () => {
  const manager = new RunManager();
  manager.startRun(
    { party: [new Pokemon(CHARMANDER, 12)], items: [] },
    { mapId: 'route-1', durationMs: 18 * 60 * 1_000 },
  );
  return createActiveRunSession(manager, {}, {}, [], []);
};

describe('escaping the hunter', () => {
  it('prices the escape on the command before the player commits to it', () => {
    const runSession = startedRunSession();
    const { scene, renderedTexts } = createBattleSceneHarness({ hunterBattle: true, runSession });

    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();

    expect(read(renderedTexts).map(({ text }) => text)).toEqual([
      '▶ FIGHT',
      '  FLEE -40s',
      '  POKéMON',
      '  ITEM x2',
    ]);
  });

  /**
   * Playtest 3, D3: FLEE -60s with 1:24 on the clock left 24 seconds, and the
   * raid ran out eight steps from the exit. The price was honest; nothing
   * related it to what was left.
   */
  it('says what is left of the clock once the price is most of it', () => {
    const runSession = startedRunSession();
    runSession.manager.registerHunterFlee();
    runSession.manager.tick(18 * 60 * 1_000 - 40_000 - 84_000);
    const { scene, renderedTexts } = createBattleSceneHarness({ hunterBattle: true, runSession });

    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();

    expect(read(renderedTexts).map(({ text }) => text)).toContain('  FLEE -60s OF 84s');
  });

  it('charges the raid clock, never rolls for it, and marks the hunter as having lost the trail', () => {
    const runSession = startedRunSession();
    const { scene, renderedTexts, dialog } = createBattleSceneHarness({
      hunterBattle: true,
      runSession,
    });
    // A roll that would fail any chance-based escape: the hunter's exit must not have one.
    vi.spyOn(Math, 'random').mockReturnValue(0.999);

    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    read(renderedTexts)[1].handlers.pointerdown();

    expect(runSession.manager.snapshot().elapsedMs).toBe(40_000);
    expect(runSession.manager.snapshot().hunterFlees).toBe(1);
    expect(dialog.shownMessages).toEqual([
      'You broke away from BLUE!',
      // The hunter's own parting shot, which is the rival's line (`hunters.ts`).
      'BLUE: "Run, then!"',
      'BLUE lost your trail and holds off for 20s.',
      'Breaking contact cost 40s of raid time.',
    ]);
    const hunterState = (scene as unknown as { hunterState: { searchRemainingMs?: number; pendingBreakaway?: boolean } })
      .hunterState;
    expect(hunterState.searchRemainingMs).toBe(HUNTER_SEARCH_MS);
    expect(hunterState.pendingBreakaway).toBe(true);
  });

  it('hands the disengaged hunter back to the world so pursuit resumes from the fallback tile', () => {
    const runSession = startedRunSession();
    const { scene, renderedTexts, dialog } = createBattleSceneHarness({
      hunterBattle: true,
      runSession,
    });
    let worldData: { hunterState?: { searchRemainingMs?: number; pendingBreakaway?: boolean } } = {};
    Object.assign(scene as object, {
      launchedFromWorld: true,
      cameras: {
        main: {
          flash: vi.fn(),
          shake: vi.fn(),
          fadeOut: vi.fn(),
          once: vi.fn((_event: unknown, callback: () => void) => callback()),
        },
      },
      scene: {
        manager: { keys: { world: {} } },
        start: vi.fn((_key: string, data: typeof worldData) => {
          worldData = data;
        }),
      },
    });

    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    read(renderedTexts)[1].handlers.pointerdown();
    dialog.isCurrentMessageComplete = true;
    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();

    expect(worldData.hunterState?.searchRemainingMs).toBe(HUNTER_SEARCH_MS);
    expect(worldData.hunterState?.pendingBreakaway).toBe(true);
  });

  it('escalates the cost of every further escape in the same raid', () => {
    const runSession = startedRunSession();

    expect(runSession.manager.registerHunterFlee().penaltyMs).toBe(40_000);
    expect(runSession.manager.registerHunterFlee().penaltyMs).toBe(60_000);
    expect(runSession.manager.registerHunterFlee().penaltyMs).toBe(80_000);
    expect(runSession.manager.snapshot().elapsedMs).toBe(180_000);
  });
});

describe('escaping a wild encounter', () => {
  it('keeps the fight going on a failed roll instead of closing the exit', () => {
    const { scene, renderedTexts, dialog } = createBattleSceneHarness();
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    read(renderedTexts)[4].handlers.pointerdown();

    expect(dialog.shownMessages[0]).toBe("Couldn't get away from BULBASAUR!");
    expect((scene as unknown as { pendingBattleExit: boolean }).pendingBattleExit).toBe(false);
    expect((scene as unknown as { wildEscapeAttempts: number }).wildEscapeAttempts).toBe(1);
  });

  it('improves the odds it shows after every failure, so the exit is never closed off', () => {
    const { scene, renderedTexts } = createBattleSceneHarness();
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    read(renderedTexts)[4].handlers.pointerdown();

    (scene as unknown as { mode: string }).mode = 'main';
    (scene as unknown as { showCommands(): void }).showCommands();

    expect(read(renderedTexts).at(-1)?.text).toBe('▶ RUN 77%');
  });
});

describe('using an item in a battle', () => {
  /** Walks the command tree the way a player does: ITEM, the medicine, the target. */
  const chooseItemFor = (
    scene: BattleScene,
    renderedTexts: RenderedText[],
    itemName = 'POTION',
  ): void => {
    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    const clickLast = (match: string, from = 0): void => {
      const row = read(renderedTexts).slice(from).filter(({ text }) => text.includes(match)).at(-1);
      if (!row) {
        throw new Error(`No command row matching ${match}`);
      }
      row.handlers.pointerdown();
    };
    const beforeItemList = renderedTexts.length;
    clickLast('ITEM x');
    const beforeTargetList = renderedTexts.length;
    clickLast(`${itemName} x`, beforeItemList);
    // Party rows are the only ones carrying a level, which is what makes them
    // the target picker rather than the item list.
    clickLast('Lv ', beforeTargetList);
  };

  it('is offered in an authored trainer battle, which is the fight that cannot be left', () => {
    const { scene, renderedTexts } = createBattleSceneHarness({ authoredTrainer: true });

    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();

    expect(read(renderedTexts).map(({ text }) => text)).toEqual([
      '▶ FIGHT',
      '  POKéMON',
      '  ITEM x2',
    ]);
  });

  it('heals the Pokemon that is out and spends the item from the raid bag', () => {
    const hurt = new Pokemon(CHARMANDER, 12);
    hurt.takeDamage(15);
    const bag = new Bag({ potion: 2 });
    const { scene, renderedTexts, dialog } = createBattleSceneHarness({
      bag,
      party: new PokemonParty([hurt]),
    });
    // The enemy's reply is deterministic, so only the heal is under test here.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const state = () => (scene as unknown as { state: { player: { currentHp: number } } }).state;
    const hpBefore = state().player.currentHp;

    chooseItemFor(scene, renderedTexts);

    expect(dialog.shownMessages[0]).toBe('CHARMANDER recovered 15 HP!');
    expect(state().player.currentHp).toBeGreaterThan(hpBefore);
    expect(hurt.currentHp).toBe(state().player.currentHp);
    // One Potion, out of the bag the raid deployed with.
    expect(bag.count('potion')).toBe(1);
  });

  it('costs the turn, so the enemy answers the heal', () => {
    const hurt = new Pokemon(CHARMANDER, 12);
    hurt.takeDamage(15);
    const { scene, renderedTexts, dialog } = createBattleSceneHarness({
      bag: new Bag({ potion: 1 }),
      party: new PokemonParty([hurt]),
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.01);

    chooseItemFor(scene, renderedTexts);

    // The heal is said first; the rest of the log is the turn it was paid with.
    expect(dialog.shownMessages[0]).toBe('CHARMANDER recovered 15 HP!');
    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();

    expect(dialog.shownMessages.slice(1).join(' ')).toContain('Foe BULBASAUR used');
  });

  it('keeps the item and the turn when the medicine would do nothing', () => {
    const bag = new Bag({ potion: 1 });
    const { scene, renderedTexts, dialog } = createBattleSceneHarness({ bag });

    chooseItemFor(scene, renderedTexts);

    expect(bag.count('potion')).toBe(1);
    expect(dialog.shownMessages).toEqual([]);
    expect((scene as unknown as { mode: string }).mode).toBe('party');
    expect(
      read(renderedTexts).filter(({ text }) => text.includes('already at full HP')),
    ).toHaveLength(1);
  });

  it('says the pocket is empty rather than opening on nothing', () => {
    const { scene, renderedTexts, dialog } = createBattleSceneHarness({
      bag: new Bag({ 'poke-ball': 3 }),
    });

    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    const itemCommand = read(renderedTexts).find(({ text }) => text.includes('ITEM x'));

    expect(itemCommand?.text).toBe('  ITEM x0');

    itemCommand!.handlers.pointerdown();

    expect(dialog.shownMessages).toEqual(['No medicine in your pack!']);
    expect((scene as unknown as { mode: string }).mode).toBe('events');
  });
});

describe('a lost raid resolved inside a battle', () => {
  it('prices the supplies against the bag the raid carried, not the persisted one', () => {
    const manager = new RunManager();
    const deployed = new Pokemon(CHARMANDER, 5);
    manager.startRun(
      { party: [deployed], items: [{ itemId: 'potion', quantity: 2 }] },
      { mapId: 'floodplain-relay', durationMs: 300_000 },
    );
    const runSession = createActiveRunSession(manager, {}, {}, ['charmander-1'], [
      { itemId: 'potion', quantity: 2 },
    ]);
    const start = vi.fn();
    // Two Potions deployed, one drunk in this fight, one still in the pack.
    const { scene } = createBattleSceneHarness({ runSession, bag: new Bag({ potion: 1 }) });
    Object.assign(scene as object, {
      scene: { manager: { keys: { world: {}, base: {}, extraction: {} } }, start },
    });

    (scene as unknown as { resolveRunWipe(): void }).resolveRunWipe();

    const { report } = start.mock.calls[0][1] as {
      report: { spent: readonly { readonly label: string; readonly quantity: number }[] };
    };
    // Read from the persisted save's bag - which is the free-roam inventory and
    // has nothing to do with a raid - this said the raid spent everything it
    // carried, or nothing at all, depending on what was in that other bag.
    expect(report.spent.map(({ label, quantity }) => `${quantity}x ${label}`)).toEqual([
      '1x Potion',
    ]);
  });

  it('splits what the raid drank from what went down with it, so neither counts twice', () => {
    const manager = new RunManager();
    const deployed = new Pokemon(CHARMANDER, 5);
    manager.startRun(
      { party: [deployed], items: [{ itemId: 'potion', quantity: 2 }] },
      { mapId: 'floodplain-relay', durationMs: 300_000 },
    );
    const runSession = createActiveRunSession(manager, {}, {}, ['charmander-1'], [
      { itemId: 'potion', quantity: 2 },
    ]);
    const start = vi.fn();
    // Two Potions deployed, one drunk in this fight, one still in the pack.
    const { scene } = createBattleSceneHarness({ runSession, bag: new Bag({ potion: 1 }) });
    Object.assign(scene as object, {
      scene: { manager: { keys: { world: {}, base: {}, extraction: {} } }, start },
    });

    (scene as unknown as { resolveRunWipe(): void }).resolveRunWipe();

    const { report } = start.mock.calls[0][1] as {
      report: {
        ledger: { items: readonly { readonly itemId: string; readonly quantity: number }[] };
        spent: readonly { readonly itemId: string; readonly quantity: number }[];
      };
    };
    // "Gone for good" is what was still on the player when the raid ended;
    // "Supplies spent" is what the raid drank. Listing the whole loadout under
    // the first while the second named part of it again made two Potions read
    // as four on one screen.
    expect(report.ledger.items.map(({ itemId, quantity }) => [itemId, quantity])).toEqual([
      ['potion', 1],
    ]);
    expect(report.spent.map(({ itemId, quantity }) => [itemId, quantity])).toEqual([['potion', 1]]);
  });

  it('never claims supplies were spent by a raid that did not open the pack', () => {
    const manager = new RunManager();
    const deployed = new Pokemon(CHARMANDER, 5);
    manager.startRun(
      { party: [deployed], items: [{ itemId: 'potion', quantity: 2 }] },
      { mapId: 'floodplain-relay', durationMs: 300_000 },
    );
    const runSession = createActiveRunSession(manager, {}, {}, ['charmander-1'], [
      { itemId: 'potion', quantity: 2 },
    ]);
    const start = vi.fn();
    // The whole loadout is still in the pack: this raid healed nobody.
    const { scene } = createBattleSceneHarness({ runSession, bag: new Bag({ potion: 2 }) });
    Object.assign(scene as object, {
      scene: { manager: { keys: { world: {}, base: {}, extraction: {} } }, start },
    });

    (scene as unknown as { resolveRunWipe(): void }).resolveRunWipe();

    const { report } = start.mock.calls[0][1] as {
      report: {
        ledger: { items: readonly { readonly itemId: string; readonly quantity: number }[] };
        spent: readonly unknown[];
      };
    };
    expect(report.spent).toEqual([]);
    expect(report.ledger.items.map(({ itemId, quantity }) => [itemId, quantity])).toEqual([
      ['potion', 2],
    ]);
  });

  it('hands the wipe to the result screen instead of racing the hub to it', () => {
    const manager = new RunManager();
    const deployed = new Pokemon(CHARMANDER, 5);
    manager.startRun(
      { party: [deployed], items: [{ itemId: 'potion', quantity: 2 }] },
      { mapId: 'floodplain-relay', durationMs: 300_000 },
    );
    const runSession = createActiveRunSession(manager, {}, {}, ['charmander-1'], [
      { itemId: 'potion', quantity: 2 },
    ]);
    const start = vi.fn();
    const { scene } = createBattleSceneHarness({ runSession });
    Object.assign(scene as object, {
      scene: { manager: { keys: { world: {}, base: {}, extraction: {} } }, start },
    });
    const internals = scene as unknown as {
      resolveRunWipe(): void;
      completeReturnToWorld(): void;
    };

    internals.resolveRunWipe();

    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0][0]).toBe('extraction');
    expect(start.mock.calls[0][1]).toMatchObject({
      report: { outcome: 'WIPED', cause: 'defeated' },
    });

    // The faint narration finishes behind the hand-off. Before this was guarded
    // it started the hub here and the result screen was never seen at all.
    start.mockClear();
    internals.completeReturnToWorld();

    expect(start).not.toHaveBeenCalled();
  });

  it('reports the raid clock the raid actually ran on, not the base duration', () => {
    const manager = new RunManager();
    const deployed = new Pokemon(CHARMANDER, 5);
    // A recovery booked at base shortens the raid; the screen has to say so.
    const shortenedMs = 180_000;
    manager.startRun(
      { party: [deployed], items: [] },
      { mapId: 'floodplain-relay', durationMs: shortenedMs },
    );
    manager.tick(60_000);
    const runSession = createActiveRunSession(manager, {}, {}, ['charmander-1'], []);
    const start = vi.fn();
    const { scene } = createBattleSceneHarness({ runSession });
    Object.assign(scene as object, {
      scene: { manager: { keys: { world: {}, base: {}, extraction: {} } }, start },
    });

    (scene as unknown as { resolveRunWipe(): void }).resolveRunWipe();

    expect(start.mock.calls[0][1]).toMatchObject({
      report: { durationMs: shortenedMs, clockLabel: '1:00 of 3:00' },
    });
  });
});

describe('a level reached in the middle of a trainer battle', () => {
  /**
   * The reported fight, reduced to its moving parts: a Squirtle one knockout
   * short of level 7 - where it learns Water Gun - against a trainer whose lead
   * is on its last point of HP and who has a second Pokemon behind it. Only
   * that second Pokemon keeps the battle alive long enough for the level-up to
   * be looked at; a wild battle ends on the knockout that awards it, which is
   * why this was only ever reported from a trainer fight.
   */
  const levellingBattle = () => {
    const lead = new Pokemon(PIDGEY, 3);
    const squirtle = new Pokemon(SQUIRTLE, 6);
    // One knockout short of 7 on its own curve: the Pidgey's FireRed yield,
    // and half as much again because a trainer's Pokemon pays it.
    squirtle.experience =
      experienceForLevel(7, SQUIRTLE.growthRate) - experienceAwardForDefeat(lead, { trainer: true });
    squirtle.takeDamage(4);
    lead.takeDamage(lead.maxHp - 1);
    const harness = createBattleSceneHarness({
      authoredTrainer: true,
      trainerParty: [lead, new Pokemon(PIDGEY, 5)],
      party: new PokemonParty([squirtle]),
    });
    return { ...harness, squirtle };
  };

  /**
   * Plays the queued narration out the way pressing through it does - including
   * the one thing pressing through it can run into, the question asked before a
   * trainer's next Pokemon lands. Declining is what a player holding the key
   * gets, because the cursor starts on NO.
   */
  const readThroughNarration = (scene: BattleScene, dialog: { isCurrentMessageComplete: boolean }): void => {
    dialog.isCurrentMessageComplete = true;
    for (let step = 0; step < 40; step += 1) {
      if ((scene as unknown as { mode: string }).mode === 'main') {
        return;
      }
      if ((scene as unknown as { mode: string }).mode === 'about-to-use') {
        (scene as unknown as { confirm(): void }).confirm();
        continue;
      }
      (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    }
    throw new Error('The battle never handed the commands back.');
  };

  const knockOutTheLead = (scene: BattleScene, renderedTexts: RenderedText[]): void => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    read(renderedTexts).find(({ text }) => text.includes('FIGHT'))?.handlers.pointerdown();
    const tackle = read(renderedTexts).filter(({ text }) => text.includes('TACKLE')).at(-1);
    if (!tackle) {
      throw new Error('The move menu did not offer Tackle.');
    }
    tackle.handlers.pointerdown();
  };

  it('puts the new level on the plate the player is reading', () => {
    const { scene, renderedTexts, dialog, squirtle } = levellingBattle();

    knockOutTheLead(scene, renderedTexts);

    expect(squirtle.level).toBe(7);
    // The plate is rewritten as the level is awarded, not on the way out of the
    // battle: the rest of this fight is played against it. It is the plate of
    // the slot that Pokemon is standing in, which in a single battle is the one
    // plate there is.
    expect(
      (
        scene as unknown as { plates: Map<string, { levelText: { text: string } }> }
      ).plates.get('player0')!.levelText.text,
    ).toBe('Lv 7');
    readThroughNarration(scene, dialog);
    expect(dialog.shownMessages).toContain('SQUIRTLE grew to Lv 7!');
  });

  it('says what the knockout paid straight after the faint, before the next Pokemon comes in', () => {
    const { scene, renderedTexts, dialog } = levellingBattle();

    knockOutTheLead(scene, renderedTexts);
    readThroughNarration(scene, dialog);

    const shown = dialog.shownMessages;
    const fainted = shown.indexOf('Foe PIDGEY fainted!');
    const sentOut = shown.indexOf('RAIDER MAYA sent out PIDGEY!');
    expect(fainted).toBeGreaterThanOrEqual(0);
    expect(shown[fainted + 1]).toMatch(/^SQUIRTLE gained \d+ XP!$/);
    expect(sentOut).toBeGreaterThan(fainted);
    // And the newcomer takes nothing on its way in: its first move is next turn.
    expect(shown.slice(fainted, sentOut + 1).some((line) => line.startsWith('Foe PIDGEY used'))).toBe(false);
    expect(shown.slice(sentOut + 1).some((line) => line.startsWith('Foe PIDGEY used'))).toBe(false);
  });

  it('offers the move it just said was learned, with the PP of the old moves untouched', () => {
    const { scene, renderedTexts, dialog } = levellingBattle();

    knockOutTheLead(scene, renderedTexts);

    // The battle's own move list, which is what the menu is built from.
    const { player } = (scene as unknown as { state: BattleState }).state;
    expect(player.moves.map(({ base, pp }) => `${base.name} ${pp}`)).toEqual([
      // One Tackle spent on the knockout, and nothing else refilled behind it.
      'Tackle 19',
      'Tail Whip 30',
      'Growl 30',
      'Water Gun 25',
    ]);

    readThroughNarration(scene, dialog);
    expect(dialog.shownMessages).toContain('SQUIRTLE learned WATER GUN!');
    const beforeMenu = renderedTexts.length;
    read(renderedTexts).filter(({ text }) => text.includes('FIGHT')).at(-1)?.handlers.pointerdown();

    expect(
      read(renderedTexts)
        .slice(beforeMenu)
        .map(({ text }) => text.trim())
        .filter((text) => /^[▶ ]*[A-Z]/.test(text) && !text.includes('·')),
    ).toEqual(['▶ TACKLE', 'TAIL WHIP', 'GROWL', 'WATER GUN']);
  });

  it('carries the HP the higher maximum granted instead of dropping it on the way out', () => {
    const { scene, squirtle, renderedTexts, dialog } = levellingBattle();
    const maxHpBefore = squirtle.maxHp;

    knockOutTheLead(scene, renderedTexts);

    const { player } = (scene as unknown as { state: BattleState }).state;
    expect(maxHpBefore).toBe(18);
    expect(player.pokemon.maxHp).toBe(20);
    // `Pokemon.gainExperience` grants the two points the new maximum brings.
    // The battle's own count is what is written back to the party on the way
    // out, so if it does not pick the same two up they are quietly lost.
    expect(player.currentHp).toBe(squirtle.currentHp);
    expect(player.currentHp).toBeGreaterThan(0);
    readThroughNarration(scene, dialog);
  });

  it('leaves a benched Pokemon to be read live when it is sent out', () => {
    const lead = new Pokemon(PIDGEY, 3);
    // Both faced the lead, so they share what it pays, as FireRed shares it.
    const share = experienceAwardForDefeat(lead, { participants: 2, trainer: true });
    const squirtle = new Pokemon(SQUIRTLE, 6);
    squirtle.experience = experienceForLevel(7, SQUIRTLE.growthRate) - share;
    const benched = new Pokemon(SQUIRTLE, 6);
    benched.experience = experienceForLevel(7, SQUIRTLE.growthRate) - share;
    lead.takeDamage(lead.maxHp - 1);
    const { scene, renderedTexts, dialog } = createBattleSceneHarness({
      authoredTrainer: true,
      trainerParty: [lead, new Pokemon(PIDGEY, 5)],
      party: new PokemonParty([squirtle, benched]),
    });
    // It was out against the lead earlier in the fight and is benched now.
    (scene as unknown as { foesFacedBy: Map<Pokemon, Set<Pokemon>> }).foesFacedBy.get(lead)!.add(benched);

    knockOutTheLead(scene, renderedTexts);
    readThroughNarration(scene, dialog);
    (scene as unknown as { switchPokemon(index: number): void }).switchPokemon(1);

    const { player } = (scene as unknown as { state: BattleState }).state;
    expect(benched.level).toBe(7);
    expect(player.pokemon).toBe(benched);
    expect(player.moves.map(({ base }) => base.name)).toContain('Water Gun');
  });
});

/**
 * A knockout in a trainer fight used to be a cutscene: the next Pokemon arrived
 * and the player read about it. Named before it lands, it is a decision - and
 * the switch is free, because nothing has moved yet.
 */
describe('a Pokemon with no PP left', () => {
  it('says it has no moves left and Struggles, instead of offering a list it cannot use', () => {
    const squirtle = new Pokemon(SQUIRTLE, 8);
    squirtle.moves.forEach((move) => move.setPp(0));
    const { scene, renderedTexts, dialog } = createBattleSceneHarness({
      authoredTrainer: true,
      trainerParty: [new Pokemon(PIDGEY, 5)],
      party: new PokemonParty([squirtle]),
    });

    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    read(renderedTexts).find(({ text }) => text.includes('FIGHT'))?.handlers.pointerdown();
    dialog.isCurrentMessageComplete = true;
    for (let step = 0; step < 20 && (scene as unknown as { mode: string }).mode !== 'main'; step += 1) {
      (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    }

    const shown = dialog.shownMessages;
    const said = shown.indexOf('SQUIRTLE has no moves left!');
    expect(said).toBeGreaterThanOrEqual(0);
    expect(shown.slice(said + 1).some((line) => line.startsWith('Your SQUIRTLE used STRUGGLE!'))).toBe(true);
  });
});

/**
 * Playtest 20, N2: after the player's Pokemon fainted, choosing its
 * replacement ran a whole enemy turn first, so the foe got a free hit on every
 * replacement - the mirror image of the trainer's free hit B1 removed. In
 * FireRed the replacement comes in free and the next turn starts with both
 * sides choosing.
 */
describe('a replacement sent in after a faint', () => {
  it('comes in free, and the foe does not act until the next turn', () => {
    const pidgey = new Pokemon(PIDGEY, 5);
    pidgey.moves.splice(0, pidgey.moves.length, new Move(GROWL));
    pidgey.currentHp = 1;
    const charmander = new Pokemon(CHARMANDER, 30);
    const { scene, renderedTexts, dialog } = createBattleSceneHarness({
      authoredTrainer: true,
      trainerParty: [new Pokemon(getSpeciesById('rattata')!, 15)],
      party: new PokemonParty([pidgey, charmander]),
    });

    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    renderedTexts.find(({ text }) => text.includes('FIGHT'))?.handlers.pointerdown();
    renderedTexts.filter(({ text }) => text.includes('GROWL')).at(-1)!.handlers.pointerdown();
    dialog.isCurrentMessageComplete = true;
    const mode = () => (scene as unknown as { mode: string }).mode;
    for (let step = 0; step < 40 && mode() !== 'party'; step += 1) {
      (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    }
    expect(dialog.shownMessages).toContain('Your PIDGEY fainted!');

    (scene as unknown as { switchPokemon(index: number): void }).switchPokemon(1);
    for (let step = 0; step < 40 && mode() !== 'main'; step += 1) {
      (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    }

    const shown = dialog.shownMessages;
    const goLine = shown.lastIndexOf('Go, CHARMANDER!');
    expect(goLine).toBeGreaterThanOrEqual(0);
    expect(shown.slice(goLine + 1).some((line) => line.startsWith('Foe RATTATA used'))).toBe(false);
    expect(mode()).toBe('main');
    const { state } = scene as unknown as { state: BattleState };
    expect(state.player.pokemon).toBe(charmander);
    expect(state.player.currentHp).toBe(charmander.maxHp);
  });
});

describe('the forced replacement list', () => {
  /** A lead on its last point of HP that only Growls, a bench behind it, and a trainer that will knock it out. */
  const readToTheReplacement = () => {
    const pidgey = new Pokemon(PIDGEY, 5);
    pidgey.moves.splice(0, pidgey.moves.length, new Move(GROWL));
    pidgey.currentHp = 1;
    const charmander = new Pokemon(CHARMANDER, 30);
    const harness = createBattleSceneHarness({
      authoredTrainer: true,
      trainerParty: [new Pokemon(getSpeciesById('rattata')!, 15)],
      party: new PokemonParty([pidgey, charmander]),
    });
    const { scene, renderedTexts, dialog } = harness;
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    renderedTexts.find(({ text }) => text.includes('FIGHT'))?.handlers.pointerdown();
    renderedTexts.filter(({ text }) => text.includes('GROWL')).at(-1)!.handlers.pointerdown();
    dialog.isCurrentMessageComplete = true;
    for (let step = 0; step < 40 && (scene as unknown as { mode: string }).mode !== 'party'; step += 1) {
      (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    }
    expect((scene as unknown as { mode: string }).mode).toBe('party');
    return { ...harness, pidgey, charmander };
  };

  it('opens on the first Pokemon that can fight, so the key already held sends it in (playtest 45)', () => {
    const { scene, renderedTexts, charmander } = readToTheReplacement();

    expect((scene as unknown as { selectedCommand: number }).selectedCommand).toBe(1);
    expect(read(renderedTexts).some(({ text }) => text.startsWith('▶ CHARMANDER'))).toBe(true);
    (scene as unknown as { confirm(): void }).confirm();
    expect((scene as unknown as { state: BattleState }).state.player.pokemon).toBe(charmander);
  });

  it('says the fainted Pokemon has no energy left, not that it is already out', () => {
    const { scene, renderedTexts } = readToTheReplacement();

    (scene as unknown as { switchPokemon(index: number): void }).switchPokemon(0);
    const texts = read(renderedTexts).map(({ text }) => text.trim());
    expect(texts).toContain('PIDGEY has no energy left to battle!');
    expect(texts.some((text) => text.includes('already out'))).toBe(false);
  });
});

describe('the battle menu remembers where the cursor was left, as FireRed does', () => {
  it('opens the next turn on RUN after a failed escape, so trying again is one press (playtest 45)', () => {
    const { scene, renderedTexts, dialog } = createBattleSceneHarness();
    // A roll no escape chance clears.
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    read(renderedTexts).find(({ text }) => text.includes('RUN'))!.handlers.pointerdown();

    dialog.isCurrentMessageComplete = true;
    const mode = () => (scene as unknown as { mode: string }).mode;
    for (let step = 0; step < 40 && mode() !== 'main'; step += 1) {
      (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    }

    expect(mode()).toBe('main');
    const commands = read(renderedTexts).slice(-5).map(({ text }) => text);
    expect(commands.find((text) => text.startsWith('▶'))).toMatch(/^▶ RUN/);
  });

  it("opens FIGHT on the move each Pokemon used last, and backing out returns to FIGHT", () => {
    const { scene, renderedTexts, dialog } = createBattleSceneHarness();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const mode = () => (scene as unknown as { mode: string }).mode;
    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    read(renderedTexts).find(({ text }) => text.includes('FIGHT'))!.handlers.pointerdown();
    read(renderedTexts).filter(({ text }) => text.includes('GROWL')).at(-1)!.handlers.pointerdown();
    dialog.isCurrentMessageComplete = true;
    for (let step = 0; step < 40 && mode() !== 'main'; step += 1) {
      (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    }
    expect(mode()).toBe('main');
    expect(read(renderedTexts).slice(-5).find(({ text }) => text.startsWith('▶'))?.text).toBe('▶ FIGHT');

    (scene as unknown as { confirm(): void }).confirm();
    expect(mode()).toBe('moves');
    expect(read(renderedTexts).filter(({ text }) => text.startsWith('▶')).at(-1)?.text).toBe('▶ GROWL');

    (scene as unknown as { goBack(): void }).goBack();
    expect(mode()).toBe('main');
    expect(read(renderedTexts).slice(-5).find(({ text }) => text.startsWith('▶'))?.text).toBe('▶ FIGHT');
  });
});

describe('BattleScene about-to-use switch prompt', () => {
  /** A trainer on their last point of HP with a second Pokemon, and a bench to answer it with. */
  const fightWithABench = () => {
    const squirtle = new Pokemon(SQUIRTLE, 8);
    const benched = new Pokemon(BULBASAUR, 8);
    const lead = new Pokemon(PIDGEY, 3);
    lead.takeDamage(lead.maxHp - 1);
    const harness = createBattleSceneHarness({
      authoredTrainer: true,
      trainerParty: [lead, new Pokemon(PIDGEY, 5)],
      party: new PokemonParty([squirtle, benched]),
    });
    return { ...harness, squirtle, benched };
  };

  /** Knocks the lead out and reads up to the question the send-out is held behind. */
  const readUpToTheQuestion = (
    scene: BattleScene,
    renderedTexts: RenderedText[],
    dialog: { isCurrentMessageComplete: boolean },
  ): void => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    read(renderedTexts).find(({ text }) => text.includes('FIGHT'))?.handlers.pointerdown();
    read(renderedTexts).filter(({ text }) => text.includes('TACKLE')).at(-1)!.handlers.pointerdown();
    dialog.isCurrentMessageComplete = true;
    for (let step = 0; step < 40; step += 1) {
      if ((scene as unknown as { mode: string }).mode === 'about-to-use') {
        return;
      }
      (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    }
    throw new Error('The battle never offered the switch.');
  };

  it('names the Pokemon that is coming and starts the cursor on the answer that costs nothing', () => {
    const { scene, renderedTexts, dialog } = fightWithABench();

    readUpToTheQuestion(scene, renderedTexts, dialog);

    const panel = read(renderedTexts).slice(read(renderedTexts).findLastIndex(({ text }) => text.includes('is about to use')));
    expect(panel[0].text).toBe('RAIDER MAYA is about to use PIDGEY.');
    expect(panel[1].text).toBe('Will you switch POKéMON?');
    expect(panel.slice(2).map(({ text }) => text)).toEqual(['  YES', '▶ NO']);
    // Every line of it is inside the one panel the rest of the fight is drawn in.
    expect(panel.every(({ y }) => y >= 174 && y < 238)).toBe(true);
    // The send-out it is holding back has not been read yet.
    expect(dialog.shownMessages).not.toContain('RAIDER MAYA sent out PIDGEY!');
  });

  it('carries straight on to the send-out when the offer is declined', () => {
    const { scene, renderedTexts, dialog, squirtle } = fightWithABench();

    readUpToTheQuestion(scene, renderedTexts, dialog);
    (scene as unknown as { confirm(): void }).confirm();

    expect(dialog.shownMessages).toContain('RAIDER MAYA sent out PIDGEY!');
    expect((scene as unknown as { state: BattleState }).state.player.pokemon).toBe(squirtle);
  });

  it('switches for free: the bench lands before the trainer does, and nothing moves in return', () => {
    const { scene, renderedTexts, dialog, benched } = fightWithABench();

    readUpToTheQuestion(scene, renderedTexts, dialog);
    const yes = read(renderedTexts).findLast(({ text }) => text.includes('YES'))!;
    yes.handlers.pointerover();
    yes.handlers.pointerdown();
    expect((scene as unknown as { mode: string }).mode).toBe('party');
    read(renderedTexts).findLast(({ text }) => text.includes('BULBASAUR'))!.handlers.pointerdown();

    const { state } = scene as unknown as { state: BattleState };
    expect(state.player.pokemon).toBe(benched);
    // A switch taken from the main commands spends the enemy's turn. This one
    // cannot: the Pokemon it is made against has not been sent out yet.
    expect(state.player.currentHp).toBe(benched.maxHp);
    for (let step = 0; step < 40 && (scene as unknown as { mode: string }).mode !== 'main'; step += 1) {
      (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    }
    const shown = dialog.shownMessages;
    // The switch lands in front of the send-out it was offered against, and the
    // turn that was already queued behind it carries on unchanged.
    expect(shown.slice(shown.indexOf('Come back, SQUIRTLE!'), shown.indexOf('Come back, SQUIRTLE!') + 3)).toEqual([
      'Come back, SQUIRTLE!',
      'Go, BULBASAUR!',
      'RAIDER MAYA sent out PIDGEY!',
    ]);
  });

  it('asks once per Pokemon, and never when there is nobody to switch to', () => {
    const squirtle = new Pokemon(SQUIRTLE, 8);
    const lead = new Pokemon(PIDGEY, 3);
    lead.takeDamage(lead.maxHp - 1);
    const { scene, renderedTexts, dialog } = createBattleSceneHarness({
      authoredTrainer: true,
      trainerParty: [lead, new Pokemon(PIDGEY, 5)],
      party: new PokemonParty([squirtle]),
    });

    vi.spyOn(Math, 'random').mockReturnValue(0);
    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    read(renderedTexts).find(({ text }) => text.includes('FIGHT'))?.handlers.pointerdown();
    read(renderedTexts).filter(({ text }) => text.includes('TACKLE')).at(-1)!.handlers.pointerdown();
    dialog.isCurrentMessageComplete = true;
    for (let step = 0; step < 40; step += 1) {
      if ((scene as unknown as { mode: string }).mode === 'main') {
        break;
      }
      (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    }

    expect(read(renderedTexts).some(({ text }) => text.includes('is about to use'))).toBe(false);
    expect(dialog.shownMessages).toContain('RAIDER MAYA sent out PIDGEY!');
  });
});

describe('throwing a ball in a wild battle', () => {
  const open = (bag: Bag) => {
    const harness = createBattleSceneHarness({ bag });
    (harness.scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    const press = (match: string, from = 0): void => {
      const row = read(harness.renderedTexts).slice(from).filter(({ text }) => text.includes(match)).at(-1);
      if (!row) {
        throw new Error(`No command row matching ${match}`);
      }
      row.handlers.pointerdown();
    };
    return { ...harness, press };
  };

  it('counts and throws a Great Ball when it is the only ball carried', () => {
    const bag = new Bag({ 'great-ball': 2 });
    const { renderedTexts, press } = open(bag);

    expect(read(renderedTexts).find(({ text }) => text.includes('BALL x'))?.text).toBe('  BALL x2');

    press('BALL x');

    expect(bag.count('great-ball')).toBe(1);
  });

  it('puts the ball that was thrown on the field (playtest section 3, item 7)', () => {
    const bag = new Bag({ 'great-ball': 2 });
    const { scene, press } = open(bag);

    press('BALL x');

    const images = (scene as unknown as { add: { image: { mock: { calls: unknown[][] } } } }).add.image.mock.calls;
    expect(images.map((call) => call[2])).toContain(iconTextureKey(itemIconName('great-ball')));
  });

  it('asks which ball when two kinds are carried, and spends only the one chosen', () => {
    const bag = new Bag({ 'poke-ball': 2, 'great-ball': 1 });
    const { scene, renderedTexts, press } = open(bag);

    expect(read(renderedTexts).find(({ text }) => text.includes('BALL x'))?.text).toBe('  BALL x3');
    const before = renderedTexts.length;
    press('BALL x');

    expect((scene as unknown as { mode: string }).mode).toBe('balls');
    expect(bag.count('poke-ball')).toBe(2);
    expect(bag.count('great-ball')).toBe(1);

    press('POKé BALL x', before);

    expect(bag.count('poke-ball')).toBe(1);
    expect(bag.count('great-ball')).toBe(1);
  });

  it('refuses honestly with no ball of any kind', () => {
    const { dialog, press } = open(new Bag({ potion: 1 }));

    press('BALL x0');

    expect(dialog.shownMessages).toEqual(['No POKé BALLS left!']);
  });

  it('applies the Great Ball\'s own 1.5 to the catch roll', () => {
    // The harness's wild Bulbasaur (catch rate 45) at full health: FireRed's
    // odds are 15 in a Poke Ball and 22 in a Great Ball, so each of the four
    // shake checks passes under 32767 and 36157 of 65536 - and a roll of 0.52
    // (34078) passes all four in the Great Ball and none in the Poke Ball.
    const roll = vi.spyOn(Math, 'random').mockReturnValue(0.52);
    try {
      const poke = new Bag({ 'poke-ball': 1 });
      const great = new Bag({ 'great-ball': 1 });
      const pokeThrow = open(poke);
      pokeThrow.press('BALL x');
      expect((pokeThrow.scene as unknown as { state: { outcome: string } }).state.outcome).not.toBe('caught');

      const greatThrow = open(great);
      greatThrow.press('BALL x');
      expect((greatThrow.scene as unknown as { state: { outcome: string } }).state.outcome).toBe('caught');
    } finally {
      roll.mockRestore();
    }
  });
});

/**
 * The captain, 2026-09-20: "I'm just battling a Magikarp and it says that I need
 * to make space in my bag to catch a Magikarp - but there's no bag management."
 *
 * The pack refuses the catch and names the squares, which is right, and then
 * tells the player to do a thing the fight gives them no way to do: the bag
 * cannot be opened from a battle, and the only obedient move is to flee, which
 * loses the Pokemon the refusal was about. The refusal is now the doorway.
 */
describe('a catch the pack has no room for', () => {
  /** A pack packed to its last square, with one ball still in it. */
  const fullPack = () => new Bag({ potion: 17, 'poke-ball': 1 });

  const open = (bag: Bag) => {
    const harness = createBattleSceneHarness({ bag });
    (harness.scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    const press = (match: string, from = 0): void => {
      const row = harness.renderedTexts
        .slice(from)
        .filter(({ text }) => text.includes(match))
        .at(-1);
      if (!row) {
        throw new Error(`No command row matching ${match}`);
      }
      row.handlers.pointerdown();
    };
    const readPanel = (from: number): string[] =>
      read(harness.renderedTexts).slice(from).map(({ text }) => text);
    return { ...harness, press, readPanel };
  };

  it('spends no ball, and opens the choice of what to put down', () => {
    const bag = fullPack();
    const { scene, dialog, press, renderedTexts } = open(bag);
    const before = renderedTexts.length;

    press('BALL x1');

    // Nothing is spent to find out, whichever ball was chosen.
    expect(bag.count('poke-ball')).toBe(1);
    expect(dialog.shownMessages[0]).toContain('BULBASAUR needs 4 squares');
    // The refusal is read, and then the panel asks the question it raises.
    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    expect((scene as unknown as { mode: string }).mode).toBe('make-room');
    const panel = read(renderedTexts).slice(before).map(({ text }) => text);
    expect(panel.some((text) => text.includes('POTION x17 \u00b7 1sq'))).toBe(true);
    // The one ball left is what the room is being made for, so it is not on
    // the table: inviting the player to put it down would be a second trap in
    // the same breath as the first.
    expect(panel.some((text) => text.includes('POKé BALL'))).toBe(false);
    expect(panel.some((text) => text.includes('KEEP THE PACK'))).toBe(true);
  });

  it('throws the held ball the moment a drop has bought the room', () => {
    const roll = vi.spyOn(Math, 'random').mockReturnValue(0.01);
    try {
      const bag = fullPack();
      const { scene, press, renderedTexts } = open(bag);

      const before = renderedTexts.length;
      press('BALL x1');
      (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
      // Four Potions is four squares, and a 2x2 Bulbasaur needs all four of
      // them together - so the first three drops leave the panel open.
      for (let drop = 0; drop < 4; drop += 1) {
        press('POTION x', before);
      }

      expect(bag.count('potion')).toBe(13);
      // The ball held over the refusal is the ball thrown, and only then.
      expect(bag.count('poke-ball')).toBe(0);
      expect((scene as unknown as { state: { outcome: string } }).state.outcome).toBe('caught');
    } finally {
      roll.mockRestore();
    }
  });

  it('keeps the pack, spends nothing, and hands the fight back whole', () => {
    const bag = fullPack();
    const { scene, press, renderedTexts } = open(bag);

    const before = renderedTexts.length;
    press('BALL x1');
    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    press('KEEP THE PACK', before);

    expect(bag.count('potion')).toBe(17);
    expect(bag.count('poke-ball')).toBe(1);
    // Every command is back: fighting on is a way forward, and fleeing is only
    // one of five.
    expect((scene as unknown as { mode: string }).mode).toBe('main');
    expect(read(renderedTexts).slice(-5).map(({ text }) => text)).toEqual([
      '\u25b6 FIGHT',
      '  BALL x1',
      '  POKéMON',
      '  ITEM x17',
      expect.stringContaining('RUN'),
    ]);
  });

  it('Escape is the same answer as the row, so the panel is never a trap', () => {
    const bag = fullPack();
    const { scene, press } = open(bag);

    press('BALL x1');
    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    (scene as unknown as { goBack(): void }).goBack();

    expect((scene as unknown as { mode: string }).mode).toBe('main');
    expect(bag.count('potion')).toBe(17);
  });

  it('throws the ball that was chosen, not the one that ends up in its place', () => {
    const roll = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    try {
      // A Great Ball was chosen; putting down the last Poke Ball renumbers the
      // list, and the throw must still be the Great Ball.
      const bag = new Bag({ potion: 15, 'poke-ball': 1, 'great-ball': 2 });
      const { scene, press, renderedTexts } = open(bag);
      const before = renderedTexts.length;

      press('BALL x3');
      press('GREAT BALL x', before);
      (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
      const panelFrom = renderedTexts.length;
      press('POKé BALL x1', before);
      for (let drop = 0; drop < 3; drop += 1) {
        press('POTION x', panelFrom);
      }

      expect(bag.count('poke-ball')).toBe(0);
      expect(bag.count('great-ball')).toBe(1);
    } finally {
      roll.mockRestore();
    }
  });

  it('says so plainly when there is nothing in the pack to put down', () => {
    // Every square is a Pokemon already being carried home, so there is nothing
    // here the player could trade - which is a fact, not an instruction.
    const bag = new Bag({ 'poke-ball': 1 });
    bag.setCargo(
      [0, 1, 2, 3].map((index) => pokemonCargo(`carried-${index}`, new Pokemon(PIDGEY, 4))),
    );
    const { scene, dialog, press } = open(bag);

    press('BALL x1');

    expect(dialog.shownMessages[0]).toContain('it is all POKéMON');
    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    expect((scene as unknown as { mode: string }).mode).toBe('main');
    expect(bag.count('poke-ball')).toBe(1);
  });
});

/**
 * Just enough of Phaser's tween manager and scene clock to watch a sprite over
 * time: a tween takes its start values when it first runs, which is what let
 * one started for a Pokemon that fainted go on writing to the next one.
 */
function createFakeClock() {
  type Value = number | { readonly from: number; readonly to: number };
  interface FakeTween {
    readonly target: Record<string, number>;
    readonly props: readonly (readonly [string, Value])[];
    readonly duration: number;
    readonly yoyo: boolean;
    readonly repeat: number;
    readonly onComplete?: () => void;
    readonly onUpdate?: (tween: { getValue(): number }) => void;
    readonly counter?: { from: number; to: number; value: number };
    start?: Record<string, number>;
    elapsed: number;
    live: boolean;
  }
  let tweens: FakeTween[] = [];
  let timers: { at: number; callback: () => void }[] = [];
  let now = 0;
  const reserved = new Set(['targets', 'duration', 'yoyo', 'repeat', 'ease', 'delay', 'onComplete', 'onUpdate']);
  const add = (config: Record<string, unknown>): FakeTween => {
    const tween: FakeTween = {
      target: config.targets as Record<string, number>,
      props: Object.entries(config).filter(([key]) => !reserved.has(key)) as [string, Value][],
      duration: (config.duration as number) ?? 0,
      yoyo: Boolean(config.yoyo),
      repeat: (config.repeat as number) ?? 0,
      onComplete: config.onComplete as (() => void) | undefined,
      elapsed: 0,
      live: true,
    };
    tweens.push(tween);
    return tween;
  };
  const step = (ms: number): void => {
    now += ms;
    for (const tween of [...tweens]) {
      if (!tween.live) {
        continue;
      }
      if (tween.counter) {
        tween.elapsed += ms;
        const progress = Math.min(1, tween.elapsed / tween.duration);
        tween.counter.value = tween.counter.from + (tween.counter.to - tween.counter.from) * progress;
        tween.onUpdate?.({ getValue: () => tween.counter!.value });
        if (progress === 1) {
          tween.live = false;
        }
        continue;
      }
      tween.start ??= Object.fromEntries(
        tween.props.map(([key, value]) => [key, typeof value === 'number' ? tween.target[key] : value.from]),
      );
      tween.elapsed += ms;
      const leg = tween.duration;
      const cycle = tween.yoyo ? leg * 2 : leg;
      const total = cycle * (tween.repeat + 1);
      const at = Math.min(tween.elapsed, total);
      const within = at === total ? cycle : at % cycle;
      const progress = within <= leg ? within / leg : 1 - (within - leg) / leg;
      for (const [key, value] of tween.props) {
        const to = typeof value === 'number' ? value : value.to;
        tween.target[key] = tween.start[key] + (to - tween.start[key]) * progress;
      }
      if (at === total) {
        tween.live = false;
        tween.onComplete?.();
      }
    }
    for (const timer of timers.filter(({ at }) => at <= now)) {
      timers = timers.filter((other) => other !== timer);
      timer.callback();
    }
    tweens = tweens.filter(({ live }) => live);
  };
  return {
    tweens: {
      add: vi.fn(add),
      addCounter: vi.fn((config: { from: number; to: number; duration: number; onUpdate: FakeTween['onUpdate'] }) => {
        const tween: FakeTween = {
          target: {},
          props: [],
          duration: config.duration,
          yoyo: false,
          repeat: 0,
          onUpdate: config.onUpdate,
          counter: { from: config.from, to: config.to, value: config.from },
          elapsed: 0,
          live: true,
        };
        tweens.push(tween);
        return tween;
      }),
      killTweensOf: vi.fn((target: unknown) => {
        for (const tween of tweens) {
          if (tween.target === target) {
            tween.live = false;
          }
        }
      }),
    },
    time: {
      delayedCall: vi.fn((delayMs: number, callback: () => void) => {
        timers.push({ at: now + delayMs, callback });
      }),
    },
    /** Lets the given milliseconds pass, a frame at a time. */
    advance: (ms: number): void => {
      for (let spent = 0; spent < ms; spent += 16) {
        step(16);
      }
    },
  };
}

/** A sprite with real numbers on it, standing on its slot's spot. */
const standingSprite = (side: 'player' | 'enemy') => {
  const spot = combatantSpot(side, 0, 1);
  const sprite = {
    x: spot.x,
    y: spot.y,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    tinted: false,
    texture: '',
    setTexture: (key: string) => ((sprite.texture = key), sprite),
    setPosition: (x: number, y: number) => ((sprite.x = x), (sprite.y = y), sprite),
    setAlpha: (alpha: number) => ((sprite.alpha = alpha), sprite),
    setTintFill: () => ((sprite.tinted = true), sprite),
    clearTint: () => ((sprite.tinted = false), sprite),
  };
  return sprite;
};

/**
 * A trainer's Pokemon are all drawn on the one sprite their slot keeps, and a
 * player who reads the knockout lines as fast as they come puts each new one on
 * it while the last one's faint is still playing. The captain met it as a
 * trainer whose third Pokemon never showed up and was fought anyway.
 */
describe('a trainer sending out Pokemon after a knockout', () => {
  const fightThree = () => {
    const party = [new Pokemon(PIDGEY, 3), new Pokemon(PIDGEY, 3), new Pokemon(BULBASAUR, 3)];
    for (const pokemon of party) {
      pokemon.takeDamage(pokemon.maxHp - 1);
    }
    const harness = createBattleSceneHarness({
      authoredTrainer: true,
      trainerParty: party,
      party: new PokemonParty([new Pokemon(SQUIRTLE, 8)]),
    });
    const clock = createFakeClock();
    const sprites = new Map([
      ['player0', standingSprite('player')],
      ['enemy0', standingSprite('enemy')],
    ]);
    Object.assign(harness.scene as object, {
      tweens: clock.tweens,
      time: clock.time,
      sprites,
    });
    return { ...harness, party, clock, enemySprite: sprites.get('enemy0')! };
  };

  /** One turn of TACKLE, every line read the instant it is up. */
  const knockOutAtOnce = (
    scene: BattleScene,
    renderedTexts: RenderedText[],
    dialog: { isCurrentMessageComplete: boolean },
  ): void => {
    read(renderedTexts).findLast(({ text }) => text.includes('FIGHT'))!.handlers.pointerdown();
    read(renderedTexts).filter(({ text }) => text.includes('TACKLE')).at(-1)!.handlers.pointerdown();
    dialog.isCurrentMessageComplete = true;
    for (let step = 0; step < 40; step += 1) {
      if ((scene as unknown as { mode: string }).mode === 'main') {
        return;
      }
      (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    }
    throw new Error('The turn never handed the commands back.');
  };

  it('stands every Pokemon after the first on its spot, whole, however fast the lines are read', () => {
    const { scene, renderedTexts, dialog, party, clock, enemySprite } = fightThree();
    const spot = combatantSpot('enemy', 0, 1);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();

    for (const next of party.slice(1)) {
      knockOutAtOnce(scene, renderedTexts, dialog);
      expect(dialog.shownMessages).toContain(`RAIDER MAYA sent out ${next.base.name.toUpperCase()}!`);
      // Long enough for anything started by the knockout to have finished.
      clock.advance(1500);

      expect(enemySprite.texture).toBe(`pokemon-front-${next.base.dexId}`);
      expect({ x: enemySprite.x, y: enemySprite.y, alpha: enemySprite.alpha, tinted: enemySprite.tinted }).toEqual({
        x: spot.x,
        y: spot.y,
        alpha: 1,
        tinted: false,
      });
    }
  });

  it('never lands the blow that knocked one Pokemon out on the plate of the one that replaced it', () => {
    const { scene, renderedTexts, dialog, party, clock } = fightThree();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();

    knockOutAtOnce(scene, renderedTexts, dialog);
    clock.advance(1500);

    const { displayedHp } = scene as unknown as { displayedHp: Map<string, number> };
    expect(displayedHp.get('enemy0')).toBe(party[1].currentHp);
  });
});
