import { Pokemon } from '../pokemon';
import { getSpeciesById } from '../pokemon/species';
import type { RaidInFlight } from '../run/raidInFlight';
import type { RaidProgress } from '../save/SaveManager';
import { raidsCompleted } from './dayCare';
import { errandRecord, errandsInHand } from './errands';

/**
 * Professor Oak's fossil machine: FireRed's Cinnabar Lab, in his own lab.
 *
 * A fossil is found in a raid - THE OLD SHELLS, in the Greystone Caves'
 * sand (`../world/secrets.ts`) - and carried home at risk like any find. Left
 * on the machine, it is woken over one raid: the Pokemon is waiting once a raid
 * has ended since it was put on, counted as the Day-Care counts its raids
 * (`raidsCompleted`), so a raid out and straight back in does not count and
 * nothing about the wait is a clock. The save keeps only which fossil is on the
 * machine and the raid count it went on at (`raidProgress.fossil`); everything
 * else is derived. What wakes is FireRed's: Omanyte from the Helix Fossil,
 * Kabuto from the Dome Fossil and Aerodactyl from the Old Amber, at level 5.
 */

export const FOSSIL_KINDS = {
  'helix-fossil': 'omanyte',
  'dome-fossil': 'kabuto',
  // FireRed's Old Amber, found in PINE HOLLOW once Bill has the first lump on
  // his desk (`errands.ts`, `afterwards`): the one way to an Aerodactyl.
  'old-amber': 'aerodactyl',
} as const;

export type FossilItemId = keyof typeof FOSSIL_KINDS;

export const FOSSIL_ITEM_IDS = Object.keys(FOSSIL_KINDS) as readonly FossilItemId[];

/** FireRed's Cinnabar Lab revives every fossil at level 5. */
export const REVIVED_LEVEL = 5;

export const FOSSIL_MACHINE = 'FOSSIL MACHINE';

/** A fossil on the machine, and the raid count it went on at. */
export interface FossilOnMachine {
  readonly itemId: FossilItemId;
  readonly raidsAt: number;
}

export function isFossil(itemId: string): itemId is FossilItemId {
  return Object.hasOwn(FOSSIL_KINDS, itemId);
}

/** Whether the fossil on the machine has woken: a raid has ended since it went on. */
export function fossilAwake(
  fossil: FossilOnMachine,
  progress: RaidProgress,
  raidInFlight?: RaidInFlight | null,
): boolean {
  return raidsCompleted(progress, raidInFlight) > fossil.raidsAt;
}

/** The Pokemon a fossil wakes as. */
export function revivedPokemon(itemId: FossilItemId): Pokemon {
  const species = getSpeciesById(FOSSIL_KINDS[itemId]);
  if (!species) {
    throw new Error(`The ${itemId} wakes as a species the game does not have.`);
  }
  return new Pokemon(species, REVIVED_LEVEL);
}

/**
 * The fossils in the vault the machine may take, in catalogue order: never an
 * Old Amber Bill is still waiting on, because that lump is his (`errands.ts`).
 */
export function fossilsForTheMachine(
  count: (itemId: FossilItemId) => number,
  progress: Pick<RaidProgress, 'errands'>,
): readonly FossilItemId[] {
  const owed = new Set<string>(errandsInHand(progress).map((errand) => errand.itemId));
  return FOSSIL_ITEM_IDS.filter((itemId) => count(itemId) > 0 && !owed.has(itemId));
}

/** Whether Bill has his amber on his desk, so PINE HOLLOW's next lump is the machine's. */
export function amberWeeps(progress: Pick<RaidProgress, 'errands'>): boolean {
  return errandRecord(progress.errands, 'old-amber')?.status === 'completed';
}

/** What the machine says, faced: what is on it, or what it is for. */
export function fossilMachineLines(
  fossil: FossilOnMachine | undefined,
  awake: boolean,
  fossilsHeld: readonly FossilItemId[],
  amberInThePines = false,
): readonly string[] {
  if (fossil) {
    const kind = FOSSIL_KINDS[fossil.itemId].toUpperCase();
    return awake
      ? [`The machine has stopped humming. Something is moving inside it!`, `${kind} woke up!`]
      : [
          'The machine hums. Something old is coming back to life inside it.',
          'OAK: Give it a raid. It will be awake when you get home.',
        ];
  }
  if (fossilsHeld.length > 0) {
    return ['A machine for waking fossils. OAK: Put it on the plate, and it will be awake after your next raid.'];
  }
  return [
    'A machine for waking fossils, borrowed from the lab on CINNABAR.',
    'OAK: Old shells turn up in the sand under the vale, if you know how to dig for them.',
    ...(amberInThePines ? ['OAK: And BILL says PINE HOLLOW still weeps amber. There is something very old inside it.'] : []),
  ];
}
