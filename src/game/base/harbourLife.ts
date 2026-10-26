import type { Direction, GridPosition } from '../movement/gridMovement';
import type { CastCharacterDesignId } from '../world/characterDesigns';
import type { NpcIdle } from '../world/npcIdle';
import { HARBOUR_POKEMON_ART } from './generated/harbourPokemonArt';
import { anglerLines } from './harbourFishing';
import { spyglassLines } from './spyglass';

/**
 * Who lives in THE HARBOUR: the people who work it and the Pokemon about it.
 *
 * The keepers are indoors behind their counters (`rooms.ts`), so until this
 * the only figures outside were the player, their partner and the Day-Care
 * man - a harbour with nobody in it reads as a mock-up however good the
 * buildings are. Everybody here has a job that explains where they stand: the
 * sailor at the Seagallop's jetty, the Gym Guide at the Raid Arena's door as
 * every Gym in Kanto has one, the captain on the long pier, the dock worker
 * and his Machop at the warehouses, the angler on the cove's jetty, the
 * policeman and his Growlithe on the yard. And the Pokemon are the ones a
 * FireRed port has - a Slowpoke staring at the sea, Pidgey after crumbs on the green, a
 * Meowth by the crates, Krabby and Psyduck on the beach, and Lapras, Tentacool
 * and Magikarp out in the water.
 *
 * Every one of them keeps a beat (`world/npcIdle.ts`): a few tiles they drift
 * between and the ways they look. A figure on land blocks its tile, and
 * `harbourLife.test.ts` holds the map with **every** beat tile solid at once -
 * stricter than any moment the game can be in - to the rules the yard already
 * keeps: every door and every walkable tile still reached, and no walk to a
 * keeper one step longer. A swimmer drifts over water, which is solid anyway,
 * so it can never be in anybody's way.
 *
 * Nobody here is a trainer or a shop: the harbour has no clock and no fights,
 * and a townsperson's job is to make it a place and to say something true
 * about it.
 */

export type HarbourSpecies = keyof typeof HARBOUR_POKEMON_ART;

interface HarbourFigureBase {
  readonly id: string;
  readonly position: GridPosition;
  readonly facing: Direction;
  readonly idle: NpcIdle;
}

export interface HarbourPerson extends HarbourFigureBase {
  readonly kind: 'person';
  readonly design: CastCharacterDesignId;
  /** What the hint line calls them while they are faced: their job. */
  readonly name: string;
  /** What they say when spoken to, a box at a time. */
  readonly lines: readonly string[];
}

export interface HarbourPokemon extends HarbourFigureBase {
  readonly kind: 'pokemon';
  readonly species: HarbourSpecies;
  /** The name it is called by, as FireRed prints one. */
  readonly name: string;
  /** What spoken to says, after its cry. */
  readonly lines: readonly string[];
  /** Out in the water: drawn sunk to the waterline and drifting over sea. */
  readonly swims?: true;
}

export type HarbourFigure = HarbourPerson | HarbourPokemon;

const at = (x: number, y: number): GridPosition => ({ x, y });

