import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: {
      Container: class {},
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
  text: string;
  readonly handlers: Record<string, () => void>;
  setInteractive: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  setText: ReturnType<typeof vi.fn>;
  setBackgroundColor: ReturnType<typeof vi.fn>;
  setColor: ReturnType<typeof vi.fn>;
}

function createBattleSceneHarness(): { scene: BattleScene; renderedTexts: RenderedText[] } {
  const renderedTexts: RenderedText[] = [];
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
      text: vi.fn((x: number, y: number, text: string) => {
        const rendered = {
          x,
          y,
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
    displayedEnemy: enemy,
    forcedReplacement: false,
    isPresentingCombatEvents: false,
    mode: 'events',
    party: new PokemonParty([player]),
    pokeBalls: 5,
    selectedCommand: 0,
    state,
    trainer: undefined,
  });

  return { scene, renderedTexts };
}

describe('BattleScene command presentation', () => {
  it('renders opening-dialogue completion as a readable Fight/Run menu and lets mouse select moves', () => {
    const { scene, renderedTexts } = createBattleSceneHarness();

    (scene as unknown as { onMessagesComplete(): void }).onMessagesComplete();

    expect(renderedTexts.map(({ text, x, y }) => ({ text, x, y }))).toEqual([
      { text: '▶ FIGHT', x: 18, y: 185 },
      { text: '  BALL x5', x: 166, y: 185 },
      { text: '  POKéMON', x: 18, y: 210 },
      { text: '  RUN', x: 166, y: 210 },
    ]);
    expect(renderedTexts.every(({ y }) => y >= 174 && y < 238)).toBe(true);

    renderedTexts[0].handlers.pointerdown();

    const moveTexts = renderedTexts.slice(4);
    expect(moveTexts).not.toHaveLength(0);
    expect(moveTexts.every(({ y }) => y >= 174 && y < 238)).toBe(true);
    expect(moveTexts[0].text).toMatch(/^▶ .+\n.+ \d+\/\d+$/);
  });
});
