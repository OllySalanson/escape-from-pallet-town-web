import { Bag, type BagContents } from '../items';
import { BULBASAUR, Pokemon } from '../pokemon';

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
export function createStartingStash(): Stash {
  const stash = new Stash();
  stash.addPokemon(new Pokemon(BULBASAUR, 5));
  stash.addItem('poke-ball', 5);
  stash.addItem('potion', 3);
  return stash;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}
