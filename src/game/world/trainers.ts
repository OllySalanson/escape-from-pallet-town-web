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
    // The price of the fast road. The shore road narrows to one tile between
    // thicket, and Maya looks straight up it - but from the tile *below* its
    // mouth, off the road, which runs east and west across in front of her. In
    // the narrows she would be a locked door; here the road is open and quick,
    // and what it costs is walking the four tiles she can see. The reeds leave
    // the road a row above the narrows and come back to it round underneath
    // her, never crossing her line, so they are a real way round. The tile at
    // 22,21 is one step outside her watch: the player reads her, and the price,
    // from a junction they can still turn round at.
    mapId: 'floodplain-relay',
    position: { x: 22, y: 26 },
    facing: 'up',
    fixedPosition: true,
    sightRange: 4,
    design: 'beauty',
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
  // The Floodplain's three doors, and who holds each. One fight opens two: the
  // door in front of the player, and a second somewhere they have already been,
  // so beating a boss is also finding out how the map was joined up all along.
  {
    // Holds the towered bridge off Market Isle, which is the only way east.
    // Beating him also lowers the chain on the orchard ford, so the way back
    // from the east bank is a wade to the square rather than the walk round.
    mapId: 'floodplain-relay',
    position: { x: 33, y: 33 },
    facing: 'down',
    fixedPosition: true,
    sightRange: 1,
    bossId: 'floodplain-toll-keeper',
    design: 'sailor',
    introLines: [
      'TOLLMAN BRIGGS HOLDS THE BRIDGE.',
      'Everything east of this river pays me first. So do you.',
    ],
    trainer: createTrainer(
      'floodplain-toll-keeper-briggs',
      'TOLLMAN BRIGGS',
      [new Pokemon(PIDGEY, 8), new Pokemon(SQUIRTLE, 9)],
      'Bridge is yours, and the ford with it. Mind the mill - the race is not mine to open.',
    ),
  },
  {
    // Holds the gatehouse that stands in the mill race, which is the keep's
    // moat. He has the sluice shut, so the river is up: beating him drops it,
    // and the old causeway between the keep and the Landing comes out of the
    // water. The tower the player has looked at since their first step turns
    // out to be next door.
    mapId: 'floodplain-relay',
    position: { x: 47, y: 22 },
    facing: 'down',
    fixedPosition: true,
    sightRange: 1,
    bossId: 'floodplain-sluice-keeper',
    design: 'hiker',
    introLines: [
      'SLUICE KEEPER DANE HOLDS THE GATEHOUSE.',
      'I keep the water high and the keep dry. Nobody walks in.',
    ],
    trainer: createTrainer(
      'floodplain-sluice-keeper-dane',
      'SLUICE KEEPER DANE',
      [new Pokemon(SQUIRTLE, 10), new Pokemon(JIGGLYPUFF, 10), new Pokemon(PIKACHU, 12)],
      'Gate is open. I am letting the sluice go too - watch the river by the Landing.',
    ),
  },
  {
    // Holds the gap in the orchard's back fence, with the vault behind it.
    // Beating her also unbars the causeway from the vault to the South Gate
    // road, so what is carried out of the vault has a short way home.
    mapId: 'floodplain-relay',
    position: { x: 53, y: 44 },
    facing: 'up',
    fixedPosition: true,
    sightRange: 1,
    bossId: 'floodplain-orchard-warden',
    design: 'straw-hat',
    introLines: [
      'WARDEN HOLT HOLDS THE ORCHARD FENCE.',
      'The rows are mine and so is what is buried past them.',
    ],
    trainer: createTrainer(
      'floodplain-orchard-warden-holt',
      'WARDEN HOLT',
      [new Pokemon(BUTTERFREE, 11), new Pokemon(PIDGEY, 11), new Pokemon(JIGGLYPUFF, 12)],
      'Go on through. The causeway out the far side is unbarred - it lands you on the gate road.',
    ),
  },
  {
    // The bridge is the direct line from the allotments to the South Gate, and
    // Lee stands in the gap in the fence at its foot: the fast crossing has a
    // toll, the fords either side of it do not, and the three land you in
    // different thirds of the south.
    mapId: 'pallet-town',
    position: { x: 13, y: 31 },
    facing: 'up',
    fixedPosition: true,
    introLines: ['HEY, RUNNER!', 'This is the quick way over. Quick costs.', 'Let me see your team!'],
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
    // The third way across the braid is a gap one tile wide below the middle
    // field's south door, and June stands in it: she holds the crossing and the
    // door together, and the roads still go round her. She was a second RAIDER MAYA with the
    // checkpoint's own Pikachu and Pidgey, and a player who beats Maya on the
    // Floodplain and meets her again one map over reads it as a bug. The lead
    // is a Jigglypuff because no other trainer fields one and, at level 7, it
    // fights with the same Tackle and Growl the Pikachu did - a different
    // fight to look at, at the price the route was already measured against.
    mapId: 'route-1',
    position: { x: 16, y: 19 },
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
    position: { x: 25, y: 7 },
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
