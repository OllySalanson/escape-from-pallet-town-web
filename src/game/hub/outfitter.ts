import type { ContractStack } from '../objectives/contracts';
import { Stash, type StashedPokemon } from '../stash';

/**
 * The Outfitter: permanent base upgrades, paid for out of the vault.
 *
 * The stash was a savings account with no withdrawals. Supplies arrived faster
 * than raids spent them and a caught Pokemon had no use past the sixth, so
 * nothing a player banked changed anything. This is the withdrawal: a ladder of
 * base capability bought with the only two things the vault holds - banked
 * Pokemon and banked supplies.
 *
 * It is a sink, not a shop. There is no currency, no vendor and no goods: it
 * never hands back an item or a Pokemon, only capability or information, and
 * never raw power - nothing here makes a Pokemon hit harder.
 *
 * Like a contract's reward, an upgrade is never stored beside its effect. The
 * save records which upgrades were built (`raidProgress.outfitterUpgrades`) and
 * every effect is derived from that list by the owner that already existed:
 * secure slots in `../objectives/contracts`, healing prices in `./recovery`,
 * the hunter line in `../scenes/raidHud`, the beacon in
 * `../run/runGeneration`. A save can therefore never disagree with the ladder.
 *
 * Everything here is a pure function over the stash, so the rules about what
 * may be spent are testable without Phaser; `HubScene` only renders them and
 * `SaveManager.buildOutfitterUpgrade()` is the one path that spends.
 */

export interface OutfitterCost {
  /** How many banked Pokemon are released to build this. The player names them. */
  readonly pokemon: number;
  readonly supplies: readonly ContractStack[];
}

export interface OutfitterUpgrade {
  readonly id: string;
  readonly name: string;
  /** What it does, in the one short line the ladder has room for. */
  readonly effect: string;
  /** The same promise in full, read on the payment screen before it is paid for. */
  readonly detail: string;
  /** One of the shared 16x16 icons in `../ui/icons`, by file name. */
  readonly icon: string;
  /** The upgrade that must already stand before this one is offered. */
  readonly requires?: string;
  readonly cost: OutfitterCost;
  /** Adds one protected item stack to the secure slot. */
  readonly secureItemStack?: boolean;
  /** Adds one protected Pokemon to the secure slot. */
  readonly securePokemon?: boolean;
  /**
   * The share of every listed recovery bay price still charged once this
   * stands. It scales the *share* of a raid a treatment costs, never an
   * absolute time - see `./recovery` for why. The lowest built share applies.
   */
  readonly recoveryPriceShare?: number;
  /** Treatments per raid the ward takes off the clock. */
  readonly wardTreatments?: number;
  /** The raid HUD names the hunter's tier and when the next one lands. */
  readonly hunterIntel?: boolean;
  /** An extra exit opens late at the landing of the map deployed to. */
  readonly beacon?: boolean;
}

/**
 * The ladder, in the order it is listed: information first, then each pair of
 * rungs side by side, so the two-column lobby list reads as tracks.
 *
 * Prices are set against what a raid actually banks rather than felt. A raid
 * brings home one or two catches (five Poke Balls at 20-95% a throw) and nets
 * between nothing and two supplies once what it drank is taken off what it
 * found (a map holds two to five loot tiles and at least half are live). So the
 * Pokemon count is the real price and carries the ladder - seventeen in all,
 * which is roughly a dozen raids of catching past the six a party can use - and
 * the supply half is kept to one to four units of whichever stock the upgrade
 * is about, so it is felt without gating the rung behind a second grind.
 * Information is cheapest, the two capabilities that change the loadout
 * decision are mid-priced, and the second protected Pokemon - the strongest
 * thing on the list - costs the most.
 */