export const HARBOUR_PEOPLE: readonly HarbourPerson[] = [
  {
    id: 'seagallop-sailor',
    kind: 'person',
    name: 'SAILOR',
    design: 'sailor',
    position: at(10, 19),
    facing: 'down',
    idle: { roam: [at(9, 19)], glances: ['left', 'right'], beatMs: 5300 },
    lines: [
      'Ahoy! The SEAGALLOP\'s fuelled and waiting.',
      'Kit up at the RAID ARENA and she\'ll run you out. She always comes back for you, too. Mostly with you on her.',
    ],
  },
  {
    id: 'gym-guide',
    kind: 'person',
    name: 'GYM GUIDE',
    design: 'gym-guide',
    position: at(6, 13),
    facing: 'right',
    idle: { roam: [at(5, 13)], glances: ['down', 'up'], beatMs: 4700 },
    lines: [
      'Yo! Champ in the making!',
      'Every raid starts through that door. Pack Potions. Then pack more Potions.',
      'And watch the telly in your house: it says who\'s hunting tonight.',
    ],
  },
  {
    id: 'ss-anne-captain',
    kind: 'person',
    name: 'CAPTAIN',
    design: 'captain',
    position: at(28, 26),
    facing: 'right',
    idle: { roam: [at(28, 25)], glances: ['up', 'left'], beatMs: 6100 },
    // Spoken to, he lends his spyglass (`spyglass.ts`).
    lines: spyglassLines('day', 0),
  },
  {
    id: 'dock-worker',
    kind: 'person',
    name: 'DOCK WORKER',
    design: 'worker',
    position: at(39, 21),
    facing: 'up',
    idle: { roam: [at(38, 21), at(40, 21), at(41, 21)], glances: ['left', 'right'], beatMs: 3900 },
    lines: [
      'Mind your feet! Crates off the boats go in the warehouses.',
      'What\'s in them? Ask BILL. Half of it\'s his, and he won\'t say what the other half is.',
    ],
  },
  {
    id: 'cove-angler',
    kind: 'person',
    name: 'ANGLER',
    design: 'fisherman',
    position: at(55, 23),
    facing: 'down',
    idle: { glances: ['left', 'right'], beatMs: 7300 },
    // Spoken to, he lends his rod and keeps the tally (`harbourFishing.ts`).
    lines: anglerLines(false, []),
  },
  {
    id: 'beach-girl',
    kind: 'person',
    name: 'LITTLE GIRL',
    design: 'little-girl',
    position: at(52, 19),
    facing: 'down',
    idle: { roam: [at(51, 19), at(53, 19), at(52, 18)], glances: ['left', 'right'], beatMs: 2900 },
    lines: ['The KRABBY pinched me! I\'m not crying. It\'s the sea in my eyes.'],
  },
  {
    id: 'green-old-man',
    kind: 'person',
    name: 'OLD MAN',
    design: 'old-man',
    position: at(57, 15),
    facing: 'up',
    idle: { glances: ['left', 'down'], beatMs: 8200 },
    lines: [
      'Sixty years I\'ve watched the boats come in here.',
      'Every one of them comes back lighter than it went out. That\'s raiding, that is.',
    ],
  },
  {
    id: 'quay-porter',
    kind: 'person',
    name: 'PORTER',
    design: 'man',
    position: at(5, 16),
    facing: 'left',
    idle: { roam: [at(5, 17)], glances: ['down', 'up'], beatMs: 6900 },
    lines: [
      'These crates came in on the SEAGALLOP and they won\'t carry themselves.',
      'BILL had the pick of them before the sun was up. He always does.',
    ],
  },
  {
    id: 'harbour-policeman',
    kind: 'person',
    name: 'POLICEMAN',
    design: 'policeman',
    position: at(21, 15),
    facing: 'down',
    idle: { roam: [at(22, 15), at(22, 16)], glances: ['left', 'right'], beatMs: 4300 },
    lines: [
      'Officer on the beat. Nobody hunts anybody in THE HARBOUR - not on my watch.',
      'Out there, mind, you\'re on your own.',
    ],
  },
];

