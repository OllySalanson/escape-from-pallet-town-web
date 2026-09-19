import { Bag, getItemById, isMaterial, type BagContents } from '../items';
import { BULBASAUR, CHARMANDER, Pokemon, SQUIRTLE, getSpeciesById, type PokemonBase } from '../pokemon';
import type { PrimaryStatus } from '../pokemon/battle/status';

export const STARTER_SPECIES = [BULBASAUR, CHARMANDER, SQUIRTLE] as const;
export type StarterSpeciesId = (typeof STARTER_SPECIES)[number]['id'];

/**
 * The supplies a player must hold to be able to attempt a real run. Every
 * recovery path tops the stash up to these counts, so a wipe can never return
 * a player to play in a state they cannot escape.
 *
 * Five Poke Balls and three Potions is deliberately the same kit a brand new
 * save is given, not a discounted one: catching is the only way to grow the
 * stash, and catch chance runs from 20% at full HP up to a 95% cap as the
 * target weakens, so five throws is what makes at least one catch near
 * certain. Three Potions is the supply every balance simulation of the raid
 * gauntlet was measured with; the same runs carrying none wipe about 99% of
 * the time even as Charmander.
 */
export const MINIMUM_SUPPLIES: Readonly<Record<string, number>> = {
  'poke-ball': 5,
  potion: 3,
};

/**
 * Whether holding `itemId` answers the need `minimumItemId` stands for. The kit
 * is a capability - a way to heal, a way to catch - so a Super Potion is a
 * Potion and a Great Ball is a Poke Ball, while an Antidote, which restores no
 * HP, is neither. Read from the item's own category and effect, so a new tier
 * of either counts the day it is added to the catalogue.
 */
function servesAs(minimumItemId: string, itemId: string): boolean {
  const needed = getItemById(minimumItemId);
  const held = getItemById(itemId);
  return (
    needed !== undefined &&
    held !== undefined &&
    needed.category === held.category &&
    needed.effect.type === held.effect.type
  );
}

export function getStarterSpecies(starterId: StarterSpeciesId): PokemonBase {
  return STARTER_SPECIES.find((species) => species.id === starterId) ?? BULBASAUR;
}

export interface StashedPokemon {
  readonly id: string;
  readonly pokemon: Pokemon;
}

export interface StashContents {
  readonly pokemon: readonly StashedPokemon[];
  readonly items: BagContents;
}

/**
 * The extraction manager passes this shape to bankRun. A completed run contains
 * only Pokemon that survived to extraction and every item found during the run.
 */
export interface RunResult {
  readonly pokemon: readonly Pokemon[];
  readonly items: readonly { readonly itemId: string; readonly quantity: number }[];
}

/** A quantity of one item. Negative quantities are only legal in a supply delta. */
export interface StashItemChange {
  readonly itemId: string;
  readonly quantity: number;
}

/**
 * How one deployed Pokemon came out of a raid, addressed by its stash ID.
 *
 * The raid mutates the stash's own Pokemon objects, but every write-back path
 * reloads the vault from storage first, so those mutations are discarded unless
 * they are carried across explicitly. This is that carriage.
 */
export interface RaidCondition {
  readonly id: string;
  readonly currentHp: number;
  readonly primaryStatus: PrimaryStatus | null;
  /**
   * The species it came home as. A level evolution needs no help from this -
   * replaying the experience below crosses the same level and evolves the
   * stored Pokemon exactly as the field did - but a stone spends no experience
   * at all, so without this a Thunder Stone found, carried and used in a raid
   * would be a Raichu at the extraction pad and a Pikachu in the vault.
   *
   * Optional, because a settlement written before stones existed has no opinion
   * about species, and `Pokemon.evolveInto` refuses anything that is not
   * further along the same line, so a stale or corrupt one is a no-op rather
   * than a Pokemon swap.
   */
  readonly speciesId?: string;
  /**
   * The Pokemon's total experience at the end of the raid, absolute rather than
   * a delta so applying a settlement twice cannot pay a win out twice.
   *
   * Level is deliberately not carried alongside it: it is a function of
   * experience through the one curve in `experienceForLevel`, and two stored
   * numbers for one fact are two answers waiting to disagree.
   */
  readonly experience: number;
}

