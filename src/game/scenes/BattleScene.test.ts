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
import { CHARMANDER, Pokemon, PokemonParty } from '../pokemon';
import { createBattleState, createTrainerBattleState } from '../pokemon/battle/battleEngine';
import { BULBASAUR, PIDGEY } from '../pokemon/species';
import { RunManager } from '../run/RunManager';
import { createActiveRunSession } from '../run/RunSession';
import { HUNTER_SEARCH_MS, createHunterState } from '../world/hunter';
import { BattleScene } from './BattleScene';

interface RenderedText {
  readonly x: number;
  readonly y: number;
  readonly style: Record<string, unknown>;
  text: string;
  readonly handlers: Record<string, () => void>;
  setInteractive: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  setText: ReturnType<typeof vi.fn>;
  setBackgroundColor: ReturnType<typeof vi.fn>;
  setColor: ReturnType<typeof vi.fn>;
}

interface HarnessOptions {
  /** Builds the hunter pursuit battle instead of the default wild encounter. */
  readonly hunterBattle?: boolean;
  /** Fights an authored trainer, which is the battle that cannot be left. */
  readonly authoredTrainer?: boolean;
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
        name: 'RIVAL HUNTER',
        party: [new Pokemon(PIDGEY, 6)],
        defeatText: 'You slipped through my fingers... this time.',
      }
    : options.authoredTrainer
      ? {
          id: 'floodplain-checkpoint-maya',
          name: 'RAIDER MAYA',
          party: [new Pokemon(PIDGEY, 7)],
          defeatText: 'The checkpoint is open.',
        }
      : undefined;
  const state = trainer
    ? createTrainerBattleState(player, trainer)
    : createBattleState(player, enemy);
  const scene = Object.create(BattleScene.prototype) as BattleScene;

  Object.assign(scene as object, {
    add: {
      // The party screen - the target picker for an item as well as the switch
      // menu - is built inside a container, so the harness has to hold one.
      container: vi.fn(() => {
        const children: unknown[] = [];
        return { children, add: vi.fn((child: unknown) => children.push(child)) };
      }),
      graphics: vi.fn(() => ({
        fillStyle: vi.fn().mockReturnThis(),
        fillRect: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        strokeRect: vi.fn().mockReturnThis(),
      })),
      text: vi.fn((x: number, y: number, text: string, style: Record<string, unknown>) => {
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
          setText: vi.fn(function (this: RenderedText, value: string) {
            this.text = value;
            return this;
          }),
          setBackgroundColor: vi.fn().mockReturnThis(),
          setColor: vi.fn().mockReturnThis(),
        } satisfies RenderedText;
        renderedTexts.push(rendered);
        return rendered;
      }),
    },
    commandContainer,
    dialog,
    displayedEnemy: state.enemy.pokemon,
    displayedHp: { player: state.player.currentHp, enemy: state.enemy.currentHp },
    pendingCombatMessages: [],
    playerHpBar: graphicsStub(),
    enemyHpBar: graphicsStub(),
    playerHpText: { setText: vi.fn() },
    playerStatusText: { setText: vi.fn() },
    enemyStatusText: { setText: vi.fn() },
    playerSprite: spriteStub(),
    enemySprite: spriteStub(),
    tweens: { add: vi.fn(), addCounter: vi.fn() },
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
    activatedPoiIds: new Set(),
    forcedReplacement: false,
    isPresentingCombatEvents: false,
    mode: 'events',
    party: options.party ?? new PokemonParty([player]),
    selectedCommand: 0,
    state,
    trainer,
  });

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
    expect(renderedTexts.map(({ text, x, y }) => ({ text, x, y }))).toEqual([
      { text: '▶ FIGHT', x: 18, y: 180 },
      { text: '  BALL x5', x: 166, y: 180 },
      { text: '  POKéMON', x: 18, y: 198 },
      // What the loadout packed, counted on the command itself.
      { text: '  ITEM x2', x: 166, y: 198 },
      // The escape command prices itself: Charmander outruns Bulbasaur 12 to 9.
      { text: '  RUN 57%', x: 18, y: 216 },
    ]);
    // Five commands are three rows, and the third row still has to be on a
    // 240px screen: the panel ends at 238.
    expect(renderedTexts.every(({ y }) => y >= 174 && y < 238)).toBe(true);
    expect(renderedTexts.every(({ style }) => !('fixedWidth' in style))).toBe(true);

    renderedTexts[0].handlers.pointerdown();

    // Two guidance lines are laid out first, then one row per known move.
    const [summaryLine, matchupLine, ...moveTexts] = renderedTexts.slice(5);
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

    expect(renderedTexts.slice(10).map(({ text }) => text)).toEqual([
      '▶ FIGHT',
      '  BALL x5',
      '  POKéMON',
      '  ITEM x2',
      '  RUN 57%',
    ]);
  });

  it('rewrites the guidance lines when the highlighted move changes', () => {
    const { scene, renderedTexts } = createBattleSceneHarness();

    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    renderedTexts[0].handlers.pointerdown();

    const [summaryLine, matchupLine, , , emberRow] = renderedTexts.slice(5);
    emberRow.handlers.pointerover();

    expect(summaryLine.text).toBe('FIRE · SPECIAL · POWER 40 · PP 25/25 · SAME-TYPE x1.5');
    expect(matchupLine.text).toBe('vs BULBASAUR: SUPER EFFECTIVE x2');
    expect(matchupLine.setColor).toHaveBeenLastCalledWith('#86efac');
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
    renderedTexts[4].handlers.pointerdown();

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

    expect(renderedTexts.map(({ text }) => text)).toEqual([
      '▶ FIGHT',
      '  FLEE -40s',
      '  POKéMON',
      '  ITEM x2',
    ]);
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
    renderedTexts[1].handlers.pointerdown();

    expect(runSession.manager.snapshot().elapsedMs).toBe(40_000);
    expect(runSession.manager.snapshot().hunterFlees).toBe(1);
    expect(dialog.shownMessages).toEqual([
      'You broke away from the RIVAL HUNTER!',
      'It lost your trail and holds off for 15s.',
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
    renderedTexts[1].handlers.pointerdown();
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
    renderedTexts[4].handlers.pointerdown();

    expect(dialog.shownMessages[0]).toBe("Couldn't get away from BULBASAUR!");
    expect((scene as unknown as { pendingBattleExit: boolean }).pendingBattleExit).toBe(false);
    expect((scene as unknown as { wildEscapeAttempts: number }).wildEscapeAttempts).toBe(1);
  });

  it('improves the odds it shows after every failure, so the exit is never closed off', () => {
    const { scene, renderedTexts } = createBattleSceneHarness();
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    renderedTexts[4].handlers.pointerdown();

    (scene as unknown as { mode: string }).mode = 'main';
    (scene as unknown as { showCommands(): void }).showCommands();

    expect(renderedTexts.at(-1)?.text).toBe('▶ RUN 77%');
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
      const row = renderedTexts.slice(from).filter(({ text }) => text.includes(match)).at(-1);
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
    clickLast(':L', beforeTargetList);
  };

  it('is offered in an authored trainer battle, which is the fight that cannot be left', () => {
    const { scene, renderedTexts } = createBattleSceneHarness({ authoredTrainer: true });

    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();

    expect(renderedTexts.map(({ text }) => text)).toEqual([
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
      renderedTexts.filter(({ text }) => text.includes('already at full HP')),
    ).toHaveLength(1);
  });

  it('says the pocket is empty rather than opening on nothing', () => {
    const { scene, renderedTexts, dialog } = createBattleSceneHarness({
      bag: new Bag({ 'poke-ball': 3 }),
    });

    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    const itemCommand = renderedTexts.find(({ text }) => text.includes('ITEM x'));

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
      scene: { manager: { keys: { world: {}, hub: {}, extraction: {} } }, start },
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
      scene: { manager: { keys: { world: {}, hub: {}, extraction: {} } }, start },
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
      scene: { manager: { keys: { world: {}, hub: {}, extraction: {} } }, start },
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
      scene: { manager: { keys: { world: {}, hub: {}, extraction: {} } }, start },
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
      scene: { manager: { keys: { world: {}, hub: {}, extraction: {} } }, start },
    });

    (scene as unknown as { resolveRunWipe(): void }).resolveRunWipe();

    expect(start.mock.calls[0][1]).toMatchObject({
      report: { durationMs: shortenedMs, clockLabel: '1:00 of 3:00' },
    });
  });
});
