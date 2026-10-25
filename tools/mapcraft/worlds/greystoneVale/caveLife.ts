/**
 * Who and what is in the Greystone Caves (`greystoneCaves.ts`), floor by floor.
 *
 * The floors were drawn as rooms and passages and nothing else, so for a raid
 * underground every room looked like the last one, and by `density.mts` the
 * caves were the emptiest ground in the vale - a mean of fifty to seventy
 * steps from anything on every floor, a hundred at worst on B3F. FireRed's
 * Mt. Moon is the model for what fills a cave: hikers and miners who know the
 * way, the Pokemon that live there standing where you can meet them, a crater
 * where a stone fell, and chalk on the rock. Each floor's rooms are given one
 * thing each, put in the rooms measured to be furthest from anything and
 * chosen so the floor reads as a place:
 *
 * - 1F, under the quarry: the miners' way in - a quarryman, their lamp store,
 *   a Geodude in the spoil and the chalk marks that say which way is down.
 * - B1F, under the wood: THE FALLEN STAR, the crater in the north-east room
 *   with the Clefairy round it, a hiker in the sand and a camper who followed
 *   the bats.
 * - B2F, the first sealed floor: the Echo Hall's Zubat roost, a drip pool, and
 *   a hiker who says out loud what the floor is - two caves with rock between.
 * - B3F, the second: the Sleeper, an Onix asleep in the east sand, the old
 *   miner who named it, and a collier in the long south room.
 * - B4F, the sea floor: the smugglers' rope store, and the fisherman by the
 *   tide pool where the Shellder ride in.
 * - B5F, the deepest (`greystoneDeep`): a spelunker mapping it, the camp they
 *   pitched, the Golbat roost in the south room, and the scratch on the rock
 *   that tells you the only way on is up into the storm.
 *
 * Everything stands in the open middle of a room, never in a passage, because
 * a figure is a wall to a walk out (`mapFileChecks.ts`). The first five floors
 * ride in Tanglewood's file with the floors themselves, and B5F's things in
 * Stormcrown's, so nothing is carried twice.
 */
import type {
  MapFileLandmark,
  MapFilePerson,
  MapFilePokemon,
  MapFileSign,
  MapFileTrainer,
} from '../../../../src/game/world/mapFile';
import { DEEPEST_FLOOR } from './greystoneCaves';

export interface CaveLife {
  readonly people: MapFilePerson[];
  readonly pokemon: MapFilePokemon[];
  readonly signs: MapFileSign[];
  readonly landmarks: MapFileLandmark[];
  readonly trainers: MapFileTrainer[];
}

const F1 = 'greystone-caves-1f';
const B1 = 'greystone-caves-b1f';
const B2 = 'greystone-caves-b2f';
const B3 = 'greystone-caves-b3f';
const B4 = 'greystone-caves-b4f';
const B5 = DEEPEST_FLOOR;