export const OUTFITTER_UPGRADES: readonly OutfitterUpgrade[] = [
  {
    id: 'radio-mast',
    icon: 'radio-mast',
    name: 'Radio mast',
    effect: 'The hunter’s team, on the raid HUD.',
    detail:
      'The raid HUD names the hunter’s current team and counts down to the next, stronger one. Information only: the hunter is not slowed.',
    cost: { pokemon: 1, supplies: [{ itemId: 'antidote', quantity: 2 }] },
    hunterIntel: true,
  },
  {
    id: 'beacon',
    icon: 'extraction-open',
    name: 'Beacon',
    effect: 'Your landing is a late extra exit.',
    detail: 'A beacon marks where you land on every map. Halfway through the raid clock it opens as an extra exit.',
    cost: { pokemon: 3, supplies: [{ itemId: 'great-ball', quantity: 2 }] },
    beacon: true,
  },
  {
    id: 'secure-locker-1',
    icon: 'supply-crate',
    name: 'Secure locker I',
    effect: 'One more protected item stack.',
    detail: 'The secure slot protects one more item stack, so it comes home from every raid - even a lost one.',
    cost: {
      pokemon: 2,
      supplies: [
        { itemId: 'poke-ball', quantity: 2 },
        { itemId: 'potion', quantity: 1 },
      ],
    },
    secureItemStack: true,
  },
  {
    id: 'secure-locker-2',
    icon: 'supply-crate',
    name: 'Secure locker II',
    effect: 'A second protected Pokémon.',
    detail: 'The secure slot protects a second Pokémon, so two of your party come home from a lost raid.',
    requires: 'secure-locker-1',
    cost: {
      pokemon: 4,
      supplies: [
        { itemId: 'great-ball', quantity: 2 },
        { itemId: 'super-potion', quantity: 2 },
      ],
    },
    securePokemon: true,
  },
  {
    id: 'recovery-bay-1',
    icon: 'super-potion',
    name: 'Recovery bay I',
    effect: 'Recovery prices drop a quarter.',
    detail: 'Every recovery bay price - healing, curing and reviving - costs a quarter less raid time.',
    cost: { pokemon: 2, supplies: [{ itemId: 'potion', quantity: 2 }] },
    recoveryPriceShare: 0.75,
  },
  {
    id: 'recovery-bay-2',
    icon: 'super-potion',
    name: 'Recovery bay II',
    effect: 'Recovery prices drop to half.',
    detail: 'Every recovery bay price - healing, curing and reviving - costs half the raid time it started at.',
    requires: 'recovery-bay-1',
    cost: { pokemon: 3, supplies: [{ itemId: 'super-potion', quantity: 2 }] },
    recoveryPriceShare: 0.5,
  },
  {
    id: 'quarantine-ward',
    icon: 'antidote',
    name: 'Quarantine ward',
    effect: 'One heal per raid, free of clock.',
    detail:
      'Once per raid, the bay heals and cures one Pokémon free of clock - whoever it saves the most on. A revive still costs its premium.',
    cost: {
      pokemon: 2,
      supplies: [
        { itemId: 'super-potion', quantity: 1 },
        { itemId: 'antidote', quantity: 1 },
      ],
    },
    wardTreatments: 1,
  },
];

export function getOutfitterUpgrade(id: string): OutfitterUpgrade | undefined {
  return OUTFITTER_UPGRADES.find((upgrade) => upgrade.id === id);
}

/** Every built upgrade the ladder still knows, once each, in ladder order. */
export function builtUpgrades(builtIds: readonly string[]): readonly OutfitterUpgrade[] {
  return OUTFITTER_UPGRADES.filter((upgrade) => builtIds.includes(upgrade.id));
}

/** Item stacks the Outfitter has added to the secure slot. */
export function outfitterSecureItemStacks(builtIds: readonly string[]): number {
  return builtUpgrades(builtIds).filter((upgrade) => upgrade.secureItemStack).length;
}

/** Protected Pokemon the Outfitter has added to the secure slot. */
export function outfitterSecurePokemon(builtIds: readonly string[]): number {
  return builtUpgrades(builtIds).filter((upgrade) => upgrade.securePokemon).length;
}

/** The share of every listed recovery price this base actually charges. */
export function recoveryPriceShare(builtIds: readonly string[]): number {
  return Math.min(1, ...builtUpgrades(builtIds).map((upgrade) => upgrade.recoveryPriceShare ?? 1));
}

/** How many treatments per raid the ward takes off the clock. */
export function wardTreatmentsPerRaid(builtIds: readonly string[]): number {
  return builtUpgrades(builtIds).reduce(
    (total, upgrade) => total + (upgrade.wardTreatments ?? 0),
    0,
  );
}

export function hasHunterIntel(builtIds: readonly string[]): boolean {
  return builtUpgrades(builtIds).some((upgrade) => upgrade.hunterIntel);
}

export function hasBeacon(builtIds: readonly string[]): boolean {
  return builtUpgrades(builtIds).some((upgrade) => upgrade.beacon);
}

/**
 * Where the beacon opens, as a share of the clock the raid actually deploys
 * with. A share rather than a time for the reason every recovery price is one:
 * booked recovery can halve the clock, and an exit that opened at an absolute
 * 2:30 would open on the enrage for exactly the player who most needs it.
 */
export const BEACON_UNLOCK_SHARE = 0.5;

export function beaconUnlockAtMs(raidDurationMs: number): number {
  return Math.floor(Math.max(0, raidDurationMs) * BEACON_UNLOCK_SHARE);
}

