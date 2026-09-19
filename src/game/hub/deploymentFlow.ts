import { isMaterial, SECURED_MATERIAL_QUANTITY, type ItemId } from '../items';
import { BASE_SECURE_ITEM_STACKS, BASE_SECURE_POKEMON } from '../objectives/contracts';
import type { ItemStack, SecureSlot as RunSecureSlot } from '../run';
import type { RunInsertionId } from '../run/runGeneration';
import type { SecureSlot as StashSecureSlot, Stash, StashedPokemon } from '../stash';

export const MAX_RUN_PARTY = 6;
/** The secure slot every save starts with; the cordon ledger adds to it. */
export const MAX_SECURE_ITEM_STACKS = BASE_SECURE_ITEM_STACKS;

/** What this save's secure slot protects; contracts and the Outfitter enlarge it. */
export interface SecureSlotCapacity {
  readonly pokemon: number;
  readonly itemStacks: number;
}

export const BASE_SECURE_SLOT_CAPACITY: SecureSlotCapacity = {
  pokemon: BASE_SECURE_POKEMON,
  itemStacks: BASE_SECURE_ITEM_STACKS,
};

/**
 * Preparation is a route, not a screen: a player picks what to risk, may detour
 * into the secure slot, and only then reaches the confirmation that starts the
 * raid. `deploy()` refuses to hand anything back from an earlier step, so a raid
 * can never begin with a loadout the player did not look at and confirm.
 */
export type DeploymentStep = 'loadout' | 'secure' | 'confirm';

/** Everything a confirmed plan hands to the run manager and the raid scene. */
export interface Deployment {
  readonly insertionId: RunInsertionId;
  readonly party: readonly StashedPokemon[];
  readonly items: readonly ItemStack[];
  readonly secureSlot: RunSecureSlot;
  readonly stashSecureSlot: StashSecureSlot;
}

export class DeploymentFlow {
  private readonly stash: Stash;
  private selectedPokemonIds: string[] = [];
  private readonly selectedItems = new Map<ItemId, number>();
  private securedPokemonIds: string[] = [];
  private securedItemIds: ItemId[] = [];
  private insertion: RunInsertionId;
  private currentStep: DeploymentStep = 'loadout';
  private secureReturn: Exclude<DeploymentStep, 'secure'> = 'loadout';
  /** How many item stacks this save's secure slot protects. */
  public readonly secureItemStacks: number;
  /** How many Pokemon it protects. */
  public readonly securePokemonSlots: number;

  public constructor(
    stash: Stash,
    insertionId: RunInsertionId = 'floodplain-relay',
    capacity: SecureSlotCapacity = BASE_SECURE_SLOT_CAPACITY,
  ) {
    this.stash = stash;
    this.insertion = insertionId;
    this.secureItemStacks = capacity.itemStacks;
    this.securePokemonSlots = capacity.pokemon;
  }

  public get step(): DeploymentStep {
    return this.currentStep;
  }

  /** Where leaving the secure slot returns to, so the back control can name it. */
  public get secureReturnStep(): Exclude<DeploymentStep, 'secure'> {
    return this.secureReturn;
  }

  public get insertionId(): RunInsertionId {
    return this.insertion;
  }

  /** The chosen Pokemon, in selection order, resolved against the live stash. */
  public get party(): readonly StashedPokemon[] {
    return this.selectedPokemonIds
      .map((id) => this.stash.listPokemon().find((stored) => stored.id === id))
      .filter((stored): stored is StashedPokemon => stored !== undefined);
  }

  /**
   * The chosen supplies, resolved against the live stash exactly as the party
   * is. Treating a Pokemon at base spends items out of the same vault this
   * loadout is drawn from, so a stack the stash no longer holds shrinks here
   * rather than deploying supplies that no longer exist.
   */
  public get items(): readonly ItemStack[] {
    return [...this.selectedItems]
      .map(([itemId, quantity]) => ({
        itemId,
        quantity: Math.min(quantity, this.stash.itemCount(itemId)),
      }))
      .filter((item) => item.quantity > 0);
  }

  /** The protected Pokemon, in party order, resolved against the live party. */
  public get securedPokemon(): readonly StashedPokemon[] {
    return this.party.filter((stored) => this.securedPokemonIds.includes(stored.id));
  }

  /**
   * The protected stacks: loadout supplies the player chose to protect, and any
   * material kind they named. A material is never packed - it is found - so its
   * stack carries the slot's own cap and the pack decides how much is kept.
   */
  public get securedItems(): readonly ItemStack[] {
    return [
      ...this.items.filter((item) => this.securedItemIds.includes(item.itemId)),
      ...this.securedItemIds
        .filter((itemId) => isMaterial(itemId))
        .map((itemId) => ({ itemId, quantity: SECURED_MATERIAL_QUANTITY })),
    ];
  }

  /**
   * A fainted Pokemon cannot fight, so a loadout of nothing but fainted Pokemon
   * is not a raid, it is a wipe with extra steps. Recovering it at base is the
   * way out - see `../hub/recovery`.
   */
  public get isDeployable(): boolean {
    return this.party.some((stored) => !stored.pokemon.isFainted);
  }

  public includesPokemon(id: string): boolean {
    return this.selectedPokemonIds.includes(id);
  }

  public itemQuantity(itemId: ItemId): number {
    return Math.min(this.selectedItems.get(itemId) ?? 0, this.stash.itemCount(itemId));
  }

