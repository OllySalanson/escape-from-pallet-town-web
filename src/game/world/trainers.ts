import { Pokemon } from '../pokemon';
import { BUTTERFREE, JIGGLYPUFF, PIDGEY, PIKACHU, SQUIRTLE } from '../pokemon/species';
import type { TrainerBattle } from '../pokemon/battle/battleEngine';
import type { Direction, GridPosition } from '../movement/gridMovement';
import type { CastCharacterDesignId } from './characterDesigns';
import type { TrainerWatch } from './trainerSight';
import type { WorldMapId } from '../worldMap';

export interface RunTrainerEncounter extends TrainerWatch {
  readonly mapId: WorldMapId;
  readonly position: GridPosition;
  readonly facing: Direction;
  /** Authored checkpoints retain their readable position across seeded runs. */
  readonly fixedPosition?: boolean;
  /**
   * How far ahead this trainer challenges on sight. Omitted is the old
   * behaviour - the player has to walk up and speak to them - which is still
   * what the three ordinary trainers outside the Floodplain route do. See
   * `trainerSight.ts` for why a watch and a body are not the same thing.
   */
  readonly sightRange?: number;
  /**
   * The character design this trainer is drawn from. Omitted is the shared
   * sheet under the amber trainer tint - see `characterPresentation.ts`.
   */
  readonly design?: CastCharacterDesignId;
  /**
   * Set on a boss: the trainer holding a gate shut. Beating one is recorded for
   * good in `raidProgress.defeatedBosses` under this id, every `MapGate` naming
   * it opens in that same raid, and the boss is not there on any later one - so
   * unlike every other trainer, a boss may stand in the lane it guards. The id
   * is what the save keeps, so it must never be reused for a different door.
   */
  readonly bossId?: string;
  readonly introLines: readonly string[];
  readonly trainer: TrainerBattle;
}

/** The trainers who hold gates, in authored order. */
export const bossEncounters = (
  trainers: readonly RunTrainerEncounter[],
): readonly (RunTrainerEncounter & { readonly bossId: string })[] =>
  trainers.filter(
    (trainer): trainer is RunTrainerEncounter & { readonly bossId: string } =>
      trainer.bossId !== undefined,
  );

/**
 * A raid's trainers without the bosses already beaten. A boss is beaten once,
 * for good: what is left where they stood is the open gate, which the map
 * captions as open.
 */
export const withoutDefeatedBosses = (
  trainers: readonly RunTrainerEncounter[],
  defeatedBosses: readonly string[],
): readonly RunTrainerEncounter[] =>
  trainers.filter(
    (trainer) => trainer.bossId === undefined || !defeatedBosses.includes(trainer.bossId),
  );

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
    // The price of the fast road. Maya stands on the jetty off the checkpoint
    // corner rather than in the lane, so the road is open and quick, and what it
    // costs is the three tiles of it she is watching. The vault turn at 15,13
    // sits one step outside that watch, so the player reads her, and the price,
    // from a junction they can still turn round at.
    mapId: 'floodplain-relay',
    position: { x: 15, y: 17 },
    facing: 'up',
    fixedPosition: true,
    sightRange: 3,
    introLines: [
      'MAYA HAS THE ROAD IN SIGHT.',
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
    // The third cross-link is the short way between the two roads. June holds
    // it; the roads still go round her. She was a second RAIDER MAYA with the
    // checkpoint's own Pikachu and Pidgey, and a player who beats Maya on the
    // Floodplain and meets her again one map over reads it as a bug. The lead
    // is a Jigglypuff because no other trainer fields one and, at level 7, it
    // fights with the same Tackle and Growl the Pikachu did - a different
    // fight to look at, at the price the route was already measured against.
    mapId: 'route-1',
    position: { x: 16, y: 20 },
    facing: 'down',
    fixedPosition: true,
    design: 'lass',
    introLines: ['NO ONE loots Route 1 for free!', 'My partner is ready!'],
    trainer: createTrainer(
      'route-lass-june',
      'LASS JUNE',
      [new Pokemon(JIGGLYPUFF, 7), new Pokemon(PIDGEY, 7)],
      'You earned your way past me. Keep moving!',
    ),
  },
  {
    // The first boss. Wren stands in the spur off the east road with the
    // Overlook Gate at their back, and watches only the spur tile in front of
    // them: the road itself stays free, and stepping off it towards the gate is
    // the decision to fight. The party is longer and higher than anything else
    // on the route, which is what makes the door worth coming back for.
    mapId: 'route-1',
    position: { x: 25, y: 5 },
    facing: 'left',
    fixedPosition: true,
    sightRange: 1,
    bossId: 'overlook-warden',
    introLines: [
      'WARDEN WREN HOLDS THE OVERLOOK GATE.',
      'Nobody has seen the far side of this fence. Earn it.',
    ],
    trainer: createTrainer(
      'overlook-warden-wren',
      'WARDEN WREN',
      [new Pokemon(PIDGEY, 9), new Pokemon(JIGGLYPUFF, 9), new Pokemon(PIKACHU, 11)],
      'The gate is yours. It stays open - I am done holding it.',
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