/** What the vault is holding that a payment may touch, for one save. */
export interface OutfitterVault {
  readonly stash: Stash;
  /** The species this save is re-issued after a wipe. Never payment. */
  readonly starterSpeciesId: string | null;
}

export interface PaymentCandidate {
  readonly stored: StashedPokemon;
  /** Undefined when this Pokemon may be offered as payment. */
  readonly refusal?: string;
}

export const PARTNER_REFUSAL = 'Your partner is never payment';
export const LAST_FIT_REFUSAL = 'Your last Pokémon fit to raid';

/**
 * Every Pokemon at base, with the reason it cannot be spent when it cannot.
 *
 * Two are never payment. The partner - any Pokemon of the species this save
 * chose, because nothing else in a save identifies the one the player started
 * with and refusing a caught lookalike is a far smaller wrong than releasing
 * the original. And the last Pokemon fit to raid, because every path in this
 * game has to leave the player able to attempt a run.
 */
export function paymentCandidates(vault: OutfitterVault): readonly PaymentCandidate[] {
  const stored = vault.stash.listPokemon();
  const fit = stored.filter((entry) => !entry.pokemon.isFainted);
  return stored.map((entry) => {
    if (entry.pokemon.base.id === vault.starterSpeciesId) {
      return { stored: entry, refusal: PARTNER_REFUSAL };
    }
    if (fit.length === 1 && fit[0] === entry) {
      return { stored: entry, refusal: LAST_FIT_REFUSAL };
    }
    return { stored: entry };
  });
}

/**
 * How many of one supply the Outfitter may take from this vault: whatever is
 * above the kit base restocks after a wipe. Spending into that kit would be
 * refunded by the next wipe, which would make wiping a way to build a base for
 * nothing. The kit is `Stash`'s rule, so this only asks it.
 */
export function spendableSupply(vault: OutfitterVault, itemId: string): number {
  return vault.stash.spareCount(itemId);
}

/**
 * Whether the whole supply price can leave the vault without deepening any
 * shortfall the restock would then make good. Asked of the price as a whole,
 * because two stacks that serve the same need are spare together, not each.
 */
function canSpareSupplies(vault: OutfitterVault, supplies: readonly ContractStack[]): boolean {
  const after: Record<string, number> = { ...vault.stash.listItems() };
  for (const { itemId, quantity } of supplies) {
    if ((after[itemId] ?? 0) < quantity) {
      return false;
    }
    after[itemId] -= quantity;
  }
  const before = vault.stash.supplyShortfall();
  const remaining = Object.fromEntries(Object.entries(after).filter(([, quantity]) => quantity > 0));
  return Object.entries(new Stash({ items: remaining }).supplyShortfall()).every(
    ([itemId, shortfall]) => shortfall <= (before[itemId] ?? 0),
  );
}

/**
 * The most Pokemon one payment could take from this vault and still leave
 * somebody fit to raid. It is not simply the spendable count: when every fit
 * Pokemon at base is spendable, releasing them all would leave only the fainted
 * behind, so one of them is always held back.
 */
export function payablePokemonCount(vault: OutfitterVault): number {
  const candidates = paymentCandidates(vault);
  const spendable = candidates.filter((candidate) => candidate.refusal === undefined);
  const fit = candidates.filter((candidate) => !candidate.stored.pokemon.isFainted);
  if (fit.length === 0) {
    return 0;
  }
  const fitKeptRegardless = fit.some((candidate) => candidate.refusal !== undefined);
  return fitKeptRegardless ? spendable.length : Math.max(0, spendable.length - 1);
}

export type OutfitterOfferState ='built' | 'locked' | 'open';

export interface OutfitterOffer {
  readonly upgrade: OutfitterUpgrade;
  readonly state: OutfitterOfferState;
  /** The upgrade a locked rung is waiting on. */
  readonly requires?: OutfitterUpgrade;
  /** How many more spendable Pokemon the price needs. Zero when it is covered. */
  readonly pokemonShort: number;
  /** Supplies still short, after the protected kit is set aside. */
  readonly suppliesShort: readonly ContractStack[];
  readonly affordable: boolean;
}

