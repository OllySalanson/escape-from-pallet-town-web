import type { SupplyItemId } from '../items';
import type { ContractStack } from '../objectives/contracts';
import { Stash } from '../stash';

/**
 * Brock's Workshop: permanent upgrades to the lab, paid for out of the vault.
 *
 * Brock is the practical one, which is why the workshop is his. He is blunt,
 * competent and unimpressed by your salvage until it is the *right* salvage,
 * and he builds - he does not deal. That line between him and Bill at the quay
 * is load-bearing and `./trader` states it in one sentence.
 *
 * The stash was a savings account with no withdrawals: supplies arrived faster
 * than raids spent them, so nothing a player banked changed anything. This is
 * the withdrawal, a ladder of base capability bought with **materials** -
 * radio valves, cable, lamp oil and the like - and nothing else. Never potions,
 * balls or antidotes: those are the raid's own stock, and a ladder priced in
 * them competed with staying alive. A material has no use anywhere else
 * (`../items`), is found only in the field, is lost with the pack on a wipe
 * unless the secure slot names it, and leaves the game only here, so it is a
 * sink-feeder and not a second economy.
 *
 * And never Pokemon, though it was until 2026-10-12 (the captain's answer to
 * playtest 42, option A). Every rung cost one to four Pokemon the player named,
 * and a wipe takes the team: so the raid that cost a player their team also
 * froze the base, because the Pokemon were the base's currency as well. Eleven
 * raids built none of seven rungs with materials to spare, and a ladder that
 * wanted seventeen Pokemon released asked the player to catch things to throw
 * away. Every Pokemon a rung asked for became one more unit of the material it
 * is about, so the sink is as deep as it was.
 *
 * It is a sink, not a shop. There is no currency, no vendor and no goods: it
 * never hands back an item or a Pokemon, only capability or information, and
 * never raw power - nothing here makes a Pokemon hit harder.
 *
 * It builds the *base*, and only the base. The raid pack is deliberately not on
 * this ladder and can never be: a pack is gear a player owns, chooses and loses
 * (`../items/packs`), and a workshop rung is permanent and cannot be lost, so
 * a rung that grew the pack would have quietly made the one container a wipe
 * destroys into one it could not.
 *
 * Like a contract's reward, an upgrade is never stored beside its effect. The
 * save records which upgrades were built (`raidProgress.workshopUpgrades`) and
 * every effect is derived from that list by the owner that already existed:
 * secure slots in `../objectives/contracts`, healing prices in `./recovery`,
 * the hunter line in `../scenes/raidHud`, the beacon in
 * `../run/runGeneration`. A save can therefore never disagree with the ladder.
 *
 * Everything here is a pure function over the stash, so the rules about what
 * may be spent are testable without Phaser; `HubScene` only renders them and
 * `SaveManager.buildWorkshopUpgrade()` is the one path that spends.
 */

export interface WorkshopCost {
  /** The materials the rung takes out of the vault. Never a Pokemon (see above). */
  readonly supplies: readonly ContractStack[];
}