  public securesPokemon(id: string): boolean {
    return this.securedPokemonIds.includes(id);
  }

  public securesItem(itemId: ItemId): boolean {
    return this.securedItemIds.includes(itemId);
  }

  /** @returns A message when the change was refused, otherwise undefined. */
  public togglePokemon(id: string): string | undefined {
    if (this.selectedPokemonIds.includes(id)) {
      this.selectedPokemonIds = this.selectedPokemonIds.filter((selected) => selected !== id);
      this.securedPokemonIds = this.securedPokemonIds.filter((secured) => secured !== id);
      return undefined;
    }
    if (this.selectedPokemonIds.length >= MAX_RUN_PARTY) {
      return `Your run party can hold up to ${MAX_RUN_PARTY} Pokemon.`;
    }
    this.selectedPokemonIds.push(id);
    return undefined;
  }

  public adjustItem(itemId: ItemId, direction: number): void {
    // Materials are for the Outfitter: packing one only puts it at risk.
    if (isMaterial(itemId)) {
      return;
    }
    const next = Math.max(
      0,
      Math.min(this.stash.itemCount(itemId), this.itemQuantity(itemId) + direction),
    );
    if (next === 0) {
      this.selectedItems.delete(itemId);
      this.securedItemIds = this.securedItemIds.filter((secured) => secured !== itemId);
      return;
    }
    this.selectedItems.set(itemId, next);
  }

  /**
   * Protecting one more Pokemon than the slot holds moves the protection rather
   * than refusing it: with a single slot that is "secure this one instead", and
   * with two it lets go of whichever was chosen first.
   */
  public toggleSecurePokemon(id: string): void {
    if (this.securedPokemonIds.includes(id)) {
      this.securedPokemonIds = this.securedPokemonIds.filter((secured) => secured !== id);
      return;
    }
    // Only Pokemon still in the party count against the slot, so one removed
    // from the vault since it was secured cannot hold a place nobody can see.
    const held = this.securedPokemon.map((stored) => stored.id);
    this.securedPokemonIds = [...held, id].slice(-Math.max(1, this.securePokemonSlots));
  }

  /** @returns A message when the change was refused, otherwise undefined. */
  public toggleSecureItem(itemId: ItemId): string | undefined {
    if (this.securedItemIds.includes(itemId)) {
      this.securedItemIds = this.securedItemIds.filter((secured) => secured !== itemId);
      return undefined;
    }
    if (this.securedItemIds.length >= this.secureItemStacks) {
      return `The secure slot protects ${this.secureItemStacks} item stacks.`;
    }
    this.securedItemIds.push(itemId);
    return undefined;
  }

  public chooseInsertion(insertionId: RunInsertionId): void {
    this.insertion = insertionId;
  }

  /** Opens the secure slot as a detour from the current step. */
  public openSecureSlot(): void {
    if (this.currentStep === 'secure') {
      return;
    }
    this.secureReturn = this.currentStep;
    this.currentStep = 'secure';
  }

  /**
   * Moves one step towards the raid.
   *
   * @returns A message when the step is not ready yet, otherwise undefined.
   */
  public advance(): string | undefined {
    if (this.currentStep === 'secure') {
      this.currentStep = this.secureReturn;
      return undefined;
    }
    if (this.currentStep === 'loadout') {
      if (!this.isDeployable) {
        return this.party.length === 0
          ? 'Choose at least one Pokemon to take into the raid.'
          : 'Every Pokemon in this loadout has fainted. Recover one at base first.';
      }
      this.currentStep = 'confirm';
    }
    return undefined;
  }

  /**
   * Steps back through preparation.
   *
   * @returns False when the player is already at the first step and should be
   *   returned to the base screen instead.
   */
  public retreat(): boolean {
    if (this.currentStep === 'secure') {
      this.currentStep = this.secureReturn;
      return true;
    }
    if (this.currentStep === 'confirm') {
      this.currentStep = 'loadout';
      return true;
    }
    return false;
  }

  /** Returns preparation to its first step, keeping what the player picked. */
  public restart(): void {
    this.currentStep = 'loadout';
    this.secureReturn = 'loadout';
  }

  /**
   * @throws When called before the player confirmed the plan, so no code path
   *   can skip preparation and deploy a loadout the player never approved.
   */
  public deploy(): Deployment {
    if (this.currentStep !== 'confirm') {
      throw new Error('A raid can only start from a confirmed loadout.');
    }
    const party = this.party;
    if (party.length === 0) {
      throw new Error('A raid needs at least one Pokemon.');
    }
    if (!this.isDeployable) {
      throw new Error('A raid needs at least one Pokemon that has not fainted.');
    }
    const securedPokemon = this.securedPokemon.slice(0, this.securePokemonSlots);
    const securedItems = this.securedItems.slice(0, this.secureItemStacks);
    return {
      insertionId: this.insertion,
      party,
      items: this.items,
      secureSlot: {
        ...(securedPokemon.length === 0
          ? {}
          : { pokemon: securedPokemon.map((stored) => stored.pokemon) }),
        items: securedItems,
      },
      stashSecureSlot: {
        ...(securedPokemon.length === 0
          ? {}
          : { pokemonIds: securedPokemon.map((stored) => stored.id) }),
        items: securedItems.map(({ itemId, quantity }) => ({ itemId, quantity })),
      },
    };
  }
}
