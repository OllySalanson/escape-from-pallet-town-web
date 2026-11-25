import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { placedTrainerIds, type MapFileTrainer } from './mapFile';

/**
 * A save keeps trainer ids for good (`raidProgress.trainersPaid`), so an id is
 * who a trainer is, never where they fall in the file's list.
 */
describe('a placed trainer id', () => {
  const vale = JSON.parse(readFileSync('src/game/world/maps/greystoneVale.json', 'utf8')) as {
    id: string;
    trainers: MapFileTrainer[];
  };
  const idOf = (list: readonly MapFileTrainer[]): Map<MapFileTrainer, string> => {
    const ids = placedTrainerIds('greystone-vale', list);
    return new Map(list.map((trainer, index) => [trainer, ids[index]]));
  };

  it('is different for every trainer the vale places', () => {
    const ids = placedTrainerIds('greystone-vale', vale.trainers);
    expect(new Set(ids).size).toBe(vale.trainers.length);
  });

  it('does not move when trainers are added, removed or reordered around it', () => {
    const before = idOf(vale.trainers);
    const reordered = [...vale.trainers].reverse();
    const added: MapFileTrainer = { ...vale.trainers[0], name: 'Newcomer Ada', x: 1, y: 1 };
    const after = idOf([added, ...reordered.slice(1)]);
    for (const trainer of reordered.slice(1)) {
      const twin = vale.trainers.filter((each) => each.name === trainer.name && each.area === trainer.area);
      // Two of one name in one room are told apart by their order between themselves alone.
      if (twin.length === 1) {
        expect(after.get(trainer)).toBe(before.get(trainer));
      }
    }
  });

  it('reads as the map, the room and the name', () => {
    expect(placedTrainerIds('greystone-vale', [{ name: 'Scout Tam' }, { name: 'Grunt', area: 'bunker-b1f' }, { name: 'Grunt', area: 'bunker-b1f' }])).toEqual([
      'greystone-vale/trainer-scout-tam',
      'greystone-vale/trainer-bunker-b1f-grunt',
      'greystone-vale/trainer-bunker-b1f-grunt-2',
    ]);
  });
});
