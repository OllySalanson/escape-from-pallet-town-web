import {
  growGridColumns,
  SECURE_COLUMNS_PER_UPGRADE,
  type GridSize,
} from '../items';
import { RAID_CONTRACTS } from '../objectives/contracts';
import { isMapRetired } from '../world/mapRoster';
import { WORKSHOP_UPGRADES } from './workshop';

/**
 * The ways a save can still grow its secure container, each worth a column.
 *
 * The locker's refusals used to end "Take something out, or grow the
 * container" whatever the case, and a player with a Charizard and every locker
 * built was told to do both when neither could help: the container only ever
 * grows sideways and stays two squares tall, so a fully evolved Pokemon fits
 * none of them (the characters bug hunt, 11 Nov 2026). A refusal is a doorway,
 * never an instruction the player cannot follow, so the screen is told which
 * doors are left rather than assuming there is one.
 *
 * Derived from the same three things `secureGrid` reads, so it can never
 * disagree with the container it describes.
 */
export type SecureGrowthRoute =
  | { readonly kind: 'workshop'; readonly name: string }
  | { readonly kind: 'berth' }
  | { readonly kind: 'contract'; readonly name: string };

/** Every column still to be had, in the order the advice names them. */
export function secureGrowthLeft(
  completedContractIds: readonly string[],
  workshopUpgradeIds: readonly string[],
  berthPaid: boolean,
): readonly SecureGrowthRoute[] {
  // Brock's ladder in order, so the first route named is the one he builds next.
  const workshop = WORKSHOP_UPGRADES.filter(
    (upgrade) => upgrade.secureItemStack && !workshopUpgradeIds.includes(upgrade.id),
  ).map((upgrade): SecureGrowthRoute => ({ kind: 'workshop', name: upgrade.name }));
  const berth: SecureGrowthRoute[] = berthPaid ? [] : [{ kind: 'berth' }];
  // A contract on a retired map is put away with it, so it is no way to grow.
  const contracts = RAID_CONTRACTS.filter(
    (contract) =>
      contract.reward.secureItemStack &&
      !completedContractIds.includes(contract.id) &&
      !isMapRetired(contract.mapId),
  ).map((contract): SecureGrowthRoute => ({ kind: 'contract', name: contract.name }));
  return [...workshop, ...berth, ...contracts];
}

/** The biggest container these routes could make of this one. */
export function grownSecureGrid(grid: GridSize, routes: readonly SecureGrowthRoute[]): GridSize {
  return growGridColumns(grid, routes.length * SECURE_COLUMNS_PER_UPGRADE);
}

/**
 * How to grow it, as the end of a sentence: "build Secure locker I at Brock's
 * Workshop, or rent a berth in Bill's hold". Brock's next rung only, because
 * the second cannot be built before the first. Empty when nothing is left.
 */
export function secureGrowthAdvice(routes: readonly SecureGrowthRoute[]): string {
  const ways: string[] = [];
  const workshop = routes.find((route) => route.kind === 'workshop');
  if (workshop) {
    ways.push(`build ${workshop.name} at Brock's Workshop`);
  }
  if (routes.some((route) => route.kind === 'berth')) {
    ways.push("rent a berth in Bill's hold");
  }
  const contract = routes.find((route) => route.kind === 'contract');
  if (contract) {
    ways.push(`bank the ${contract.name} contract`);
  }
  return ways.join(', or ');
}
