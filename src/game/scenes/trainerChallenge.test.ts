import { beforeEach, describe, expect, it, vi } from 'vitest';

interface StubKey {
  justDown: boolean;
  isDown: boolean;
}

vi.mock('phaser', () => {
  class Container {
    public readonly children: unknown[] = [];
    public x: number;
    public y: number;
    public constructor(_scene: unknown, x: number, y: number) {
      this.x = x;
      this.y = y;
    }
    public add(child: unknown): this {
      this.children.push(child);
      return this;
    }
    public setDepth(): this {
      return this;
    }
    public setScrollFactor(): this {
      return this;
    }
    public destroy(): void {
      this.children.length = 0;
    }
  }

  return {
    default: {
      Scene: class {},
      GameObjects: { Container },
      Input: {
        Keyboard: {
          JustDown: (key: StubKey) => key?.justDown === true,
        },
      },
    },
  };
});

import { Bag } from '../items';
import { getWorldMap } from '../worldMap';
import { createRunTrainerEncounters } from '../world/trainers';
import {
  BACK_AWAY_OPTION,
  CHALLENGE_OPTION,
  TRAINER_COMMITMENT_LINE,
  trainerDeclinedMessage,
} from '../world/trainerEngagement';
import { WorldScene } from './WorldScene';

interface RenderedText {
  text: string;
  readonly handlers: Record<string, () => void>;
}

/** Every key the prompt reads, all up until a test presses one. */
const stubKeys = () => {
  const key = (): StubKey => ({ justDown: false, isDown: false });
  return {
    up: key(),
    down: key(),
    left: key(),
    right: key(),
    w: key(),
    a: key(),
    s: key(),
    d: key(),
    party: key(),
    bag: key(),
    save: key(),
    objectives: key(),
    interact: [key()],
  };
};

/**
 * The player standing one tile south of the Floodplain checkpoint and facing
 * her - the exact position from which the morning playtest walked into an
 * unescapable fight without being told it was one.
 */
function facingMaya() {
  const renderedTexts: RenderedText[] = [];
  const dialogBox = {
    shownMessages: [] as string[],
    visible: false,
    showMessage: vi.fn((message: string) => dialogBox.shownMessages.push(message)),
    showMessages: vi.fn((messages: string[]) => dialogBox.shownMessages.push(...messages)),
  };
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  const controls = stubKeys();
  Object.assign(scene as object, {
    currentMap: getWorldMap('floodplain-relay'),
    currentTile: { x: 15, y: 18 },
    facing: 'up',
    trainerEncounters: createRunTrainerEncounters(),
    defeatedTrainerIds: new Set<string>(),
    collectedLootIds: new Set<string>(),
    activatedPoiIds: new Set<string>(),
    npcSprites: new Map(),
    lootSprites: new Map(),
    poiSprites: new Map(),
    poiLabels: new Map(),
    bag: new Bag(),
    runSession: undefined,
    controls,
    dialogBox,
    scale: { width: 320, height: 240 },
    cameras: { main: { flash: vi.fn() } },
    add: {
      existing: vi.fn(),
      graphics: vi.fn(() => ({
        clear: vi.fn().mockReturnThis(),
        fillStyle: vi.fn().mockReturnThis(),
        fillRect: vi.fn().mockReturnThis(),
      })),
      text: vi.fn((_x: number, _y: number, text: string) => {
        const rendered = {
          text,
          handlers: {} as Record<string, () => void>,
          setInteractive: vi.fn(function (this: RenderedText) {
            return this;
          }),
          on: vi.fn(function (this: RenderedText, event: string, handler: () => void) {
            this.handlers[event] = handler;
            return this;
          }),
          setText: vi.fn(function (this: RenderedText, value: string) {
            this.text = value;
            return this;
          }),
          setColor: vi.fn().mockReturnThis(),
        };
        renderedTexts.push(rendered);
        return rendered;
      }),
    },
  });

  const internals = scene as unknown as {
    tryInteract(): void;
    handleTrainerPromptInput(): void;
    trainerPrompt: { selected: number } | undefined;
    pendingTrainerBattle: { trainer: { name: string } } | undefined;
  };
  return { scene, internals, controls, dialogBox, renderedTexts };
}

const promptText = (renderedTexts: RenderedText[]): string =>
  renderedTexts.map(({ text }) => text).join('\n');

describe('speaking to an authored trainer', () => {
  let harness: ReturnType<typeof facingMaya>;

  beforeEach(() => {
    harness = facingMaya();
  });

  it('asks before it commits, and says what the commitment is', () => {
    harness.internals.tryInteract();

    expect(harness.internals.trainerPrompt).toBeDefined();
    // The fight has not started: the intro lines are the trainer's, and they
    // only run once the player has said yes.
    expect(harness.internals.pendingTrainerBattle).toBeUndefined();
    expect(harness.dialogBox.showMessages).not.toHaveBeenCalled();
    expect(promptText(harness.renderedTexts)).toContain('RAIDER MAYA');
    expect(promptText(harness.renderedTexts)).toContain(TRAINER_COMMITMENT_LINE);
    expect(promptText(harness.renderedTexts)).toContain(CHALLENGE_OPTION);
    expect(promptText(harness.renderedTexts)).toContain(BACK_AWAY_OPTION);
  });

  it('starts on the option that costs nothing, so the key that opened it cannot start the fight', () => {
    harness.internals.tryInteract();

    // Interact opened the prompt; interact again is the same press a player
    // makes to advance dialogue, and it must not be a challenge.
    harness.controls.interact[0].justDown = true;
    harness.internals.handleTrainerPromptInput();

    expect(harness.internals.pendingTrainerBattle).toBeUndefined();
    expect(harness.internals.trainerPrompt).toBeUndefined();
    expect(harness.dialogBox.shownMessages).toEqual([trainerDeclinedMessage('RAIDER MAYA')]);
  });

  it('starts the fight only after the player moves to CHALLENGE and confirms', () => {
    harness.internals.tryInteract();

    harness.controls.up.justDown = true;
    harness.internals.handleTrainerPromptInput();
    harness.controls.up.justDown = false;
    harness.controls.interact[0].justDown = true;
    harness.internals.handleTrainerPromptInput();

    expect(harness.internals.trainerPrompt).toBeUndefined();
    expect(harness.internals.pendingTrainerBattle?.trainer.name).toBe('RAIDER MAYA');
    // Only now do her lines play, and the battle follows them.
    expect(harness.dialogBox.showMessages).toHaveBeenCalledWith([
      'MAYA HAS THE ROAD IN SIGHT.',
      'The reeds go around. The road goes through me.',
    ]);
  });

  it('can be declined and asked again, so backing off is not a lost encounter', () => {
    harness.internals.tryInteract();
    harness.controls.interact[0].justDown = true;
    harness.internals.handleTrainerPromptInput();

    harness.internals.tryInteract();

    expect(harness.internals.trainerPrompt).toBeDefined();
    expect(harness.internals.pendingTrainerBattle).toBeUndefined();
  });
});