export interface WorkshopUpgrade {
  readonly id: string;
  readonly name: string;
  /**
   * What it does, in the one short line the ladder has room for. It is the
   * rung's own line on the ladder, built or not: what a thing does is its
   * identity, and identity does not change when you pay for it.
   */
  readonly effect: string;
  /**
   * What `effect` leaves out, read in the pane under the ladder and again on
   * the payment screen. Never a restatement of `effect`, which is printed
   * directly above it.
   */
  readonly detail: string;
  /** One of the shared 16x16 icons in `../ui/icons`, by file name. */
  readonly icon: string;
  /** The upgrade that must already stand before this one is offered. */
  readonly requires?: string;
  readonly cost: WorkshopCost;
  /** Adds one column to the secure container. */
  readonly secureItemStack?: boolean;
  /** Adds one protected Pokemon to the secure slot. */
  readonly securePokemon?: boolean;
  /**
   * The share of every listed Pokemon Center price still charged once this
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
 * Prices are set against what a raid actually banks rather than felt. Each
 * map's loot pool lays three to nine units of material a raid across the whole
 * map, a named cache pays one or two of its own place's, and a standing
 * contract pays one to three (`../worldMap`, `../world/pois`,
 * `../objectives/standingBoard`); a raid that goes out and comes back carries
 * home two or three. The whole ladder is thirty-seven units, the twenty it
 * cost beside its Pokemon and one more for every Pokemon it used to ask, so the
 * first rung is a couple of good raids away and the whole base fifteen or so,
 * which is what the Pokemon half used to make it. Information is cheapest, the
 * two capabilities that change the loadout decision are mid-priced, and the
 * second protected Pokemon - the strongest thing on the list - costs the most.
 * `workshop.test.ts` holds the order, and that the ladder is not cheaper than
 * it was.
 */
export const WORKSHOP_UPGRADES: readonly WorkshopUpgrade[] = [
  {
    id: 'radio-mast',
    icon: 'radio-mast',
    name: 'Radio mast',
    effect: 'The hunter’s team, on the raid HUD.',
    detail:
      'The raid HUD names the hunter’s current team and counts down to the next, stronger one. Information only: the hunter is not slowed.',
    cost: {
      supplies: [
        { itemId: 'radio-valve', quantity: 3 },
        { itemId: 'mooring-rope', quantity: 1 },
      ],
    },
    hunterIntel: true,
  },
  {
    id: 'beacon',
    icon: 'extraction-open',
    name: 'Beacon',
    effect: 'Your landing is a late extra exit.',
    detail: 'It marks where you land on every map, and opens halfway through the raid clock.',
    cost: {
      supplies: [
        { itemId: 'lamp-oil', quantity: 4 },
        { itemId: 'cable-coil', quantity: 3 },
      ],
    },
    beacon: true,
  },
  {
    id: 'secure-locker-1',
    icon: 'supply-crate',
    name: 'Secure locker I',
    effect: 'One more column of the secure container.',
    detail: 'More of what you carry comes home from every raid - even a lost one.',
    cost: {
      supplies: [{ itemId: 'parts-crate', quantity: 4 }],
    },
    secureItemStack: true,
  },
  {
    id: 'secure-locker-2',
    icon: 'supply-crate',
    name: 'Secure locker II',
    effect: 'A second protected Pokémon, and the room for it.',
    detail:
      'A Pokémon takes four squares, so the slot alone would have been a promise the container could not keep: it brings a column with it.',
    requires: 'secure-locker-1',
    cost: {
      supplies: [
        { itemId: 'parts-crate', quantity: 4 },
        { itemId: 'mooring-rope', quantity: 4 },
      ],
    },
    securePokemon: true,
    // Both, and it has to be both: two first-stage Pokemon are eight squares,
    // which is exactly a 4x2 container - locker I's one column and this one's.
    secureItemStack: true,
  },
  {
    // The two ids below still read `recovery-bay`: an id is what the save
    // file holds (`raidProgress.workshopUpgrades`), so it is wire format and
    // not a name anybody reads. Renaming one would quietly un-build it on
    // every existing save, which is a worse price than a stale word.
    id: 'recovery-bay-1',
    icon: 'super-potion',
    name: 'Healing machine I',
    effect: 'Treatment prices drop a quarter.',
    detail: 'Brock fits the Center with a better machine: every price Nurse Joy quotes - healing, curing and reviving - costs a quarter less raid time.',
    cost: { supplies: [{ itemId: 'linen-roll', quantity: 4 }] },
    recoveryPriceShare: 0.75,
  },
  {
    id: 'recovery-bay-2',
    icon: 'super-potion',
    name: 'Healing machine II',
    effect: 'Treatment prices drop to half.',
    detail: 'A second machine beside the first: every price Nurse Joy quotes costs half the raid time it started at.',
    requires: 'recovery-bay-1',
    cost: {
      supplies: [
        { itemId: 'linen-roll', quantity: 4 },
        { itemId: 'cable-coil', quantity: 2 },
      ],
    },
    recoveryPriceShare: 0.5,
  },
  {
    id: 'quarantine-ward',
    icon: 'antidote',
    name: 'Quarantine ward',
    effect: 'One heal per raid, free of clock.',
    detail:
      'Once per raid, Nurse Joy heals and cures one Pokémon free of clock - whoever it saves the most on. A revive still costs its premium.',
    cost: {
      supplies: [
        { itemId: 'linen-roll', quantity: 2 },
        { itemId: 'lamp-oil', quantity: 2 },
      ],
    },
    wardTreatments: 1,
  },
];

export function getWorkshopUpgrade(id: string): WorkshopUpgrade | undefined {
  return WORKSHOP_UPGRADES.find((upgrade) => upgrade.id === id);
}

/** Every built upgrade the ladder still knows, once each, in ladder order. */
export function builtUpgrades(builtIds: readonly string[]): readonly WorkshopUpgrade[] {
  return WORKSHOP_UPGRADES.filter((upgrade) => builtIds.includes(upgrade.id));
}

/** Columns Brock has added to the secure container. */
export function workshopSecureItemStacks(builtIds: readonly string[]): number {
  return builtUpgrades(builtIds).filter((upgrade) => upgrade.secureItemStack).length;
}

/** Protected Pokemon Brock has added to the secure slot. */
export function workshopSecurePokemon(builtIds: readonly string[]): number {
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
 * What the standing board pays in once the whole ladder stands. Materials have
 * no other use, so a finished base is paid in the raid's own supplies, exactly
 * as it was before materials existed - no new faucet, only the old one kept.
 */
export const FINISHED_BASE_PAY: readonly SupplyItemId[] = ['antidote', 'great-ball', 'poke-ball', 'potion', 'super-potion'];

/**
 * The materials the ladder is still asking for: every kind an unbuilt rung
 * costs, once each, in ladder order. It is what the standing board pays in, so
 * a reward is always something the player has a use for. Once the whole ladder
 * stands nothing wants a material any more, and the board pays in supplies.
 */
export function workshopMaterialKinds(builtIds: readonly string[]): readonly SupplyItemId[] {
  const outstanding = [
    ...new Set(
      WORKSHOP_UPGRADES.filter((upgrade) => !builtIds.includes(upgrade.id)).flatMap((upgrade) =>
        upgrade.cost.supplies.map(({ itemId }) => itemId),
      ),
    ),
  ];
  return outstanding.length > 0 ? outstanding : FINISHED_BASE_PAY;
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
export interface WorkshopVault {
  readonly stash: Stash;
}

/**
 * How many of one supply Brock may take from this vault: whatever is
 * above the kit base restocks after a wipe. Spending into that kit would be
 * refunded by the next wipe, which would make wiping a way to build a base for
 * nothing. The kit is `Stash`'s rule, so this only asks it.
 */
export function spendableSupply(vault: WorkshopVault, itemId: string): number {
  return vault.stash.spareCount(itemId);
}

/**
 * Whether the whole supply price can leave the vault without deepening any
 * shortfall the restock would then make good. Asked of the price as a whole,
 * because two stacks that serve the same need are spare together, not each.
 */
function canSpareSupplies(vault: WorkshopVault, supplies: readonly ContractStack[]): boolean {
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

export type WorkshopOfferState ='built' | 'locked' | 'open';

export interface WorkshopOffer {
  readonly upgrade: WorkshopUpgrade;
  readonly state: WorkshopOfferState;
  /** The upgrade a locked rung is waiting on. */
  readonly requires?: WorkshopUpgrade;
  /** Supplies still short, after the protected kit is set aside. */
  readonly suppliesShort: readonly ContractStack[];
  readonly affordable: boolean;
}

/** The whole ladder as the lobby lists it, judged against this vault. */
export function workshopOffers(
  vault: WorkshopVault,
  builtIds: readonly string[],
): readonly WorkshopOffer[] {
  return WORKSHOP_UPGRADES.map((upgrade) => {
    const requires = upgrade.requires === undefined ? undefined : getWorkshopUpgrade(upgrade.requires);
    const state: WorkshopOfferState = builtIds.includes(upgrade.id)
      ? 'built'
      : requires !== undefined && !builtIds.includes(requires.id)
        ? 'locked'
        : 'open';
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
      suppliesShort,
      affordable:
        state === 'open' &&
        suppliesShort.length === 0 &&
        canSpareSupplies(vault, upgrade.cost.supplies),
    };
  });
}

export type PaymentRefusal = 'unknown-upgrade' | 'already-built' | 'locked' | 'supplies-short';

export type PaymentCheck =
  | { readonly ok: true; readonly upgrade: WorkshopUpgrade }
  | { readonly ok: false; readonly refusal: PaymentRefusal; readonly message: string };

/** Whether this upgrade may be paid for out of this vault now. */
export function checkPayment(
  vault: WorkshopVault,
  builtIds: readonly string[],
  upgradeId: string,
): PaymentCheck {
  const upgrade = getWorkshopUpgrade(upgradeId);
  if (!upgrade) {
    return refuse('unknown-upgrade', 'Brock does not build that.');
  }
  if (builtIds.includes(upgrade.id)) {
    return refuse('already-built', `${upgrade.name} is already built.`);
  }
  if (upgrade.requires !== undefined && !builtIds.includes(upgrade.requires)) {
    return refuse(
      'locked',
      `${upgrade.name} needs ${getWorkshopUpgrade(upgrade.requires)?.name ?? upgrade.requires} first.`,
    );
  }
  if (!canSpareSupplies(vault, upgrade.cost.supplies)) {
    return refuse('supplies-short', `Not enough spare materials at base for ${upgrade.name}.`);
  }
  return { ok: true, upgrade };
}

/**
 * Takes the payment out of the vault. Nothing is removed unless the whole
 * payment is valid, so a refused purchase costs nothing.
 */
export function takePayment(
  vault: WorkshopVault,
  builtIds: readonly string[],
  upgradeId: string,
): PaymentCheck {
  const check = checkPayment(vault, builtIds, upgradeId);
  if (!check.ok) {
    return check;
  }
  for (const { itemId, quantity } of check.upgrade.cost.supplies) {
    vault.stash.removeItem(itemId, quantity);
  }
  return check;
}

function refuse(refusal: PaymentRefusal, message: string): PaymentCheck {
  return { ok: false, refusal, message };
}