/**
 * What a finished raid did to the vault, independently of how it ended.
 *
 * `condition` is the state every deployed Pokemon came home in. `supplies` is a
 * signed delta - what came out of the raid minus what went into it - so spent
 * Potions and thrown Poke Balls are negative and loot picked up in the field is
 * positive, in one pass and with no double counting between the two.
 */
export interface RaidSettlement {
  readonly condition: readonly RaidCondition[];
  readonly supplies: readonly StashItemChange[];
}

export interface SecureSlot {
  /** Stashed Pokemon IDs, as many as the save's secure slot protects. */
  readonly pokemonIds?: readonly string[];
  /**
   * Protected item stacks, as many as the save's secure slot protects.
   * Quantities are capped to the matching quantity actually brought into the run.
   */
  readonly items?: readonly { readonly itemId: string; readonly quantity: number }[];
}

/**
 * How much a save's secure slot protects. It belongs to the save rather than to
 * this class - contracts and the Outfitter both enlarge it - so a wipe is told
 * the limits instead of assuming them.
 */
export interface SecureSlotLimits {
  readonly pokemon: number;
  readonly itemStacks: number;
}

/** The secure slot every save starts with: one Pokemon and two item stacks. */
export const BASE_SECURE_SLOT_LIMITS: SecureSlotLimits = { pokemon: 1, itemStacks: 2 };

/**
 * The persistent vault. Its methods only change in-memory state; persistence is
 * deliberately handled by SaveManager so the model remains easy to test.
 */
export class Stash {
  private readonly storedPokemon: StashedPokemon[];
  private readonly bag: Bag;

  public constructor(contents: Partial<StashContents> = {}) {
    this.storedPokemon = [...(contents.pokemon ?? [])];
    this.bag = new Bag(contents.items);
  }

  public listPokemon(): readonly StashedPokemon[] {
    return [...this.storedPokemon];
  }

  public listItems(): BagContents {
    return this.bag.toJSON();
  }

  public itemCount(itemId: string): number {
    return this.bag.count(itemId);
  }

  public addPokemon(pokemon: Pokemon, id = this.nextPokemonId(pokemon)): string {
    if (this.storedPokemon.some((stored) => stored.id === id)) {
      throw new Error(`A Pokemon with stash ID "${id}" already exists.`);
    }

    this.storedPokemon.push({ id, pokemon });
    return id;
  }

  public removePokemon(id: string): Pokemon | null {
    const index = this.storedPokemon.findIndex((stored) => stored.id === id);
    if (index < 0) {
      return null;
    }

    return this.storedPokemon.splice(index, 1)[0].pokemon;
  }

  /**
   * Restores one stashed Pokemon to full HP and clears its status, reviving it
   * when it came home fainted. This is the only way HP returns outside a Potion,
   * and it is deliberately not free: the price is raid time, charged by
   * `applyRecovery()` in `../hub/recovery`. Nothing is created or consumed here,
   * so a recovery can never move an item or a Pokemon in or out of the vault.
   *
   * @returns Whether anything actually changed.
   */
  public recoverPokemon(id: string): boolean {
    const stored = this.storedPokemon.find((entry) => entry.id === id);
    if (!stored) {
      return false;
    }

    const healedHp = stored.pokemon.heal();
    const curedStatus = stored.pokemon.primaryStatus !== null;
    stored.pokemon.primaryStatus = null;
    return healedHp > 0 || curedStatus;
  }

