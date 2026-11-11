import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

import { Bag } from '../items';
import type { GridPosition } from '../movement/gridMovement';
import type { OpenSecret } from '../run/runGeneration';
import { getWorldMap } from '../worldMap';
import { gateKeys, gatesForMap } from '../world/gates';
import { FIRST_HUNTER_RIVAL } from '../world/hunters';
import type { WorldEntity } from '../world/npcs';
import { secretById, type RaidConditions } from '../world/secrets';
import { MISTY_BOSS_ID } from '../world/valeQuarters';
import { MAX_PENDING_RECOVERY_MS } from '../hub/recovery';
import { WorldScene } from './WorldScene';

/**
 * The second wave of the vale's secrets as the scene meets them
 * (`world/secrets.ts`): the sleeper in the pines, who lies there every raid and
 * wakes only for the flute, and the drowned bell's rope, which calls its
 * Pokemon up only at low water. The scene as `tryInteract` needs it, and no
 * more, as `legendStanding.test.ts` stands a legend.
 */

const VALE = 'greystone-vale';
const STEPS: readonly [GridPosition, 'up' | 'down' | 'left' | 'right'][] = [
  [{ x: 0, y: -1 }, 'down'],
  [{ x: 1, y: 0 }, 'left'],
  [{ x: -1, y: 0 }, 'right'],
  [{ x: 0, y: 1 }, 'up'],
];

const CONDITIONS: RaidConditions = {
  hour: 'day',
  weekday: 3,
  month: 10,
  leadTypes: ['Grass'],
  fieldMoves: [],
  carried: [],
  badges: [],
  chartWhole: false,
};

interface Plan {
  readonly conditions: RaidConditions;
  readonly secrets: readonly OpenSecret[];
  readonly sleeping?: readonly string[];
  /** What the Pokemon Center took off this raid's clock (`RunPlan.clockShortfallMs`). */
  readonly clockShortfallMs?: number;
}

/** The player beside the entity tagged with a secret, facing it, every door of the vale open. */
function beside(secretId: string, kind: 'pokemon' | 'sign', plan: Plan, elapsedMs = 0) {
  const map = getWorldMap(VALE, gateKeys(gatesForMap(VALE)));
  const entity = map.entities.find(
    (candidate) => candidate.secret === secretId && (kind === 'pokemon') === (candidate.pokemon !== undefined),
  )!;
  const [offset, facing] = STEPS.find(
    ([step]) => map.collision[entity.position.y + step.y]?.[entity.position.x + step.x] === false,
  )!;
  const dialogBox = {
    shownMessages: [] as string[],
    showMessage: vi.fn((message: string) => dialogBox.shownMessages.push(message)),
    showMessages: vi.fn((messages: string[]) => dialogBox.shownMessages.push(...messages)),
  };
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    currentMap: map,
    currentTile: { x: entity.position.x + offset.x, y: entity.position.y + offset.y },
    facing,
    trainerEncounters: [],
    defeatedTrainerIds: new Set<string>(),
    defeatedBosses: gateKeys(gatesForMap(VALE)),
    openedGates: [],
    completedContracts: [],
    caughtLegends: [],
    collectedLootIds: new Set<string>(),
    activatedPoiIds: new Set<string>(),
    npcSprites: new Map(),
    npcAppearances: new Map(),
    idleFigures: [],
    lootSprites: new Map(),
    poiSprites: new Map(),
    poiLabels: new Map(),
    bag: new Bag(),
    party: { pokemon: [] },
    runSession: {
      pokemonMet: [],
      plan: { loot: {}, hunter: { rivalId: FIRST_HUNTER_RIVAL }, ...plan },
      manager: { phase: 'resolved', snapshot: () => ({ elapsedMs }) },
    },
    dialogBox,
    cameras: { main: { flash: vi.fn() } },
  });
  const internals = scene as unknown as {
    tryInteract(): void;
    wasMet(entity: WorldEntity): boolean;
    pendingWildBattle: unknown;
    runSession: { pokemonMet: string[] };
  };
  return { internals, dialogBox, entity };
}

