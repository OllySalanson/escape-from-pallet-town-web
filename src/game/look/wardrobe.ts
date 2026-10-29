/**
 * What a save owns to wear, what a try-on costs, and whether it can be paid
 * for - the boutique's rules, Phaser-free.
 *
 * Owning is derived, never a second record that could disagree: the starter
 * pieces everybody has, whatever the save has bought or bartered for
 * (`raidProgress.wardrobe`), and nothing else. A raid-only piece is never on
 * the boutique's shelves to buy, so it is owned only by being found.
 *
 * Paying is the economy's whole point, so the rules are the captain's: a piece
 * with a price is paid in Pokédollars out of the vault (there is no wallet -
 * money is loot), a barter piece in found goods and never in money, and a
 * raid piece cannot be paid for at all.
 */
import { formatMoney, CURRENCY_ITEM_ID, itemAmountsFor } from '../items/items';
import type { Stash } from '../stash/Stash';
import { lookIds, type DressedLook, type PlayerLook } from './look';
import { RAID_WEARABLES, STARTER_WEARABLES, WEARABLES, wearableById, type Wearable } from './wearables';

/**
 * Every piece a save may wear: the starter pieces, what it bought, and every
 * raid find the vault holds - a find is the piece itself, kept in the vault.
 */
export function ownedWearables(
  wardrobe: readonly string[] | undefined,
  vault?: Pick<Stash, 'itemCount'>,
): ReadonlySet<string> {
  const found = vault ? RAID_WEARABLES.filter((piece) => vault.itemCount(piece.id) > 0).map((piece) => piece.id) : [];
  return new Set([...STARTER_WEARABLES, ...(wardrobe ?? []).filter((id) => wearableById(id) !== undefined), ...found]);
}

/** The pieces of a look this save does not own yet, each once. */
export function unownedIn(look: PlayerLook, owned: ReadonlySet<string>): readonly Wearable[] {
  const ids = [...new Set(lookIds(look))].filter((id) => !owned.has(id));
  return ids.flatMap((id) => wearableById(id) ?? []);
}

export interface WearableBill {
  /** Pokédollars, summed over every priced piece. */
  readonly money: number;
  /** Found goods, summed over every barter piece, by item id. */
  readonly goods: Readonly<Record<string, number>>;
  /** Raid finds in the try-on: they cannot be bought, only found. */
  readonly raidOnly: readonly Wearable[];
}

/** What it costs to buy every one of these pieces. */
export function billFor(pieces: readonly Wearable[]): WearableBill {
  const goods: Record<string, number> = {};
  let money = 0;
  const raidOnly: Wearable[] = [];
  for (const piece of pieces) {
    if (piece.rarity === 'raid') {
      raidOnly.push(piece);
      continue;
    }
    money += piece.price ?? 0;
    for (const [itemId, quantity] of Object.entries(piece.barter ?? {})) {
      goods[itemId] = (goods[itemId] ?? 0) + quantity;
    }
  }
  return { money, goods, raidOnly };
}

export type BillRefusal = 'raid-only' | 'money-short' | 'goods-short';

export interface BillCheck {
  readonly bill: WearableBill;
  readonly refusal?: BillRefusal;
  /** Why not, in the shopkeeper's words, when there is a refusal. */
  readonly why?: string;
}

/** Whether the vault can pay a bill, and if not, the first reason it cannot. */
export function checkBill(bill: WearableBill, stash: Pick<Stash, 'itemCount'>): BillCheck {
  if (bill.raidOnly.length > 0) {
    const names = bill.raidOnly.map((piece) => piece.name).join(', ');
    return {
      bill,
      refusal: 'raid-only',
      why: `${names} ${bill.raidOnly.length === 1 ? 'is' : 'are'} not for sale. Things like that turn up on raids.`,
    };
  }
  const money = stash.itemCount(CURRENCY_ITEM_ID);
  if (money < bill.money) {
    return { bill, refusal: 'money-short', why: `That comes to ${formatMoney(bill.money)}, and you have ${formatMoney(money)}.` };
  }
  const short = Object.entries(bill.goods)
    .filter(([itemId, quantity]) => stash.itemCount(itemId) < quantity)
    .map(([itemId, quantity]) => ({ itemId, quantity: quantity - stash.itemCount(itemId) }));
  if (short.length > 0) {
    return { bill, refusal: 'goods-short', why: `That needs ${itemAmountsFor(short)} more than you have in the vault.` };
  }
  return { bill };
}

