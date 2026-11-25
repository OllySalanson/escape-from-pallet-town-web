/**
 * What beaten trainers' bags pay, measured over many raids
 * (`src/game/world/trainerBags.ts`): per kit and standing, how often a bag
 * drops, how many pieces and squares it holds, how often each tier of find
 * turns up, and what each item comes to per hundred bags.
 *
 *   npx vite-node tools/trainers/bags.mts [-- --raids=2000]
 */
import { cellsFor } from '../../src/game/items/itemGrid';
import { ITEMS } from '../../src/game/items/items';
import { trainersOn } from '../../src/game/world/mapTrainers';
import {
  HUNTER_KITS,
  kitFor,
  rollBagContents,
  standingOf,
  type BagOwner,
  type BagTier,
} from '../../src/game/world/trainerBags';

const raids = Number(process.argv.find((arg) => arg.startsWith('--raids='))?.split('=')[1] ?? 2000);

const owners: BagOwner[] = [
  ...trainersOn('greystone-vale').map((encounter) => ({
    id: encounter.trainer.id,
    name: encounter.trainer.name,
    kit: kitFor(encounter.design),
    standing: standingOf(encounter.trainer.party.map((pokemon) => pokemon.level), encounter.bossId !== undefined),
  })),
  ...Object.entries(HUNTER_KITS).map(([id, kit]) => ({ id: `hunter-${id}`, name: id.toUpperCase(), kit, standing: 'hunter' as const })),
];

interface Tally {
  owners: Set<string>;
  bags: number;
  rolls: number;
  pieces: number;
  squares: number;
  tiers: Record<BagTier, number>;
  items: Map<string, number>;
}
const groups = new Map<string, Tally>();
const all: Tally = { owners: new Set(), bags: 0, rolls: 0, pieces: 0, squares: 0, tiers: { basic: 0, uncommon: 0, rare: 0, treasure: 0 }, items: new Map() };

for (const owner of owners) {
  const key = `${owner.kit.id}/${owner.standing}`;
  const tally = groups.get(key) ?? { owners: new Set(), bags: 0, rolls: 0, pieces: 0, squares: 0, tiers: { basic: 0, uncommon: 0, rare: 0, treasure: 0 }, items: new Map() };
  groups.set(key, tally);
  for (const into of owner.standing === 'boss' || owner.standing === 'hunter' ? [tally] : [tally, all]) {
    into.owners.add(owner.id);
  }
  for (let seed = 1; seed <= raids; seed += 1) {
    const bag = rollBagContents(owner, seed * 7919);
    for (const into of owner.standing === 'boss' || owner.standing === 'hunter' ? [tally] : [tally, all]) {
      into.rolls += 1;
      if (!bag) continue;
      into.bags += 1;
      into.tiers[bag.best] += 1;
      for (const { itemId, quantity } of bag.reward) {
        into.pieces += quantity;
        into.squares += cellsFor(itemId, quantity);
        into.items.set(itemId, (into.items.get(itemId) ?? 0) + quantity);
      }
    }
  }
}

const pct = (n: number, d: number): string => `${((100 * n) / Math.max(1, d)).toFixed(1)}%`;
const line = (name: string, t: Tally): string =>
  [
    name.padEnd(22),
    String(t.owners.size).padStart(3),
    pct(t.bags, t.rolls).padStart(7),
    (t.pieces / Math.max(1, t.bags)).toFixed(2).padStart(6),
    (t.squares / Math.max(1, t.bags)).toFixed(2).padStart(6),
    pct(t.tiers.uncommon, t.bags).padStart(7),
    pct(t.tiers.rare, t.bags).padStart(7),
    pct(t.tiers.treasure, t.bags).padStart(7),
  ].join(' ');

console.log(`${raids} raids per owner\n`);
console.log('kit/standing            n  carried pieces squares  uncom    rare  treas');
for (const [key, tally] of [...groups].sort()) console.log(line(key, tally));
console.log(line('ALL ORDINARY', all));
console.log('\nper 100 ordinary bags:');
console.log(
  [...all.items]
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => `${ITEMS[id as keyof typeof ITEMS].displayName} ${((100 * n) / all.bags).toFixed(1)}`)
    .join(', '),
);
