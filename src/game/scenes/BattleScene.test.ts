import { describe, expect, it, vi } from 'vitest';

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
import { createBattleState } from '../pokemon/battle/battleEngine';
import { BULBASAUR } from '../pokemon/species';
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

function createBattleSceneHarness(): {
  scene: BattleScene;
  renderedTexts: RenderedText[];
  dialog: {
    setVisible: ReturnType<typeof vi.fn>;
    showMessage: ReturnType<typeof vi.fn>;
    advance: ReturnType<typeof vi.fn>;
    isCurrentMessageComplete: boolean;
    visibleText: string;
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
    }),
    advance: vi.fn(),
    isCurrentMessageComplete: false,
    visibleText: '',
  };
  const commandContainer = {
    add: vi.fn(),
    removeAll: vi.fn(),
    setVisible: vi.fn(),
  };
  const player = new Pokemon(CHARMANDER, 12);
  const enemy = new Pokemon(BULBASAUR, 10);
  const state = createBattleState(player, enemy);
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
    displayedEnemy: enemy,
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
    trainer: undefined,
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
      { text: '  RUN', x: 166, y: 210 },
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
      '  RUN',
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