describe('THE SLEEPER IN THE PINES', () => {
  const sleeper = secretById('the-sleeper-in-the-pines')!;
  const snorlax = { kind: 'meet', speciesId: 'snorlax', level: 25 } as const;

  it('lies across his glade without the flute, and only snores when spoken to', () => {
    const { internals, dialogBox, entity } = beside(sleeper.id, 'pokemon', {
      conditions: CONDITIONS,
      secrets: [],
      sleeping: [sleeper.id],
    });
    expect(internals.wasMet(entity)).toBe(false);

    internals.tryInteract();

    expect(dialogBox.shownMessages).toEqual(sleeper.shutLines);
    expect(internals.pendingWildBattle).toBeUndefined();
    expect(internals.runSession.pokemonMet).toEqual([]);
  });

  it('wakes to the flute in the pack, grumpy, and fights once', () => {
    const { internals, dialogBox, entity } = beside(sleeper.id, 'pokemon', {
      conditions: { ...CONDITIONS, carried: ['poke-flute'] },
      secrets: [{ id: sleeper.id, reward: snorlax }],
    });

    internals.tryInteract();

    expect(dialogBox.shownMessages[0]).toBe(sleeper.foundLine);
    expect(internals.pendingWildBattle).toEqual({ speciesId: 'snorlax', level: 25 });
    expect(internals.wasMet(entity)).toBe(true);
  });

  it('is not there at all once he has been had', () => {
    const { internals, entity } = beside(sleeper.id, 'pokemon', { conditions: CONDITIONS, secrets: [] });
    expect(internals.wasMet(entity)).toBe(true);
  });
});

describe('THE DROWNED BELL', () => {
  const bell = secretById('the-drowned-bell')!;
  const kabutops = { kind: 'meet', speciesId: 'kabutops', level: 28 } as const;
  const open: Plan = {
    conditions: { ...CONDITIONS, badges: [MISTY_BOSS_ID] },
    secrets: [{ id: bell.id, reward: kabutops }],
  };

  it('reads as its clue before low water', () => {
    const { internals, dialogBox, entity } = beside(bell.id, 'sign', open, 30_000);
    internals.tryInteract();
    expect(dialogBox.shownMessages).toEqual(entity.dialogLines);
    expect(internals.pendingWildBattle).toBeUndefined();
  });

  it('tolls at low water and calls up what lives in the belfry, once a raid', () => {
    const { internals, dialogBox } = beside(bell.id, 'sign', open, 90_000);

    internals.tryInteract();

    expect(dialogBox.shownMessages).toEqual([bell.foundLine]);
    expect(internals.pendingWildBattle).toEqual({ speciesId: 'kabutops', level: 28 });
    expect(internals.runSession.pokemonMet).toEqual([`secret:${bell.id}`]);
  });

  it('reads as its clue at low water without the badge, and after the tide has turned', () => {
    for (const [plan, elapsedMs] of [
      [{ conditions: CONDITIONS, secrets: [] }, 90_000],
      [open, 125_000],
    ] as const) {
      const { internals, entity, dialogBox } = beside(bell.id, 'sign', plan, elapsedMs);
      internals.tryInteract();
      expect(dialogBox.shownMessages).toEqual(entity.dialogLines);
      expect(internals.pendingWildBattle).toBeUndefined();
    }
  });

  it('keeps the time its clue gives after a heal at the Pokemon Center: a minute in, until two', () => {
    // The bug hunt of 10 Nov: the bell was read against the tide, which runs
    // ahead by what the Center took off the raid, so with 100 seconds owed it
    // rang only in the raid's first twenty, and with two minutes or more not
    // at all. The rope's own words are the raid's time gone by.
    for (const clockShortfallMs of [100_000, MAX_PENDING_RECOVERY_MS]) {
      const healed: Plan = { ...open, clockShortfallMs };
      for (const [elapsedMs, tolls] of [
        [10_000, false],
        [71_000, true],
        [119_000, true],
        [121_000, false],
      ] as const) {
        const { internals, dialogBox, entity } = beside(bell.id, 'sign', healed, elapsedMs);
        internals.tryInteract();
        expect(dialogBox.shownMessages, `${clockShortfallMs / 1_000}s owed, ${elapsedMs / 1_000}s in`).toEqual(
          tolls ? [bell.foundLine] : entity.dialogLines,
        );
        expect(internals.pendingWildBattle !== undefined).toBe(tolls);
      }
    }
  });
});
