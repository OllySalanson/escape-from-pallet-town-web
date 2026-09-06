import { Pokemon } from '../pokemon';
import { BULBASAUR, BUTTERFREE, PIDGEY, PIKACHU } from '../pokemon/species';
import type { TrainerBattle } from '../pokemon/battle/battleEngine';
import type { Direction, GridPosition } from '../movement/gridMovement';
import type { WorldMapId } from '../worldMap';

export interface RunTrainerEncounter {
  readonly mapId: WorldMapId;
  readonly position: GridPosition;
  readonly facing: Direction;
  /** Authored checkpoints retain their readable position across seeded runs. */
  readonly fixedPosition?: boolean;
  readonly introLines: readonly string[];
  readonly trainer: TrainerBattle;
}

const createTrainer = (
  id: string,
  name: string,
  party: readonly Pokemon[],
  defeatText: string,
): TrainerBattle => ({ id, name, party, defeatText });

/**
 * These encounters are created for each WorldScene so defeated trainers and
 * battle-only Pokemon state never leak between raids.
 */
export const createRunTrainerEncounters = (): readonly RunTrainerEncounter[] => [
  {
    mapId: 'floodplain-relay',
    position: { x: 15, y: 16 },
    facing: 'down',
    fixedPosition: true,
    introLines: [
      'MAYA HOLDS THE ROAD.',
      'The reeds go around. The road goes through me.',
    ],
    trainer: createTrainer(
      'floodplain-checkpoint-maya',
      'RAIDER MAYA',
      [new Pokemon(PIKACHU, 7), new Pokemon(PIDGEY, 7)],
      'The checkpoint is open. Move before the hunter closes in.',
    ),
  },
  {
    mapId: 'pallet-town',
    position: { x: 14, y: 26 },
    facing: 'left',
    introLines: ['HEY, RUNNER!', 'The grass belongs to the bold!', 'Let me see your team!'],
    trainer: createTrainer(
      'grass-scout-lee',
      'SCOUT LEE',
      [new Pokemon(PIDGEY, 5), new Pokemon(BULBASAUR, 6)],
      'Nice footwork. The route is yours... for now.',
    ),
  },
  {
    mapId: 'route-1',
    position: { x: 13, y: 18 },
    facing: 'down',
    introLines: ['NO ONE loots Route 1 for free!', 'My partner is ready!'],
    trainer: createTrainer(
      'route-raider-maya',
      'RAIDER MAYA',
      [new Pokemon(PIKACHU, 7), new Pokemon(PIDGEY, 7)],
      'You earned your way past me. Keep moving!',
    ),
  },
  {
    mapId: 'viridian-forest',
    position: { x: 18, y: 18 },
    facing: 'down',
    introLines: ['THE FOREST KEEPS WHAT IT TAKES.', 'Turn back or face my bugs!'],
    trainer: createTrainer(
      'forest-warden-ivy',
      'WARDEN IVY',
      [new Pokemon(PIDGEY, 9), new Pokemon(BUTTERFREE, 10)],
      'The coastal trail is clear. Do not waste your second chance.',
    ),
  },
];
