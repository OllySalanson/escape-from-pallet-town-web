import { getItemById, itemAmountFor, type ItemId, type SupplyItemId } from '../items/items';
import type { Stash } from '../stash/Stash';
import type { FirstWords } from './firstWords';
import { withArticle } from '../ui/article';

/**
 * The Pokédex, as far as this game keeps one: which kinds of Pokémon the save
 * has owned, and the rewards Professor Oak hands over as that count crosses a
 * milestone.
 *
 * **What counts.** FireRed registers a kind as owned the moment it is caught,
 * received or evolved into. Here a raid's catch is not owned until it is walked
 * out - a wipe loses it, as it loses a gift (`world/gifts.ts`) - so a kind counts
 * once a Pokémon of it has been in the vault: banked from a raid, handed over
 * by a contract, or evolved there. `SaveManager` writes every save with the
 * vault's kinds added to `RaidProgress.pokedexOwned`, which is the one place a
 * kind is registered, so no banking path can forget to. The list only ever
 * grows: a Pokémon paid to Brock or lost to a wipe was still owned.
 *
 * **What Oak gives.** One reward per milestone, once per save, recorded in
 * `RaidProgress.pokedexRewards` the moment he hands it over (`SaveManager.
 * claimPokedexReward`) - so a lab left unread does not pay twice. Every reward
 * below the last is a supply (`SupplyItemId`): the things a raid spends, and
 * nothing a loop must never hand out. Completing the Pokédex is the one
 * exception, because it can only happen once and there is nothing left to
 * break: Oak gives up his own Hauler frame and a set of the gear.
 *
 * **What he says** is FireRed's own: his PC rating lines for each bracket of
 * owned kinds (pret/pokefirered `data/text/pokedex_rating.inc`), and his aides'
 * "kinds of POKéMON" counting (`data/text/aide.inc`).
 */
export const KANTO_POKEDEX_SIZE = 151;

export interface PokedexRewardStack {
  readonly itemId: ItemId;
  readonly quantity: number;
}

export interface PokedexMilestone {
  /** How many kinds owned earns it. */
  readonly kinds: number;
  /** Oak's FireRed rating for this many kinds, split into the lines he says. */
  readonly rating: readonly string[];
  readonly reward: readonly PokedexRewardStack[];
}

const supply = (itemId: SupplyItemId, quantity: number): PokedexRewardStack => ({
  itemId,
  quantity,
});

const EVERY_STONE: readonly PokedexRewardStack[] = [
  supply('thunder-stone', 1),
  supply('fire-stone', 1),
  supply('water-stone', 1),
  supply('leaf-stone', 1),
  supply('moon-stone', 1),
];

export const POKEDEX_MILESTONES: readonly PokedexMilestone[] = [
  {
    // FireRed's first aide reward is at ten kinds too (HM05, which this game
    // does not have). The better ball, for the next ten.
    kinds: 10,
    rating: ['It looks as if you’re getting on the right track!'],
    reward: [supply('great-ball', 5)],
  },
  {
    kinds: 25,
    rating: [
      'Your Pokédex could use a bit more volume still!',
      'Try to catch other species of Pokémon!',
    ],
    reward: [supply('super-potion', 5), supply('great-ball', 5)],
  },
  {
    // An evolved form is a kind of its own, and thirteen lines read a stone.
    kinds: 50,
    rating: ['Ah, you’ve finally topped 50 species!'],
    reward: EVERY_STONE,
  },
  {
    // His FireRed rating for the seventies is the advice itself.
    kinds: 75,
    rating: ['Very good!', 'I think you’ll collect even more Pokémon by going fishing!'],
    reward: [supply('good-rod', 1), supply('great-ball', 10)],
  },
  {
    kinds: 100,
    rating: ['You’ve finally hit 100 species!', 'I can’t believe how good you are!'],
    reward: [supply('great-ball', 15), supply('super-potion', 10)],
  },
  {
    // FireRed's line for the 120s sends you to trade, which nobody can do here;
    // this is his line for the 130s.
    kinds: 125,
    rating: ['Outstanding!', 'You’ve become a real pro at this!'],
    reward: EVERY_STONE,
  },
  {
    kinds: KANTO_POKEDEX_SIZE,
    rating: [
      'Finally… You’ve finally completed the Pokédex!',
      'It’s magnificent! Truly, this is a fantastic feat!',
      'Sincerely, thank you! You’ve made my dream a reality!',
    ],
    reward: [
      { itemId: 'hauler-frame', quantity: 1 },
      { itemId: 'leftovers', quantity: 1 },
      { itemId: 'focus-band', quantity: 1 },
      { itemId: 'life-orb', quantity: 1 },
      { itemId: 'quick-claw', quantity: 1 },
    ],
  },
];