/** A bill as one line: "₽450 and 3 Linen rolls". */
export function billLine(bill: WearableBill): string {
  const goods = Object.entries(bill.goods).map(([itemId, quantity]) => ({ itemId, quantity }));
  const parts = [...(bill.money > 0 ? [formatMoney(bill.money)] : []), ...(goods.length > 0 ? [itemAmountsFor(goods)] : [])];
  return parts.length === 0 ? 'nothing' : parts.join(' and ');
}

/** A piece's price as its card says it. */
export function priceLine(piece: Wearable): string {
  if (piece.rarity === 'starter') return 'Yours already';
  if (piece.rarity === 'raid') return 'Found on raids';
  if (piece.price !== undefined) return formatMoney(piece.price);
  return itemAmountsFor(Object.entries(piece.barter ?? {}).map(([itemId, quantity]) => ({ itemId, quantity })));
}

/**
 * A whole look: a set the boutique dresses somebody in at once, themed on
 * Kanto's trainers, its gym leaders and champions, and the original 151.
 * Buying one buys whatever of it is not owned, at the pieces' own prices.
 */
export interface WholeLook {
  readonly id: string;
  readonly name: string;
  readonly note: string;
  readonly look: DressedLook;
}

const whole = (id: string, name: string, note: string, head: string, top: string, legs: string, body: string | null = null): WholeLook => ({
  id,
  name,
  note,
  look: { head, top, legs, body },
});