export const HARBOUR_POKEMON: readonly HarbourPokemon[] = [
  {
    id: 'quay-slowpoke',
    kind: 'pokemon',
    species: 'slowpoke',
    name: 'SLOWPOKE',
    position: at(7, 19),
    facing: 'down',
    idle: { glances: ['right'], beatMs: 11300 },
    lines: ['SLOWPOKE is staring at the sea. It has been for some time.'],
  },
  {
    id: 'quay-pidgey',
    kind: 'pokemon',
    species: 'pidgey',
    name: 'PIDGEY',
    position: at(52, 15),
    facing: 'left',
    idle: { roam: [at(53, 15), at(53, 16)], glances: ['right', 'down'], beatMs: 1900 },
    lines: ['PIDGEY is pecking at crumbs somebody dropped on the green.'],
  },
  {
    id: 'crate-meowth',
    kind: 'pokemon',
    species: 'meowth',
    name: 'MEOWTH',
    position: at(47, 21),
    facing: 'left',
    idle: { roam: [at(47, 22)], glances: ['down', 'up'], beatMs: 3700 },
    lines: ['MEOWTH is eyeing the crates. Something in there smells of fish.'],
  },
  {
    id: 'dock-machop',
    kind: 'pokemon',
    species: 'machop',
    name: 'MACHOP',
    position: at(42, 21),
    facing: 'left',
    idle: { roam: [at(43, 21)], glances: ['up'], beatMs: 3300 },
    lines: ['MACHOP is carrying a crate on one finger. Showing off.'],
  },
  {
    id: 'police-growlithe',
    kind: 'pokemon',
    species: 'growlithe',
    name: 'GROWLITHE',
    position: at(20, 15),
    facing: 'down',
    idle: { glances: ['right', 'left'], beatMs: 2700 },
    lines: ['GROWLITHE is on duty. It sniffs your pack, then wags.'],
  },
  {
    id: 'beach-krabby',
    kind: 'pokemon',
    species: 'krabby',
    name: 'KRABBY',
    position: at(56, 20),
    facing: 'left',
    idle: { roam: [at(55, 20), at(57, 20)], glances: ['right', 'down'], beatMs: 2300 },
    lines: ['KRABBY waves a pincer at you. It means it.'],
  },
  {
    id: 'beach-psyduck',
    kind: 'pokemon',
    species: 'psyduck',
    name: 'PSYDUCK',
    position: at(59, 19),
    facing: 'down',
    idle: { roam: [at(59, 18)], glances: ['left'], beatMs: 6700 },
    lines: ['PSYDUCK is holding its head. The sea is too loud for it today.'],
  },
  {
    id: 'bay-lapras',
    kind: 'pokemon',
    species: 'lapras',
    name: 'LAPRAS',
    position: at(19, 27),
    facing: 'right',
    idle: { roam: [at(20, 27), at(21, 27), at(20, 28), at(21, 28)], glances: ['left', 'down'], beatMs: 5900 },
    lines: ['LAPRAS is swimming in the bay. It looks over at the SEAGALLOP as if it knows the way.'],
    swims: true,
  },
  {
    id: 'cove-magikarp',
    kind: 'pokemon',
    species: 'magikarp',
    name: 'MAGIKARP',
    position: at(55, 25),
    facing: 'left',
    idle: { roam: [at(54, 25), at(56, 25)], glances: ['right'], beatMs: 1700 },
    lines: ['MAGIKARP is splashing. Nothing else happens.'],
    swims: true,
  },
  {
    id: 'bay-tentacool',
    kind: 'pokemon',
    species: 'tentacool',
    name: 'TENTACOOL',
    position: at(14, 29),
    facing: 'down',
    idle: { roam: [at(15, 29), at(15, 30), at(14, 30)], glances: ['left', 'right'], beatMs: 4900 },
    lines: ['TENTACOOL is drifting with the tide.'],
    swims: true,
  },
];

export const HARBOUR_LIFE: readonly HarbourFigure[] = [...HARBOUR_PEOPLE, ...HARBOUR_POKEMON];

/** Whether a figure walks the land, where it can be in somebody's way. */
export function onLand(figure: HarbourFigure): boolean {
  return !(figure.kind === 'pokemon' && figure.swims);
}

/** Every tile a figure may ever stand on: where it was placed, then its roam. */
export function harbourBeatTiles(figure: HarbourFigure): readonly GridPosition[] {
  return [figure.position, ...(figure.idle.roam ?? [])];
}

export function harbourPokemonTextureKey(species: HarbourSpecies): string {
  return `harbour-${species}`;
}

export function harbourPokemonAssetPath(species: HarbourSpecies): string {
  return `assets/harbour-pokemon/${species}.png`;
}

export const HARBOUR_SPECIES = Object.keys(HARBOUR_POKEMON_ART) as readonly HarbourSpecies[];