/** The milestone owned at exactly this many kinds, if there is one. */
export function pokedexMilestone(kinds: number): PokedexMilestone | undefined {
  return POKEDEX_MILESTONES.find((milestone) => milestone.kinds === kinds);
}

/** A list of dex numbers as the save keeps it: Kanto's own, once each, in order. */
export function tidyDexIds(value: readonly unknown[]): number[] {
  return [
    ...new Set(
      value.filter(
        (id): id is number =>
          Number.isInteger(id) && (id as number) >= 1 && (id as number) <= KANTO_POKEDEX_SIZE,
      ),
    ),
  ].sort((a, b) => a - b);
}

/** Every kind the save has owned: what it has registered, and whatever the vault holds now. */
export function pokedexOwned(
  registered: readonly number[] | undefined,
  stash: Stash | undefined,
): number[] {
  const held = stash?.listPokemon().map((stored) => stored.pokemon.base.dexId) ?? [];
  return tidyDexIds([...(registered ?? []), ...held]);
}

/**
 * The lowest milestone this many kinds has reached and Oak has not yet paid,
 * so a save that crosses two at once hears them in order, one at a time.
 */
export function dueMilestone(
  owned: number,
  claimed: readonly number[] | undefined,
): PokedexMilestone | undefined {
  return POKEDEX_MILESTONES.find(
    (milestone) => milestone.kinds <= owned && !(claimed ?? []).includes(milestone.kinds),
  );
}

/** The next milestone this many kinds has not reached yet. */
export function nextMilestone(owned: number): PokedexMilestone | undefined {
  return POKEDEX_MILESTONES.find((milestone) => milestone.kinds > owned);
}

/** "5 Great Balls and a Good Rod", as Oak would read the list out. */
export function rewardList(reward: readonly PokedexRewardStack[]): string {
  const named = reward.map(({ itemId, quantity }) =>
    quantity === 1
      ? withArticle(getItemById(itemId)?.displayName ?? itemId)
      : itemAmountFor(itemId, quantity),
  );
  return named.length <= 1
    ? (named[0] ?? '')
    : `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;
}

/**
 * What Oak says as he hands a milestone's reward over: he looks at the
 * Pokédex, counts, gives his FireRed rating and hands the reward over. Then he
 * names the next milestone - the aide's "come back" - so the player knows there
 * is one, unless the next is already reached and he has more to give now.
 * `continuing` is the second of two given in one visit, which has no need to
 * say hello again.
 */
export function milestoneWords(
  milestone: PokedexMilestone,
  owned: number,
  continuing = false,
): FirstWords {
  const next = nextMilestone(milestone.kinds);
  const closing = !next
    ? []
    : next.kinds <= owned
      ? ['And that’s not all!']
      : [`When you have ${next.kinds} kinds of Pokémon, come back and see me.`];
  const one = milestone.reward.length === 1 && milestone.reward[0].quantity === 1;
  return {
    speaker: 'prof-oak',
    name: 'Professor Oak',
    lines: [
      ...(continuing
        ? []
        : [
            `Good to see you! Let me take a look at your Pokédex… ${owned} kinds of Pokémon caught!`,
          ]),
      milestone.rating.join(' '),
      `Here, take ${rewardList(milestone.reward)}. I’ve put ${one ? 'it' : 'them'} on BILL’S PC.`,
      ...closing,
    ],
  };
}