/** The whole ladder as the lobby lists it, judged against this vault. */
export function outfitterOffers(
  vault: OutfitterVault,
  builtIds: readonly string[],
): readonly OutfitterOffer[] {
  const payablePokemon = payablePokemonCount(vault);

  return OUTFITTER_UPGRADES.map((upgrade) => {
    const requires = upgrade.requires === undefined ? undefined : getOutfitterUpgrade(upgrade.requires);
    const state: OutfitterOfferState = builtIds.includes(upgrade.id)
      ? 'built'
      : requires !== undefined && !builtIds.includes(requires.id)
        ? 'locked'
        : 'open';
    const pokemonShort = Math.max(0, upgrade.cost.pokemon - payablePokemon);
    const suppliesShort = upgrade.cost.supplies
      .map(({ itemId, quantity }) => ({
        itemId,
        quantity: quantity - spendableSupply(vault, itemId),
      }))
      .filter(({ quantity }) => quantity > 0);
    return {
      upgrade,
      state,
      ...(requires === undefined ? {} : { requires }),
      pokemonShort,
      suppliesShort,
      affordable:
        state === 'open' &&
        pokemonShort === 0 &&
        suppliesShort.length === 0 &&
        canSpareSupplies(vault, upgrade.cost.supplies),
    };
  });
}

export type PaymentRefusal =
  | 'unknown-upgrade'
  | 'already-built'
  | 'locked'
  | 'wrong-pokemon-count'
  | 'pokemon-not-spendable'
  | 'no-pokemon-left-fit'
  | 'supplies-short';

export type PaymentCheck =
  | { readonly ok: true; readonly upgrade: OutfitterUpgrade; readonly pokemon: readonly StashedPokemon[] }
  | { readonly ok: false; readonly refusal: PaymentRefusal; readonly message: string };

/**
 * Whether exactly this payment may be taken for this upgrade.
 *
 * The named Pokemon are part of the question, not a detail of it: the player is
 * asked to release specific Pokemon, so the check is against those and no
 * substitute is ever chosen on their behalf.
 */
export function checkPayment(
  vault: OutfitterVault,
  builtIds: readonly string[],
  upgradeId: string,
  pokemonIds: readonly string[],
): PaymentCheck {
  const upgrade = getOutfitterUpgrade(upgradeId);
  if (!upgrade) {
    return refuse('unknown-upgrade', 'The Outfitter does not build that.');
  }
  if (builtIds.includes(upgrade.id)) {
    return refuse('already-built', `${upgrade.name} is already built.`);
  }
  if (upgrade.requires !== undefined && !builtIds.includes(upgrade.requires)) {
    return refuse(
      'locked',
      `${upgrade.name} needs ${getOutfitterUpgrade(upgrade.requires)?.name ?? upgrade.requires} first.`,
    );
  }

  const named = [...new Set(pokemonIds)];
  if (named.length !== pokemonIds.length || named.length !== upgrade.cost.pokemon) {
    return refuse(
      'wrong-pokemon-count',
      `${upgrade.name} takes exactly ${upgrade.cost.pokemon} Pokémon.`,
    );
  }
  const candidates = paymentCandidates(vault);
  const pokemon: StashedPokemon[] = [];
  for (const id of named) {
    const candidate = candidates.find((entry) => entry.stored.id === id);
    if (!candidate) {
      return refuse('pokemon-not-spendable', 'One of those Pokémon is not at base.');
    }
    if (candidate.refusal !== undefined) {
      return refuse(
        'pokemon-not-spendable',
        `${candidate.stored.pokemon.base.name} cannot be spent. ${candidate.refusal}.`,
      );
    }
    pokemon.push(candidate.stored);
  }
  const leftFit = vault.stash
    .listPokemon()
    .some((entry) => !named.includes(entry.id) && !entry.pokemon.isFainted);
  if (!leftFit) {
    return refuse(
      'no-pokemon-left-fit',
      'That would leave nobody at base fit to raid. Keep at least one.',
    );
  }
  if (!canSpareSupplies(vault, upgrade.cost.supplies)) {
    return refuse('supplies-short', `Not enough spare supplies at base for ${upgrade.name}.`);
  }
  return { ok: true, upgrade, pokemon };
}

/**
 * Takes the payment out of the vault. Nothing is removed unless the whole
 * payment is valid, so a refused purchase costs nothing.
 */
export function takePayment(
  vault: OutfitterVault,
  builtIds: readonly string[],
  upgradeId: string,
  pokemonIds: readonly string[],
): PaymentCheck {
  const check = checkPayment(vault, builtIds, upgradeId, pokemonIds);
  if (!check.ok) {
    return check;
  }
  for (const { id } of check.pokemon) {
    vault.stash.removePokemon(id);
  }
  for (const { itemId, quantity } of check.upgrade.cost.supplies) {
    vault.stash.removeItem(itemId, quantity);
  }
  return check;
}

function refuse(refusal: PaymentRefusal, message: string): PaymentCheck {
  return { ok: false, refusal, message };
}
