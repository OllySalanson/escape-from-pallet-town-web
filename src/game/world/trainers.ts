import { Pokemon } from '../pokemon';
import { BUTTERFREE, PIDGEY, PIKACHU, SQUIRTLE } from '../pokemon/species';
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
    // The centre ford is the direct line from the allotments to the South Gate,
    // and Lee stands on it: the fast crossing has a toll, the west and east
    // fords do not, and they land you in different thirds of the south.
    mapId: 'pallet-town',
    position: { x: 15, y: 30 },
    facing: 'up',
    fixedPosition: true,
    introLines: ['HEY, RUNNER!', 'This is the quick ford. Quick costs.', 'Let me see your team!'],
    // Lee is the first authored trainer a new player meets. A Bulbasaur here
    // made the fight a starter lottery at level 7 - 9% for Bulbasaur against
    // 95% for Charmander - because Grass is resisted by the whole early roster.
    // A Squirtle gives every starter a real matchup to read.
    trainer: createTrainer(
      'grass-scout-lee',
      'SCOUT LEE',
      [new Pokemon(PIDGEY, 5), new Pokemon(SQUIRTLE, 6)],
      'Nice footwork. The route is yours... for now.',
    ),
  },
  {
    // The third cross-link is the short way between the two roads. Maya holds
    // it; the roads still go round her.
    mapId: 'route-1',
    position: { x: 16, y: 20 },
    facing: 'down',
    fixedPosition: true,
    introLines: ['NO ONE loots Route 1 for free!', 'My partner is ready!'],
    trainer: createTrainer(
      'route-raider-maya',
      'RAIDER MAYA',
      [new Pokemon(PIKACHU, 7), new Pokemon(PIDGEY, 7)],
      'You earned your way past me. Keep moving!',
    ),
  },
  {
    // Ivy stands in the middle of a three-trail hub, so she is passable: her
    // clearing has other ways out and being caught here is never forced.
    mapId: 'viridian-forest',
    position: { x: 18, y: 18 },
    facing: 'down',
    fixedPosition: true,
    introLines: ['THE FOREST KEEPS WHAT IT TAKES.', 'Turn back or face my bugs!'],
    trainer: createTrainer(
      'forest-warden-ivy',
      'WARDEN IVY',
      [new Pokemon(PIDGEY, 9), new Pokemon(BUTTERFREE, 10)],
      'The coastal trail is clear. Do not waste your second chance.',
    ),
  },
];
