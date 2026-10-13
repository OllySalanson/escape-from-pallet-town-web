import { describe, expect, it } from 'vitest';
import { worldMapName, type BuiltInMapId } from '../worldMap';
import { WORLD_ENTITIES } from './npcs';
import { createRunTrainerEncounters } from './trainers';

/**
 * A line said on a map may not ask whether you are on your way to that map:
 * LASS ADA stands on Viridian City's own South Terraces and asked everybody
 * who walked into her watch "Going up to Viridian?" - including a player who
 * dropped in at its Pokémon Center and was walking down out of it (playtest 6,
 * B9). The map's own name, or its first word on its own ("Viridian", never
 * "Viridian Forest"), after "to" is a destination you are already standing in.
 */
function headingFor(mapId: BuiltInMapId): RegExp {
  const name = worldMapName(mapId);
  const first = name.split(' ')[0];
  return new RegExp(`\\bto (?:${name}|${first}(?! [A-Z]))\\b`, 'i');
}

describe('nobody asks if you are going to the place you are in', () => {
  it('in what a trainer says, before the fight and after it', () => {
    const wrong = createRunTrainerEncounters().flatMap((encounter) =>
      [...encounter.introLines, encounter.trainer.defeatText ?? '']
        .filter((line) => headingFor(encounter.mapId as BuiltInMapId).test(line))
        .map((line) => `${encounter.trainer.name} on ${encounter.mapId}: ${line}`),
    );
    expect(wrong).toEqual([]);
  });

  it('in what townsfolk and signs say', () => {
    const wrong = WORLD_ENTITIES.flatMap((entity) =>
      (entity.dialogLines ?? [])
        .filter((line) => headingFor(entity.mapId as BuiltInMapId).test(line))
        .map((line) => `${entity.id} on ${entity.mapId}: ${line}`),
    );
    expect(wrong).toEqual([]);
  });
});
