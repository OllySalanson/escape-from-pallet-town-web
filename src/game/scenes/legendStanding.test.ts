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
import { getWorldMap } from '../worldMap';
import { gateKeys, gatesForMap } from '../world/gates';
import { LEGENDS, legendEntityId, type Legend } from '../world/legends';
import type { WorldEntity } from '../world/npcs';
import { WorldScene } from './WorldScene';

const STEPS: readonly [GridPosition, 'up' | 'down' | 'left' | 'right'][] = [
  [{ x: 1, y: 0 }, 'left'],
  [{ x: -1, y: 0 }, 'right'],
  [{ x: 0, y: 1 }, 'up'],
  [{ x: 0, y: -1 }, 'down'],
];

/**
 * The player standing on the one tile beside a legend, facing it, with every
 * door of its map open - the scene as `tryInteract` needs it, and no more.
 */
function besideLegend(legend: Legend, caught: readonly string[] = []) {
  const map = getWorldMap(legend.mapId, gateKeys(gatesForMap(legend.mapId)));
  const [offset, facing] = STEPS.find(
    ([step]) => map.collision[legend.position.y + step.y]?.[legend.position.x + step.x] === false,
  )!;
  const dialogBox = {
    shownMessages: [] as string[],
    showMessage: vi.fn((message: string) => dialogBox.shownMessages.push(message)),
    showMessages: vi.fn((messages: string[]) => dialogBox.shownMessages.push(...messages)),
  };
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    currentMap: map,
    currentTile: { x: legend.position.x + offset.x, y: legend.position.y + offset.y },
    facing,
    trainerEncounters: [],
    defeatedTrainerIds: new Set<string>(),
    defeatedBosses: gateKeys(gatesForMap(legend.mapId)),
    openedGates: [],
    completedContracts: [],
    caughtLegends: caught,
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
    runSession: { pokemonMet: [], manager: { phase: 'resolved' } },
    dialogBox,
    cameras: { main: { flash: vi.fn() } },
  });
  const internals = scene as unknown as {
    tryInteract(): void;
    wasMet(entity: WorldEntity): boolean;
    pendingWildBattle: unknown;
    runSession: { pokemonMet: string[] };
  };
  const entity = map.entities.find((candidate) => candidate.id === legendEntityId(legend))!;
  return { internals, dialogBox, entity };
}

describe('a legend standing in the world', () => {
  it.each(LEGENDS.map((legend) => [legend.speciesId, legend] as const))(
    '%s cries its FireRed line and promises a legend’s fight when walked up to',
    (_name, legend) => {
      const { internals, dialogBox, entity } = besideLegend(legend);

      internals.tryInteract();

      expect(dialogBox.shownMessages).toEqual([legend.cry]);
      expect(internals.pendingWildBattle).toEqual({
        speciesId: legend.speciesId,
        level: legend.level,
        legendary: true,
      });
      // Met once, it is gone for the rest of the raid, whatever the fight's ending.
      expect(internals.runSession.pokemonMet).toEqual([legendEntityId(legend)]);
      expect(internals.wasMet(entity)).toBe(true);
    },
  );

  it('does not stand at all on a save that has caught it', () => {
    const [articuno, zapdos] = LEGENDS;
    const { internals, entity } = besideLegend(articuno, [articuno.speciesId]);
    expect(internals.wasMet(entity)).toBe(true);

    const other = besideLegend(zapdos, [articuno.speciesId]);
    expect(other.internals.wasMet(other.entity)).toBe(false);
  });
});
