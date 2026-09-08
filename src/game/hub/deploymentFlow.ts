import type { ItemId } from '../items';
import type { ItemStack, SecureSlot as RunSecureSlot } from '../run';
import type { RunInsertionId } from '../run/runGeneration';
import type { SecureSlot as StashSecureSlot, Stash, StashedPokemon } from '../stash';

export const MAX_RUN_PARTY = 6;
export const MAX_SECURE_ITEM_STACKS = 2;

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
  private securedPokemonId: string | undefined;
  private securedItemIds: ItemId[] = [];
  private insertion: RunInsertionId;
  private currentStep: DeploymentStep = 'loadout';
  private secureReturn: Exclude<DeploymentStep, 'secure'> = 'loadout';

  public constructor(stash: Stash, insertionId: RunInsertionId = 'floodplain-relay') {
    this.stash = stash;
    this.insertion = insertionId;
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

  public get securedPokemon(): StashedPokemon | undefined {
    return this.party.find((stored) => stored.id === this.securedPokemonId);
  }

  public get securedItems(): readonly ItemStack[] {
    return this.items.filter((item) => this.securedItemIds.includes(item.itemId));
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
    return this.securedPokemonId === id;
  }

  public securesItem(itemId: ItemId): boolean {
    return this.securedItemIds.includes(itemId);
  }

  /** @returns A message when the change was refused, otherwise undefined. */
  public togglePokemon(id: string): string | undefined {
    if (this.selectedPokemonIds.includes(id)) {
      this.selectedPokemonIds = this.selectedPokemonIds.filter((selected) => selected !== id);
      if (this.securedPokemonId === id) {
        this.securedPokemonId = undefined;
      }
      return undefined;
    }
    if (this.selectedPokemonIds.length >= MAX_RUN_PARTY) {
      return `Your run party can hold up to ${MAX_RUN_PARTY} Pokemon.`;
    }
    this.selectedPokemonIds.push(id);
    return undefined;
  }

  public adjustItem(itemId: ItemId, direction: number): void {
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

  public toggleSecurePokemon(id: string): void {
    this.securedPokemonId = this.securedPokemonId === id ? undefined : id;
  }

  /** @returns A message when the change was refused, otherwise undefined. */
  public toggleSecureItem(itemId: ItemId): string | undefined {
    if (this.securedItemIds.includes(itemId)) {
      this.securedItemIds = this.securedItemIds.filter((secured) => secured !== itemId);
      return undefined;
    }
    if (this.securedItemIds.length >= MAX_SECURE_ITEM_STACKS) {
      return `The secure slot protects ${MAX_SECURE_ITEM_STACKS} item stacks.`;
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
    const securedPokemon = this.securedPokemon;
    const securedItems = this.securedItems.slice(0, MAX_SECURE_ITEM_STACKS);
    return {
      insertionId: this.insertion,
      party,
      items: this.items,
      secureSlot: {
        ...(securedPokemon === undefined ? {} : { pokemon: securedPokemon.pokemon }),
        items: securedItems,
      },
      stashSecureSlot: {
        ...(securedPokemon === undefined ? {} : { pokemonId: securedPokemon.id }),
        items: securedItems.map(({ itemId, quantity }) => ({ itemId, quantity })),
      },
    };
  }
}
