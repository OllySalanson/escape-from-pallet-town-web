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
  readonly runSession?: ReturnType<typeof createActiveRunSession>;
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
  const player = new Pokemon(CHARMANDER, 12);
  const enemy = new Pokemon(BULBASAUR, 10);
  const trainer = options.hunterBattle
    ? {
        id: 'rival-hunter',
        name: 'RIVAL HUNTER',
        party: [new Pokemon(PIDGEY, 6)],
        defeatText: 'You slipped through my fingers... this time.',
      }
    : undefined;
  const state = trainer
    ? createTrainerBattleState(player, trainer)
    : createBattleState(player, enemy);
  const scene = Object.create(BattleScene.prototype) as BattleScene;

  Object.assign(scene as object, {
    add: {
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
    wildEscapeAttempts: 0,
    pendingBattleExit: false,
    defeatedTrainerIds: new Set(),
    collectedLootIds: new Set(),
    activatedPoiIds: new Set(),
    forcedReplacement: false,
    isPresentingCombatEvents: false,
    mode: 'events',
    party: new PokemonParty([player]),
    pokeBalls: 5,
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
      { text: '▶ FIGHT', x: 18, y: 185 },
      { text: '  BALL x5', x: 166, y: 185 },
      { text: '  POKéMON', x: 18, y: 210 },
      // The escape command prices itself: Charmander outruns Bulbasaur 12 to 9.
      { text: '  RUN 57%', x: 166, y: 210 },
    ]);
    expect(renderedTexts.every(({ y }) => y >= 174 && y < 238)).toBe(true);
    expect(renderedTexts.every(({ style }) => !('fixedWidth' in style))).toBe(true);

    renderedTexts[0].handlers.pointerdown();

    // Two guidance lines are laid out first, then one row per known move.
    const [summaryLine, matchupLine, ...moveTexts] = renderedTexts.slice(4);
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

    expect(renderedTexts.slice(9).map(({ text }) => text)).toEqual([
      '▶ FIGHT',
      '  BALL x5',
      '  POKéMON',
      '  RUN 57%',
    ]);
  });

  it('rewrites the guidance lines when the highlighted move changes', () => {
    const { scene, renderedTexts } = createBattleSceneHarness();

    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    renderedTexts[0].handlers.pointerdown();

    const [summaryLine, matchupLine, , , emberRow] = renderedTexts.slice(4);
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
    renderedTexts[3].handlers.pointerdown();

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

    expect(renderedTexts.map(({ text }) => text)).toEqual(['▶ FIGHT', '  FLEE -40s', '  POKéMON']);
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
    renderedTexts[3].handlers.pointerdown();

    expect(dialog.shownMessages[0]).toBe("Couldn't get away from BULBASAUR!");
    expect((scene as unknown as { pendingBattleExit: boolean }).pendingBattleExit).toBe(false);
    expect((scene as unknown as { wildEscapeAttempts: number }).wildEscapeAttempts).toBe(1);
  });

  it('improves the odds it shows after every failure, so the exit is never closed off', () => {
    const { scene, renderedTexts } = createBattleSceneHarness();
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();
    renderedTexts[3].handlers.pointerdown();

    (scene as unknown as { mode: string }).mode = 'main';
    (scene as unknown as { showCommands(): void }).showCommands();

    expect(renderedTexts.at(-1)?.text).toBe('▶ RUN 77%');
  });
});

describe('a lost raid resolved inside a battle', () => {
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