  /**
   * Writes the condition every deployed Pokemon came home in back onto the
   * matching stash entry: what the raid cost it, and what it earned. Damage,
   * faints and lingering status survive the raid that caused them, which is
   * what makes a raid cost anything at all - and the experience survives it
   * too, which is what makes winning one worth anything at all.
   *
   * Experience is replayed through `gainExperience` rather than assigned, so a
   * level crossed in the field arrives here with the stats and the learned move
   * that come with it instead of a level number the rest of the Pokemon
   * disagrees with. It is applied before the HP, because levelling raises max
   * HP and the raid's own current HP is already measured against the raised
   * one.
   *
   * Nothing is created, removed or healed here: unknown IDs are ignored, the HP
   * written is clamped into the Pokemon's own range and experience can only
   * move forwards, so a corrupt or stale settlement can only ever be a no-op.
   */
  public applyRaidCondition(condition: readonly RaidCondition[]): void {
    for (const entry of condition) {
      const stored = this.storedPokemon.find((candidate) => candidate.id === entry.id);
      if (!stored) {
        continue;
      }
      stored.pokemon.gainExperience(experienceGain(entry.experience, stored.pokemon.experience));
      // After the experience, because a level crossed in the field may already
      // have evolved it - and then this is the no-op it should be. Before the
      // HP, for the same reason a level is: evolving raises the maximum the
      // raid's own current HP was measured against.
      const species = entry.speciesId ? getSpeciesById(entry.speciesId) : undefined;
      if (species) {
        stored.pokemon.evolveInto(species);
      }
      stored.pokemon.currentHp = clampHp(entry.currentHp, stored.pokemon.maxHp);
      stored.pokemon.primaryStatus = entry.primaryStatus;
    }
  }

  /**
   * Applies a raid's signed supply delta: supplies spent in the field leave the
   * vault, loot found there arrives in it. A removal is capped at what the
   * vault actually holds, so the delta can never drive a count negative.
   */
  public applyRaidSupplies(supplies: readonly StashItemChange[]): void {
    for (const { itemId, quantity } of supplies) {
      if (!Number.isInteger(quantity) || quantity === 0) {
        continue;
      }
      if (quantity > 0) {
        this.addItem(itemId, quantity);
        continue;
      }
      this.removeItem(itemId, Math.min(-quantity, this.itemCount(itemId)));
    }
  }

  public addItem(itemId: string, quantity = 1): boolean {
    return this.bag.add(itemId, quantity);
  }

  public removeItem(itemId: string, quantity = 1): boolean {
    return this.bag.remove(itemId, quantity);
  }

  /**
   * Restores the minimum resources needed to begin a run when no Pokemon
   * remain: a fresh starter, plus a top-up to MINIMUM_SUPPLIES. Existing
   * Pokemon are never changed and no item is ever taken away.
   *
   * @returns Whether a starter was granted.
   */
  public ensurePlayable(starter = BULBASAUR): boolean {
    if (this.storedPokemon.length > 0) {
      return false;
    }

    this.addPokemon(new Pokemon(starter, 5));
    this.restockMinimumSupplies();
    return true;
  }

  /**
   * How far short of MINIMUM_SUPPLIES the vault is, per kit item. Empty when
   * the player can attempt a raid on what they already hold.
   *
   * Anything that does the same job counts towards a line, so a vault of Super
   * Potions is not short of Potions. Counting the named item alone handed a
   * well-stocked player three free Potions on every wipe - the opposite of a
   * last resort.
   */
  public supplyShortfall(): Readonly<Record<string, number>> {
    const held = Object.entries(this.listItems());
    const shortfall: Record<string, number> = {};
    for (const [minimumItemId, minimum] of Object.entries(MINIMUM_SUPPLIES)) {
      const serving = held
        .filter(([itemId]) => servesAs(minimumItemId, itemId))
        .reduce((total, [, quantity]) => total + quantity, 0);
      if (serving < minimum) {
        shortfall[minimumItemId] = minimum - serving;
      }
    }
    return shortfall;
  }

