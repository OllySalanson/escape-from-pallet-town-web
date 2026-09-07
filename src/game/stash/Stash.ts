import { Bag, type BagContents } from '../items';
import { BULBASAUR, CHARMANDER, Pokemon, SQUIRTLE, type PokemonBase } from '../pokemon';

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

export interface SecureSlot {
  /** At most one stashed Pokemon ID. */
  readonly pokemonId?: string;
  /**
   * At most two item stacks. Quantities are capped to the matching quantity
   * actually brought into the run.
   */
  readonly items?: readonly { readonly itemId: string; readonly quantity: number }[];
}

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
   * Tops the vault up to MINIMUM_SUPPLIES. Only the shortfall is added, so a
   * player who kept supplies keeps exactly what they had and the restock
   * cannot be farmed by wiping on purpose. Nothing is ever removed, and
   * unrelated items the player kept are left alone.
   *
   * @returns Whether anything was added.
   */
  public restockMinimumSupplies(): boolean {
    let restocked = false;
    for (const [itemId, minimum] of Object.entries(MINIMUM_SUPPLIES)) {
      const shortfall = minimum - this.itemCount(itemId);
      if (shortfall > 0 && this.addItem(itemId, shortfall)) {
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
   * Trades the sole remaining Pokemon for a fresh level-5 starter, so a player
   * recovering from a wipe can change species instead of being locked to one.
   * Refused while two or more Pokemon remain, so a team can never be discarded.
   *
   * @returns Whether the swap happened.
   */
  public swapStarter(starter: PokemonBase): boolean {
    if (!this.canSwapStarter()) {
      return false;
    }

    this.storedPokemon.length = 0;
    this.addPokemon(new Pokemon(starter, 5));
    // The swap is only ever reachable while recovering, so it carries the same
    // supply guarantee as a re-grant.
    this.restockMinimumSupplies();
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
   * optional secured Pokemon. Removes deployed item quantities except the
   * optional first two secure item stacks. Invalid or unavailable secure-slot
   * entries do not protect anything.
   */
  public applyWipeLoss(
    broughtPokemonIds: readonly string[],
    broughtItems: readonly { readonly itemId: string; readonly quantity: number }[],
    secureSlot: SecureSlot = {},
  ): void {
    const protectedPokemonId =
      secureSlot.pokemonId && broughtPokemonIds.includes(secureSlot.pokemonId)
        ? secureSlot.pokemonId
        : undefined;
    for (const pokemonId of new Set(broughtPokemonIds)) {
      if (pokemonId !== protectedPokemonId) {
        this.removePokemon(pokemonId);
      }
    }

    const securedItems = new Map<string, number>();
    for (const item of (secureSlot.items ?? []).slice(0, 2)) {
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

/** Provides a playable first vault for a player with no existing save. */
export function createStartingStash(starter = BULBASAUR): Stash {
  const stash = new Stash();
  stash.ensurePlayable(starter);
  return stash;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}
