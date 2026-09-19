import {
  BASE_SECURE_GRID,
  fitsInGrid,
  gridCells,
  isFoundOnly,
  packContents,
  RAID_BAG_GRID,
  stackSizeOf,
  type GridPacking,
  type GridSize,
  type ItemId,
} from '../items';
import { BASE_SECURE_POKEMON } from '../objectives/contracts';
import type { ItemStack, SecureSlot as RunSecureSlot } from '../run';
import type { RunInsertionId } from '../run/runGeneration';
import type { SecureSlot as StashSecureSlot, Stash, StashedPokemon } from '../stash';

export const MAX_RUN_PARTY = 6;

/**
 * What this save carries a raid in: the pack it packs into, the container the
 * wipe cannot touch, and how many Pokemon that container holds.
 *
 * All three belong to the save rather than to this class - contracts and the
 * Outfitter enlarge two of them - so preparation is told its capacities instead
 * of assuming them.
 */
export interface LoadoutCapacity {
  readonly pokemon: number;
  readonly secureGrid: GridSize;
  readonly bagGrid: GridSize;
}

export const BASE_LOADOUT_CAPACITY: LoadoutCapacity = {
  pokemon: BASE_SECURE_POKEMON,
  secureGrid: BASE_SECURE_GRID,
  bagGrid: RAID_BAG_GRID,
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
  /** How many of each kind is in the secure container, by id. */
  private readonly securedItemCounts = new Map<ItemId, number>();
  private insertion: RunInsertionId;
  private currentStep: DeploymentStep = 'loadout';
  private secureReturn: Exclude<DeploymentStep, 'secure'> = 'loadout';
  /** The squares the secure container has. */
  public readonly secureGrid: GridSize;
  /** The squares the raid pack has. */
  public readonly bagGrid: GridSize;
  /** How many Pokemon the secure container protects. */
  public readonly securePokemonSlots: number;

  public constructor(
    stash: Stash,
    insertionId: RunInsertionId = 'floodplain-relay',
    capacity: LoadoutCapacity = BASE_LOADOUT_CAPACITY,
  ) {
    this.stash = stash;
    this.insertion = insertionId;
    this.secureGrid = capacity.secureGrid;
    this.bagGrid = capacity.bagGrid;
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
   * What is in the secure container: loadout supplies the player put in it, and
   * room set aside for the found goods they expect to bring back - materials,
   * and the scrip they have not picked up yet.
   *
   * A supply is capped at what is actually packed, so a stack shrunk at base
   * cannot protect more than deploys. A found good is never packed - it is
   * found - so its entry is the room reserved for it, and how much of that room
   * is filled is decided by the pack at the end of the raid.
   */
  public get securedItems(): readonly ItemStack[] {
    return [...this.securedItemCounts]
      .map(([itemId, quantity]) => ({
        itemId,
        quantity: isFoundOnly(itemId) ? quantity : Math.min(quantity, this.itemQuantity(itemId)),
      }))
      .filter((item) => item.quantity > 0);
  }

  /** The secure container's contents as a record, for the packer and the view. */
  public get securedContents(): Readonly<Record<string, number>> {
    return Object.fromEntries(this.securedItems.map(({ itemId, quantity }) => [itemId, quantity]));
  }

  /** Where the secure container's contents sit, for the screen that draws it. */
  public secureLayout(): GridPacking {
    return packContents(this.securedContents, this.secureGrid);
  }

  /** The packed supplies as a record, for the packer and the view. */
  public get packedContents(): Readonly<Record<string, number>> {
    return Object.fromEntries(this.items.map(({ itemId, quantity }) => [itemId, quantity]));
  }

  /** Where the packed supplies sit in the raid pack. */
  public bagLayout(): GridPacking {
    return packContents(this.packedContents, this.bagGrid);
  }

  /** Squares filled and squares there are, for the line that reads the pack back. */
  public get bagCells(): { readonly used: number; readonly total: number } {
    return { used: this.bagLayout().cellsUsed, total: gridCells(this.bagGrid) };
  }

  public get secureCells(): { readonly used: number; readonly total: number } {
    return { used: this.secureLayout().cellsUsed, total: gridCells(this.secureGrid) };
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
    return this.secureQuantity(itemId) > 0;
  }

  /** How many of one kind is in the secure container. */
  public secureQuantity(itemId: ItemId): number {
    const held = this.securedItemCounts.get(itemId) ?? 0;
    return isFoundOnly(itemId) ? held : Math.min(held, this.itemQuantity(itemId));
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

  /**
   * Packs or unpacks one supply.
   *
   * @returns A message when the pack had no room, otherwise undefined. The pack
   *   is the second cap, after the vault: a stash of twenty Potions still only
   *   deploys with what fits in the squares.
   */
  public adjustItem(itemId: ItemId, direction: number): string | undefined {
    // Materials are for the Outfitter and scrip is for the Ferryman: neither
    // does anything in a raid, so packing one only puts it at risk.
    if (isFoundOnly(itemId)) {
      return undefined;
    }
    const next = Math.max(
      0,
      Math.min(this.stash.itemCount(itemId), this.itemQuantity(itemId) + direction),
    );
    if (next === this.itemQuantity(itemId)) {
      return undefined;
    }
    if (next > 0 && !fitsInGrid({ ...this.packedContents, [itemId]: next }, this.bagGrid)) {
      return 'No room in the pack. Take something out first.';
    }
    if (next === 0) {
      this.selectedItems.delete(itemId);
      this.securedItemCounts.delete(itemId);
      return undefined;
    }
    this.selectedItems.set(itemId, next);
    return undefined;
  }

  /** Whether one more of a supply would go into the pack beside what is packed. */
  public packHasRoomFor(itemId: ItemId): boolean {
    return fitsInGrid({ ...this.packedContents, [itemId]: this.itemQuantity(itemId) + 1 }, this.bagGrid);
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

  /**
   * Puts one more *square* of a kind into the secure container, or takes one
   * out.
   *
   * A square rather than a unit, because that is what the container is measured
   * in and what the row's own line says one of these costs. For everything a
   * square holds one of they are the same number; for the scrip, which stacks a
   * bundle to a square, they are not - one press used to reserve a square and
   * protect a single note, and a wipe brought one note home out of forty.
   *
   * @returns A message when the container had no room, otherwise undefined.
   */
  public adjustSecureItem(itemId: ItemId, direction: number): string | undefined {
    const step = stackSizeOf(itemId);
    const ceiling = isFoundOnly(itemId)
      ? gridCells(this.secureGrid) * step
      : this.itemQuantity(itemId);
    const next = Math.max(0, Math.min(ceiling, this.secureQuantity(itemId) + direction * step));
    if (next === this.secureQuantity(itemId)) {
      return direction > 0 && ceiling === 0
        ? 'Pack some of this first - the container protects what you carry.'
        : undefined;
    }
    if (next === 0) {
      this.securedItemCounts.delete(itemId);
      return undefined;
    }
    if (!fitsInGrid({ ...this.securedContents, [itemId]: next }, this.secureGrid)) {
      return 'The secure container is full. Take something out of it first.';
    }
    this.securedItemCounts.set(itemId, next);
    return undefined;
  }

  /** Whether one more square of a kind would go into the secure container. */
  public secureHasRoomFor(itemId: ItemId): boolean {
    const step = stackSizeOf(itemId);
    const ceiling = isFoundOnly(itemId)
      ? gridCells(this.secureGrid) * step
      : this.itemQuantity(itemId);
    return (
      this.secureQuantity(itemId) < ceiling &&
      fitsInGrid(
        { ...this.securedContents, [itemId]: this.secureQuantity(itemId) + step },
        this.secureGrid,
      )
    );
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
    // The container is squares, so it is cut by what fits in them rather than
    // by a count of entries - the one cut, made once, that the run manager and
    // the wipe both check again from their own side.
    const securedItems = this.securedItems;
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