  /**
   * How many of one item could leave the vault without the restock having
   * anything to hand back for it. The kit is a capability, so this is asked of
   * everything that serves the same need: six Potions and no Super Potions is
   * three spare, and so is three Potions beside three Super Potions. An item
   * that serves no minimum - an Antidote - is spare in full.
   *
   * It exists for the Outfitter, the one place supplies are spent at base: a
   * payment taken out of the kit would be refunded by the next wipe.
   */
  public spareCount(itemId: string): number {
    const held = this.itemCount(itemId);
    const serving = Object.entries(this.listItems());
    let spare = held;
    for (const [minimumItemId, minimum] of Object.entries(MINIMUM_SUPPLIES)) {
      if (!servesAs(minimumItemId, itemId)) {
        continue;
      }
      const total = serving
        .filter(([heldItemId]) => servesAs(minimumItemId, heldItemId))
        .reduce((sum, [, quantity]) => sum + quantity, 0);
      spare = Math.min(spare, Math.max(0, total - minimum));
    }
    return spare;
  }

  /**
   * The last resort, not a standing allowance: it fires only for a player who
   * cannot attempt a raid on what they hold, and hands over only the shortfall,
   * so a player who kept supplies keeps exactly what they had and the restock
   * cannot be farmed by wiping on purpose. Nothing is ever removed, and
   * unrelated items the player kept are left alone.
   *
   * The kit is the same for every save. A banked contract used to raise it,
   * which turned a reward into a subscription: supplies the player never had to
   * bring home, refilled on every wipe, are supplies no extraction can make
   * feel earned.
   *
   * @returns Whether anything was added.
   */
  public restockMinimumSupplies(): boolean {
    let restocked = false;
    for (const [itemId, shortfall] of Object.entries(this.supplyShortfall())) {
      if (this.addItem(itemId, shortfall)) {
        restocked = true;
      }
    }
    return restocked;
  }

  /**
   * Whether the vault is down to a single Pokemon, the only state in which the
   * player may re-specialise into another starter.
   */
  public canSwapStarter(): boolean {
    return this.storedPokemon.length === 1;
  }

  /**
   * Trades the sole remaining Pokemon for a level-5 starter, so a player
   * recovering from a wipe can change species instead of being locked to one.
   * Refused while two or more Pokemon remain, so a team can never be discarded.
   *
   * A swap is a change of species and nothing else. The newcomer arrives in the
   * condition the old partner left in (`starterInConditionOf`), and no supplies
   * come with it: a partner home at 1 HP with no Potions used to be traded for
   * a full-health one and a full kit, which priced the recovery bay at nothing.
   * A wiped player loses no guarantee by it - the wipe itself restocked the kit
   * before the swap was ever on offer.
   *
   * @returns Whether the swap happened.
   */
  public swapStarter(starter: PokemonBase): boolean {
    const outgoing = this.storedPokemon[0];
    if (!this.canSwapStarter() || !outgoing) {
      return false;
    }

    const incoming = starterInConditionOf(outgoing.pokemon, starter);
    this.storedPokemon.length = 0;
    this.addPokemon(incoming);
    return true;
  }

  public bankRun(result: RunResult): void {
    for (const pokemon of result.pokemon) {
      this.addPokemon(pokemon);
    }
    for (const { itemId, quantity } of result.items) {
      this.addItem(itemId, quantity);
    }
  }