/** The five floors Tanglewood carries: 1F to B4F. */
export function caveLife(): CaveLife {
  return {
    people: [
      {
        area: F1,
        x: 28,
        y: 7,
        name: 'Quarryman',
        look: 'hiker',
        facing: 'down',
        lines: [
          'We broke into this from the quarry above.',
          'Every ladder in here goes down. To cross the vale you go down and come up again.',
        ],
      },
      {
        area: B1,
        x: 10,
        y: 32,
        name: 'Camper Lin',
        look: 'camper',
        facing: 'right',
        lines: ['I followed the bats down from the wood.', 'Now every passage looks like the last one.'],
      },
      {
        area: B2,
        x: 46,
        y: 21,
        name: 'Lost Hiker',
        look: 'hiker',
        facing: 'left',
        lines: [
          'This floor is two caves with a wall of rock between.',
          'To get to the other side you go down a floor and back up. I have done it twice.',
        ],
      },
      {
        area: B2,
        x: 8,
        y: 30,
        name: 'Miner',
        look: 'heavy-man',
        facing: 'right',
        lines: ['Listen. That rushing is the sea, three floors down.'],
      },
      {
        area: B3,
        x: 11,
        y: 31,
        name: 'Old Miner',
        look: 'old-man',
        facing: 'right',
        lines: [
          'We called it the Sleeper.',
          'An Onix, in the east sand. It was lying there before the quarry was dug.',
        ],
      },
      {
        area: B4,
        x: 42,
        y: 33,
        name: 'Fisherman',
        look: 'fisherman',
        facing: 'up',
        lines: ['The tide comes up the passage from the strand.', 'The Shellder ride in on it and stay.'],
      },
    ],
    pokemon: [
      // The miners' spoil heap on 1F.
      { area: F1, x: 28, y: 28, species: 'geodude', level: 8 },
      // THE FALLEN STAR: Clefairy round the crater, one that will fight.
      { area: B1, x: 41, y: 11, species: 'clefairy', level: 9 },
      { area: B1, x: 45, y: 10, species: 'clefairy' },
      // The sand room in the middle of B1F, where the mushrooms grow.
      { area: B1, x: 28, y: 21, species: 'paras', level: 8 },
      // The Echo Hall's roost.
      { area: B2, x: 25, y: 7, species: 'zubat', level: 9 },
      { area: B2, x: 21, y: 6, species: 'zubat' },
      { area: B2, x: 28, y: 8, species: 'zubat' },
      { area: B2, x: 13, y: 36, species: 'sandshrew', level: 8 },
      { area: B2, x: 32, y: 36, species: 'diglett', level: 8 },
      // The Sleeper.
      { area: B3, x: 46, y: 23, species: 'onix', level: 12 },
      { area: B3, x: 48, y: 14, species: 'geodude', level: 9 },
      { area: B3, x: 29, y: 37, species: 'zubat', level: 10 },
      // The tide pool.
      { area: B4, x: 45, y: 30, species: 'shellder', level: 9 },
      { area: B4, x: 16, y: 28, species: 'zubat', level: 10 },
    ],
    signs: [
      {
        area: F1,
        x: 41,
        y: 24,
        lines: ['Chalked on the rock:', 'DOWN - THE WOOD, ONE FLOOR. DOWN - THE SEA, FOUR FLOORS.'],
      },
      {
        area: B4,
        x: 30,
        y: 10,
        lines: ['Scratched on the rock by the hole:', 'COLD WIND FROM BELOW. NOBODY CAME BACK UP THIS WAY.'],
      },
    ],
    landmarks: [
      { area: F1, x: 11, y: 28, name: 'Lamp Store', kind: 'kiln' },
      { area: B2, x: 29, y: 21, name: 'Drip Pool', kind: 'spring' },
      { area: B4, x: 14, y: 15, name: 'Rope Store', kind: 'jetty' },
    ],
    trainers: [
      {
        area: B1,
        x: 11,
        y: 10,
        name: 'Hiker Gorse',
        team: 'breaker',
        look: 'hiker',
        facing: 'right',
        sight: 3,
        lines: ['Mind the sand. It sinks under you.'],
      },
      {
        area: B2,
        x: 12,
        y: 8,
        name: 'Collier Wyn',
        team: 'collier',
        look: 'bald-man',
        facing: 'down',
        sight: 2,
        lines: ['There was coal down here once. Now there is only me.'],
      },
      {
        area: B3,
        x: 48,
        y: 34,
        name: 'Collier Dunn',
        team: 'collier',
        look: 'bald-man',
        facing: 'left',
        sight: 3,
        lines: ['Do not wake the Sleeper. I have to work next to it.'],
      },
      {
        area: B4,
        x: 35,
        y: 17,
        name: 'Smuggler Gill',
        team: 'netter',
        look: 'sailor',
        facing: 'down',
        sight: 3,
        lines: ['That rope is spoken for.'],
      },
    ],
  };
}

/** B5F's, which Stormcrown carries with the floor. */
export function deepLife(): CaveLife {
  return {
    people: [
      {
        area: B5,
        x: 50,
        y: 38,
        name: 'Spelunker',
        look: 'scientist',
        facing: 'left',
        lines: ['I am mapping the deepest floor.', 'Up the far passage there is daylight, and a storm.'],
      },
    ],
    pokemon: [
      { area: B5, x: 25, y: 33, species: 'golbat', level: 14 },
      { area: B5, x: 22, y: 31, species: 'zubat' },
      { area: B5, x: 14, y: 44, species: 'geodude', level: 11 },
      { area: B5, x: 38, y: 41, species: 'zubat', level: 12 },
    ],
    signs: [
      {
        area: B5,
        x: 33,
        y: 9,
        lines: ['Scratched deep in the rock:', 'NO WAY BACK BUT UP.'],
      },
    ],
    landmarks: [{ area: B5, x: 51, y: 15, name: 'Explorers Camp', kind: 'shed' }],
    trainers: [
      {
        area: B5,
        x: 16,
        y: 20,
        name: 'Hiker Rudd',
        team: 'breaker',
        look: 'hiker',
        facing: 'right',
        sight: 3,
        lines: ['Nobody comes this deep for the view.'],
      },
    ],
  };
}