export const WHOLE_LOOKS: readonly WholeLook[] = [
  whole('champion-red', 'Champion Red', 'Cap, vest, pack and jeans: the trainer who started in Pallet Town.', 'red-cap', 'red-vest', 'denim-jeans'),
  whole('champion-leaf', 'Champion Leaf', 'The other trainer who started in Pallet Town.', 'leaf-hat', 'plain-tee', 'plain-trousers', 'leaf-outfit'),
  whole('rival-blue', 'Rival Blue', 'Smell ya later!', 'blue-spikes', 'blue-jacket', 'grey-slacks'),
  whole('professor-oak', 'Professor Oak', 'The lab coat and the grey of Pallet Town’s professor.', 'oak-grey', 'oak-coat', 'grey-slacks'),
  whole('pokemaniac-bill', 'Bill', 'The storage system’s inventor, as he is when he is not a Clefairy.', 'bill-mop', 'bill-shirt', 'cargo-trousers'),
  whole('gym-brock', 'Brock', 'Pewter City’s rock-hard gym leader, dressed for Mt. Moon.', 'brock-spikes', 'plain-tee', 'plain-trousers', 'hiker-gear'),
  whole('gym-misty', 'Misty', 'Cerulean City’s gym leader, ready for the water.', 'misty-tail', 'plain-tee', 'plain-trousers', 'swimsuit'),
  whole('gym-surge', 'Lt. Surge', 'The Lightning American of Vermilion, in his work clothes.', 'surge-flat-top', 'work-shirt', 'cargo-trousers'),
  whole('gym-erika', 'Erika', 'Celadon City’s gym leader, in her garden best.', 'erika-bob', 'plain-tee', 'plain-trousers', 'long-skirt'),
  whole('gym-koga', 'Koga', 'Fuchsia City’s ninja master.', 'koga-hood', 'karate-gi', 'gi-trousers'),
  whole('gym-sabrina', 'Sabrina', 'Saffron City’s psychic gym leader.', 'sabrina-hair', 'plain-tee', 'plain-trousers', 'long-skirt'),
  whole('gym-blaine', 'Blaine', 'Cinnabar Island’s quiz master, in his lab coat.', 'blaine-shades', 'lab-coat', 'grey-slacks'),
  whole('boss-giovanni', 'Giovanni', 'The boss of Team Rocket, who also runs the Viridian gym.', 'boss-slick', 'boss-suit', 'grey-slacks'),
  whole('elite-lorelei', 'Lorelei', 'Of the Elite Four, in her gown.', 'lorelei-waves', 'plain-tee', 'plain-trousers', 'lorelei-gown'),
  whole('elite-bruno', 'Bruno', 'Of the Elite Four, dressed to train.', 'bruno-mane', 'karate-gi', 'gi-trousers'),
  whole('elite-agatha', 'Agatha', 'Of the Elite Four, in her day dress.', 'agatha-bun', 'plain-tee', 'plain-trousers', 'day-dress'),
  whole('elite-lance', 'Lance', 'The dragon master, in a captain’s coat.', 'lance-spikes', 'plain-tee', 'plain-trousers', 'captain-coat'),
  whole('team-rocket', 'Team Rocket', 'Prepare for trouble.', 'grunt-cap', 'grunt-tunic', 'grey-slacks'),
  whole('team-rocket-dress', 'Team Rocket, dressed', 'Make it double.', 'grunt-hair', 'plain-tee', 'plain-trousers', 'grunt-dress'),
  whole('mon-pikachu', 'Pikachu', 'Yellow from cap to toe, like the Pokémon everybody knows.', 'youngster-cap', 'plain-tee-yellow', 'shorts'),
  whole('mon-bulbasaur', 'Bulbasaur', 'Leaf green, like the seed Pokémon from Pallet Town.', 'youngster-cap-green', 'plain-tee', 'camp-shorts'),
  whole('mon-charmander', 'Charmander', 'Orange like the lizard Pokémon’s flame.', 'short-crop-ginger', 'ace-jacket', 'ace-trousers'),
  whole('mon-squirtle', 'Squirtle', 'Sky blue, like the tiny turtle Pokémon.', 'youngster-cap-sky', 'plain-tee-sky', 'plain-trousers-sky'),
  whole('mon-jigglypuff', 'Jigglypuff', 'Pink, like the balloon Pokémon who sings everybody to sleep.', 'youngster-cap-pink', 'plain-tee-pink', 'pink-slacks'),
  whole('mon-gengar', 'Gengar', 'Violet, like the shadow Pokémon of Lavender Town.', 'youngster-cap-violet', 'plain-tee-violet', 'plain-trousers-grey'),
  whole('mon-snorlax', 'Snorlax', 'Roomy, like the sleeping Pokémon on Route 12.', 'comb-over', 'plain-tee', 'plain-trousers', 'roomy-overalls'),
  whole('mon-psyduck', 'Psyduck', 'Yellow and puzzled, like the duck Pokémon.', 'short-crop-blonde', 'plain-tee-yellow', 'plain-trousers'),
  whole('mon-mew', 'Mew', 'Pink as the mythical Pokémon. The dress is only found on raids.', 'lass-hair-pink', 'plain-tee', 'plain-trousers', 'mew-dress'),
  whole('mon-articuno', 'Articuno', 'Ice blue. The crest is only found on raids.', 'articuno-wave', 'plain-tee-sky', 'plain-trousers-sky'),
  whole('mon-zapdos', 'Zapdos', 'Lightning gold. The jacket is only found on raids.', 'shiny-pikachu-crop', 'zapdos-jacket', 'plain-trousers-grey'),
  whole('mon-moltres', 'Moltres', 'Flame orange. The tee is only found on raids.', 'short-crop-ginger', 'moltres-tee', 'red-trousers'),
  whole('mon-mewtwo', 'Mewtwo', 'Psychic violet. The robe is only found on raids.', 'short-crop-violet', 'plain-tee', 'plain-trousers', 'mewtwo-robe'),
];

/** Every whole look's pieces exist and sit in the slots they are listed in (`wardrobe.test.ts`). */
export function wholeLookById(id: string): WholeLook | undefined {
  return WHOLE_LOOKS.find((entry) => entry.id === id);
}

/** Every catalogue piece, in shelf order: hats, hair, tops, bottoms, outfits. */
export const SHELF_ORDER = ['hat', 'hair', 'top', 'legs', 'outfit'] as const;

export function shelfPieces(kind: (typeof SHELF_ORDER)[number], raid: boolean): readonly Wearable[] {
  return WEARABLES.filter((piece) => piece.kind === kind && (piece.rarity === 'raid') === raid);
}