  /**
   * Permanently removes every Pokemon deployed for a wiped run, except the
   * secured ones. Removes deployed item quantities except the secured stacks.
   * Both are cut to `limits`, and invalid or unavailable secure-slot entries do
   * not protect anything.
   *
   * The limits used to be a literal two stacks here, which silently destroyed
   * the third stack the cordon ledger pays for while the result screen beside
   * it reported that stack as safe.
   */
  public applyWipeLoss(
    broughtPokemonIds: readonly string[],
    broughtItems: readonly { readonly itemId: string; readonly quantity: number }[],
    secureSlot: SecureSlot = {},
    limits: SecureSlotLimits = BASE_SECURE_SLOT_LIMITS,
  ): void {
    const protectedPokemonIds = new Set(
      [...new Set(secureSlot.pokemonIds ?? [])]
        .filter((pokemonId) => broughtPokemonIds.includes(pokemonId))
        .slice(0, Math.max(0, limits.pokemon)),
    );
    for (const pokemonId of new Set(broughtPokemonIds)) {
      if (!protectedPokemonIds.has(pokemonId)) {
        this.removePokemon(pokemonId);
      }
    }

    const securedItems = new Map<string, number>();
    for (const item of (secureSlot.items ?? []).slice(0, Math.max(0, limits.itemStacks))) {
      if (isPositiveInteger(item.quantity)) {
        securedItems.set(item.itemId, (securedItems.get(item.itemId) ?? 0) + item.quantity);
      }
    }
    for (const { itemId, quantity } of broughtItems) {
      if (!isPositiveInteger(quantity)) {
        continue;
      }
      const protectedQuantity = Math.min(quantity, securedItems.get(itemId) ?? 0);
      securedItems.set(itemId, Math.max(0, (securedItems.get(itemId) ?? 0) - protectedQuantity));
      this.removeItem(itemId, quantity - protectedQuantity);
    }
    // A material is found rather than brought, so the loop above never met it:
    // the slot names its kind and the caller has already cut the quantity to
    // what was still in the pack, which is the only place this stash learns it.
    for (const [itemId, quantity] of securedItems) {
      if (isMaterial(itemId) && !broughtItems.some((item) => item.itemId === itemId) && quantity > 0) {
        this.addItem(itemId, quantity);
      }
    }
  }

  public toJSON(): StashContents {
    return { pokemon: this.listPokemon(), items: this.listItems() };
  }

  private nextPokemonId(pokemon: Pokemon): string {
    const prefix = pokemon.base.id;
    let number = 1;
    while (this.storedPokemon.some((stored) => stored.id === `${prefix}-${number}`)) {
      number += 1;
    }
    return `${prefix}-${number}`;
  }
}

/**
 * The level-5 starter a swap hands over for `outgoing`: the same share of its
 * health, rounded down so trading back and forth can only ever lose HP, and the
 * same status. A partner still standing arrives standing - a swap cannot faint
 * a Pokemon - and a fainted one arrives fainted, so the revive is still owed.
 *
 * Exported so the swap screen previews exactly what the stash will hold.
 */
export function starterInConditionOf(outgoing: Pokemon, starter: PokemonBase): Pokemon {
  const incoming = new Pokemon(starter, 5);
  const carriedHp = outgoing.isFainted
    ? 0
    : Math.max(1, Math.floor((incoming.maxHp * outgoing.currentHp) / outgoing.maxHp));
  incoming.takeDamage(incoming.maxHp - carriedHp);
  incoming.primaryStatus = outgoing.primaryStatus;
  return incoming;
}

/** Provides a playable first vault for a player with no existing save. */
export function createStartingStash(starter = BULBASAUR): Stash {
  const stash = new Stash();
  stash.ensurePlayable(starter);
  return stash;
}

/**
 * How much experience a settlement still owes a stashed Pokemon: the total it
 * reached in the raid, less the total the vault already recorded for it.
 *
 * Never negative, so re-applying a settlement - or applying a stale one written
 * before a level the vault has since banked - cannot demote a Pokemon.
 */
function experienceGain(raidExperience: number, storedExperience: number): number {
  if (!Number.isFinite(raidExperience)) {
    return 0;
  }
  return Math.max(0, Math.floor(raidExperience) - storedExperience);
}

function clampHp(value: number, maxHp: number): number {
  if (!Number.isFinite(value)) {
    return maxHp;
  }
  return Math.min(maxHp, Math.max(0, Math.floor(value)));
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}
