import {
  arrangementOf,
  BASE_SECURE_GRID,
  bestPackIn,
  blocksFor,
  cargoCells,
  EMPTY_ARRANGEMENT,
  fitsInGrid,
  gridCells,
  isFoundOnly,
  packContents,
  packGridFor,
  packName,
  packsIn,
  packSquares,
  RAID_BAG_GRID,
  roomFor,
  stackSizeOf,
  tidyArrangement,
  type GridArrangement,
  type GridCargo,
  type GridPacking,
  type GridSize,
  type ItemId,
  type PackItemId,
} from '../items';
import { cargoSquaresLabel, pokemonCargo } from '../pokemon/pokemonCargo';
import {
  autofillSecureSlot,
  DEFAULT_SECURE_PREFERENCE,
  type SecurePreference,
} from './secureAutofill';
import { BASE_SECURE_POKEMON } from '../objectives/contracts';
import type { ItemStack, SecureSlot as RunSecureSlot } from '../run';
import type { RunInsertionId } from '../run/runGeneration';
import type { SecureSlot as StashSecureSlot, Stash, StashedPokemon } from '../stash';

export const MAX_RUN_PARTY = 6;

/**
 * What the *base* has built: the container a wipe cannot touch, and how many
 * Pokemon it protects.
 *
 * Both belong to the save rather than to this class - contracts, Brock
 * and a rented berth enlarge them - so preparation is told its capacities
 * instead of assuming them. The pack is deliberately not here: it is gear out
 * of the vault rather than a capacity of the base, so it is chosen on the
 * loadout and read off the chosen pack (`../items/packs`).
 */
export interface LoadoutCapacity {
  readonly pokemon: number;
  readonly secureGrid: GridSize;
}

export const BASE_LOADOUT_CAPACITY: LoadoutCapacity = {
  pokemon: BASE_SECURE_POKEMON,
  secureGrid: BASE_SECURE_GRID,
};

/** One pack the vault holds, as the loadout lists it. */
export interface PackChoice {
  readonly itemId: PackItemId;
  readonly name: string;
  readonly squares: number;
  /** How many of this pack are in the vault, this raid's one included. */
  readonly held: number;
  readonly chosen: boolean;
  /** Set when choosing this pack would not hold what is already packed. */
  readonly wouldNotHold?: string;
}

/**
 * Preparation is a route, not a screen: a player picks what to risk, chooses
 * where to drop in, may detour into the secure slot, and only then reaches the
 * confirmation that starts the raid. `deploy()` refuses to hand anything back
 * from an earlier step, so a raid can never begin with a loadout the player did
 * not look at and confirm.
 *
 * What to take and where to go used to be one screen, with the insertions a
 * third pane beside the pack. They are two different decisions - one is about
 * your vault, the other about a place - and the second had no room to say
 * anything about the place at all. It is its own step now, and the loadout is
 * otherwise unchanged.
 */
export type DeploymentStep = 'loadout' | 'dropin' | 'secure' | 'confirm';

/** Everything a confirmed plan hands to the run manager and the raid scene. */
export interface Deployment {
  readonly insertionId: RunInsertionId;
  readonly party: readonly StashedPokemon[];
  readonly items: readonly ItemStack[];
  /** The pack worn into this raid, which a lost raid destroys with its contents. */
  readonly packItemId?: PackItemId;
  readonly secureSlot: RunSecureSlot;
  readonly stashSecureSlot: StashSecureSlot;
  /** What the container was filled with, so the next raid can start from it. */
  readonly securePreference: SecurePreference;
  /** How the player laid the pack out, so the raid deploys the pack they packed. */
  readonly bagArrangement: GridArrangement;
  /** How the player laid the secure container out, remembered the same way. */
  readonly secureArrangement: GridArrangement;
}

/** What a save remembers about how the two containers were laid out. */
export interface LoadoutArrangements {
  readonly bag: GridArrangement;
  readonly secure: GridArrangement;
}

export const EMPTY_LOADOUT_ARRANGEMENTS: LoadoutArrangements = {
  bag: EMPTY_ARRANGEMENT,
  secure: EMPTY_ARRANGEMENT,
};

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
  /**
   * The pack being worn this raid, or undefined for a vault with none.
   *
   * It opens on the biggest pack in the vault and is the player's from the
   * moment they touch it, exactly as the secure container is - a default, never
   * a cage. Nothing about it is stored: which packs are owned is the vault's
   * item counts, and which one is worn is this raid's decision.
   */
  private packItemIdValue: PackItemId | undefined;
  /** How many Pokemon the secure container protects. */
  public readonly securePokemonSlots: number;
  /** What the container filled itself with last raid, and whether to lead with Pokemon. */
  private readonly preference: SecurePreference;
  /**
   * Set the moment the player changes anything in the container. Until then the
   * container refills itself as the loadout changes; afterwards it is theirs,
   * because an auto-fill that overwrites a decision is not a default, it is a
   * screen arguing with the person using it.
   */
  private secureTouched = false;
  /**
   * The seats the player chose in each container, carried in from the save and
   * out again on deploy. Empty means nothing has been arranged, which is the
   * automatic pack exactly as it was - see `../items/itemGrid`.
   */
  private bagSeats: GridArrangement;
  private secureSeats: GridArrangement;
  /**
   * Set once either container has been laid out by hand. After that the whole
   * layout is written down again on every change, so packing one more Potion
   * cannot shuffle what the player placed.
   */
  private bagArranged: boolean;
  private secureArranged: boolean;

  public constructor(
    stash: Stash,
    insertionId: RunInsertionId = 'floodplain-relay',
    capacity: LoadoutCapacity = BASE_LOADOUT_CAPACITY,
    preference: SecurePreference = DEFAULT_SECURE_PREFERENCE,
    arrangements: LoadoutArrangements = EMPTY_LOADOUT_ARRANGEMENTS,
  ) {
    this.stash = stash;
    this.insertion = insertionId;
    this.secureGrid = capacity.secureGrid;
    this.securePokemonSlots = capacity.pokemon;
    this.preference = preference;
    this.packItemIdValue = bestPackIn(stash.listItems());
    this.bagSeats = arrangements.bag;
    this.secureSeats = arrangements.secure;
    this.bagArranged = arrangements.bag.items.length > 0 || arrangements.bag.cargo.length > 0;
    this.secureArranged =
      arrangements.secure.items.length > 0 || arrangements.secure.cargo.length > 0;
  }

  /** The seats the player chose in the pack. */
  public get bagArrangement(): GridArrangement {
    return this.bagSeats;
  }

  /** The seats the player chose in the secure container. */
  public get secureArrangement(): GridArrangement {
    return this.secureSeats;
  }

  /** Lays the pack out as the player asked, and freezes what actually packed. */
  public arrangeBag(arrangement: GridArrangement): void {
    this.bagSeats = arrangement;
    this.bagArranged = true;
    this.bagSeats = arrangementOf(this.bagLayout());
  }

  /** The same for the container a wipe cannot touch. */
  public arrangeSecure(arrangement: GridArrangement): void {
    this.secureSeats = arrangement;
    this.secureArranged = true;
    this.secureSeats = arrangementOf(this.secureLayout());
  }

  /** Packs the pack again from scratch, rotation allowed: the TIDY control. */
  public tidyBag(): void {
    this.bagSeats = tidyArrangement(this.packedContents, this.bagGrid);
    this.bagArranged = true;
  }

  public tidySecure(): void {
    this.secureSeats = tidyArrangement(this.securedContents, this.secureGrid, this.securedCargo);
    this.secureArranged = true;
  }

  /**
   * Writes both layouts down again after the loadout changed.
   *
   * Only for a container the player has arranged: one they have not still packs
   * itself every time, which is every save that never opens the grid.
   */
  private holdLayouts(): void {
    if (this.bagArranged) {
      this.bagSeats = arrangementOf(this.bagLayout());
    }
    if (this.secureArranged) {
      this.secureSeats = arrangementOf(this.secureLayout());
    }
  }

  /** The pack this raid is packed into, or undefined when the vault holds none. */
  public get packItemId(): PackItemId | undefined {
    return this.packItemIdValue !== undefined && this.stash.itemCount(this.packItemIdValue) > 0
      ? this.packItemIdValue
      : bestPackIn(this.stash.listItems());
  }

  /** The squares this raid's pack has - the one number the loadout packs against. */
  public get bagGrid(): GridSize {
    return this.packItemId === undefined ? RAID_BAG_GRID : packGridFor(this.packItemId);
  }

  /** What a lost raid takes with it besides the party and the supplies. */
  public get packName(): string {
    return packName(this.packItemId);
  }

  /**
   * Every pack in the vault, smallest first, with the one being worn marked and
   * a reason beside any that would not hold what is already packed.
   *
   * The reason is shown rather than the row being hidden: a player who packed
   * nineteen squares and then wants the Satchel is owed "it holds twelve" and
   * not a control that has quietly gone away.
   */
  public get packChoices(): readonly PackChoice[] {
    const chosen = this.packItemId;
    return packsIn(this.stash.listItems()).map(({ itemId, held }) => {
      const squares = packSquares(itemId);
      const holds = fitsInGrid(this.packedContents, packGridFor(itemId));
      return {
        itemId,
        name: packName(itemId),
        squares,
        held,
        chosen: itemId === chosen,
        ...(holds
          ? {}
          : { wouldNotHold: `${packName(itemId)} holds ${squares} squares - take something out first.` }),
      };
    });
  }

  /**
   * Wears a different pack.
   *
   * A smaller pack is refused outright rather than spilling what is packed,
   * because the player packed it: this game never silently puts something of
   * theirs down. Taking things out first is the decision, and the row says so.
   *
   * @returns A message when the change was refused, otherwise undefined.
   */
  public choosePack(itemId: PackItemId): string | undefined {
    if (this.stash.itemCount(itemId) <= 0) {
      return `There is no ${packName(itemId)} at base.`;
    }
    if (itemId === this.packItemId) {
      return undefined;
    }
    if (!fitsInGrid(this.packedContents, packGridFor(itemId))) {
      return `${packName(itemId)} holds ${packSquares(itemId)} squares and you have packed ${this.bagCells.used}. Take something out first.`;
    }
    this.packItemIdValue = itemId;
    this.refillSecureSlot();
    this.holdLayouts();
    return undefined;
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

  /**
   * The protected Pokemon as squares of the container.
   *
   * A Pokemon takes squares by evolution stage (`../pokemon/pokemonCargo.ts`),
   * and they are the container's own squares rather than a second allowance, so
   * the base 2x2 holds exactly one first-stage Pokemon and nothing else. That
   * is the point: growing the container is then a real reward rather than more
   * room for Potions.
   */
  public get securedCargo(): readonly GridCargo[] {
    return this.securedPokemon.map((stored) => pokemonCargo(stored.id, stored.pokemon));
  }

  /** Where the secure container's contents sit, for the screen that draws it. */
  public secureLayout(): GridPacking {
    return packContents(this.securedContents, this.secureGrid, this.securedCargo, this.secureSeats);
  }

  /** What the container was left holding, for the save to start next raid from. */
  public get securePreference(): SecurePreference {
    return {
      pokemon: this.securedPokemon.length > 0,
      items: this.securedItems.map(({ itemId, quantity }) => ({ itemId, quantity })),
    };
  }

  /** The packed supplies as a record, for the packer and the view. */
  public get packedContents(): Readonly<Record<string, number>> {
    return Object.fromEntries(this.items.map(({ itemId, quantity }) => [itemId, quantity]));
  }

  /** Where the packed supplies sit in the raid pack. */
  public bagLayout(): GridPacking {
    return packContents(this.packedContents, this.bagGrid, [], this.bagSeats);
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
      this.refillSecureSlot();
      return undefined;
    }
    if (this.selectedPokemonIds.length >= MAX_RUN_PARTY) {
      return `Your run party can hold up to ${MAX_RUN_PARTY} Pokemon.`;
    }
    this.selectedPokemonIds.push(id);
    this.refillSecureSlot();
    return undefined;
  }

  /**
   * Fills the container from the remembered preference: the highest-level
   * Pokemon in the party first, then whatever else was in it last raid.
   *
   * It runs on every change to the loadout for as long as the player has not
   * touched the container themselves, because the party it protects is chosen
   * on the screen before it - a container filled once, when the loadout was
   * empty, would protect nothing.
   */
  private refillSecureSlot(): void {
    if (this.secureTouched) {
      // Still drop anyone no longer in the party: a protected place nobody can
      // see is the one thing an untouched container and a touched one agree on.
      this.securedPokemonIds = this.securedPokemon.map((stored) => stored.id);
      return;
    }
    const fill = autofillSecureSlot(
      this.party.map((stored) => ({
        id: stored.id,
        level: stored.pokemon.level,
        cargo: pokemonCargo(stored.id, stored.pokemon),
      })),
      this.preference,
      this.secureGrid,
      this.securePokemonSlots,
      (itemId) => this.itemQuantity(itemId),
    );
    this.securedPokemonIds = [...fill.pokemonIds];
    this.securedItemCounts.clear();
    for (const { itemId, quantity } of fill.items) {
      this.securedItemCounts.set(itemId as ItemId, quantity);
    }
    this.holdLayouts();
  }

  /**
   * Packs or unpacks one supply.
   *
   * @returns A message when the pack had no room, otherwise undefined. The pack
   *   is the second cap, after the vault: a stash of twenty Potions still only
   *   deploys with what fits in the squares.
   */
  public adjustItem(itemId: ItemId, direction: number): string | undefined {
    return this.setItemQuantity(itemId, this.itemQuantity(itemId) + direction);
  }

  /**
   * Packs a supply up to `target`, or as near it as the pack allows.
   *
   * A count selector asks for whole numbers at a time, so a request the pack
   * cannot hold is met as far as it can be rather than refused outright - the
   * selector shows `packLimit` as its ceiling, so what lands is what it said
   * would. Only a request that moves nothing answers with a reason.
   */
  public setItemQuantity(itemId: ItemId, target: number): string | undefined {
    // Materials are for Brock and scrip is for Bill: neither
    // does anything in a raid, so packing one only puts it at risk.
    if (isFoundOnly(itemId)) {
      return undefined;
    }
    const current = this.itemQuantity(itemId);
    const next = Math.max(0, Math.min(this.packLimit(itemId), target));
    if (next === current) {
      return target > current && this.packLimit(itemId) < this.stash.itemCount(itemId)
        ? 'No room in the pack. Take something out first.'
        : undefined;
    }
    if (next === 0) {
      this.selectedItems.delete(itemId);
      this.securedItemCounts.delete(itemId);
      this.refillSecureSlot();
      this.holdLayouts();
      return undefined;
    }
    this.selectedItems.set(itemId, next);
    this.refillSecureSlot();
    this.holdLayouts();
    return undefined;
  }

  /**
   * The most of a supply the pack can carry: what the base holds, cut to what
   * the squares will take beside everything else already packed.
   */
  public packLimit(itemId: ItemId): number {
    if (isFoundOnly(itemId)) {
      return 0;
    }
    const others = { ...this.packedContents };
    delete others[itemId];
    return roomFor(others, this.bagGrid, itemId, this.stash.itemCount(itemId), [], this.bagSeats);
  }

  /**
   * The most of a supply the pack would take if it were packed again from
   * scratch, which is never less than `packLimit`.
   *
   * The difference between the two is the sentence a row owes the player: a
   * plus that stops at four when a tidy would take six is not full, it is
   * arranged, and those are different facts.
   */
  public packLimitTidied(itemId: ItemId): number {
    if (isFoundOnly(itemId)) {
      return 0;
    }
    const others = { ...this.packedContents };
    delete others[itemId];
    return roomFor(others, this.bagGrid, itemId, this.stash.itemCount(itemId));
  }

  /** Whether one more of a supply would go into the pack beside what is packed. */
  public packHasRoomFor(itemId: ItemId): boolean {
    return fitsInGrid(
      { ...this.packedContents, [itemId]: this.itemQuantity(itemId) + 1 },
      this.bagGrid,
      [],
      this.bagSeats,
    );
  }

  /**
   * Protecting one more Pokemon than the slot holds moves the protection rather
   * than refusing it: with a single slot that is "secure this one instead", and
   * with two it lets go of whichever was chosen first.
   *
   * The squares are the second, harder cap, and the one that has to be said out
   * loud: a Pokemon takes four squares, six or nine by its evolution stage, so
   * an Ivysaur does not go into a 2x2 container at all and the player is owed
   * the reason rather than a control that does nothing.
   *
   * @returns A message when the container had no room, otherwise undefined.
   */
  public toggleSecurePokemon(id: string): string | undefined {
    this.secureTouched = true;
    if (this.securedPokemonIds.includes(id)) {
      this.securedPokemonIds = this.securedPokemonIds.filter((secured) => secured !== id);
      this.holdLayouts();
      return undefined;
    }
    // Only Pokemon still in the party count against the slot, so one removed
    // from the vault since it was secured cannot hold a place nobody can see.
    const held = this.securedPokemon.map((stored) => stored.id);
    const previous = this.securedPokemonIds;
    this.securedPokemonIds = [...held, id].slice(-Math.max(1, this.securePokemonSlots));
    if (fitsInGrid(this.securedContents, this.secureGrid, this.securedCargo, this.secureSeats)) {
      this.holdLayouts();
      return undefined;
    }
    this.securedPokemonIds = previous;
    return this.noRoomForPokemonMessage(id);
  }

  /** Why one named Pokemon will not go into the container, in the player's terms. */
  private noRoomForPokemonMessage(id: string): string {
    const stored = this.party.find((member) => member.id === id);
    if (!stored) {
      return 'The secure container is full. Take something out of it first.';
    }
    const piece = pokemonCargo(stored.id, stored.pokemon);
    const squares = cargoSquaresLabel(cargoCells(piece));
    const total = gridCells(this.secureGrid);
    const free = total - this.secureLayout().cellsUsed;
    const room =
      free === 0
        ? 'the container is full'
        : free === total
          ? `the container is only ${this.secureGrid.width}x${this.secureGrid.height}`
          : `only ${cargoSquaresLabel(free)} of it ${free === 1 ? 'is' : 'are'} free`;
    return `${stored.pokemon.base.name.toUpperCase()} needs ${squares} - ${room}. Take something out, or grow the container.`;
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
    return this.setSecureSquares(itemId, blocksFor(itemId, this.secureQuantity(itemId)) + direction);
  }

  /**
   * Sets how many squares of a kind the secure container holds, or as many as
   * it can. A count selector asks in whole numbers, so a request the container
   * cannot seat is met as far as it can be (`secureLimit` is the ceiling the
   * selector shows) and only one that moves nothing answers with a reason.
   */
  public setSecureSquares(itemId: ItemId, squares: number): string | undefined {
    this.secureTouched = true;
    const step = stackSizeOf(itemId);
    const ceiling = this.secureCeiling(itemId);
    const current = this.secureQuantity(itemId);
    const wanted = Math.max(0, Math.min(this.secureLimit(itemId), squares));
    const next = Math.min(ceiling, wanted * step);
    if (next === current) {
      if (squares > blocksFor(itemId, current)) {
        if (ceiling === 0) {
          return 'Pack some of this first - the container protects what you carry.';
        }
        return this.noRoomInContainerMessage();
      }
      return undefined;
    }
    if (next === 0) {
      this.securedItemCounts.delete(itemId);
      this.holdLayouts();
      return undefined;
    }
    this.securedItemCounts.set(itemId, next);
    this.holdLayouts();
    return undefined;
  }

  /**
   * The most squares of a kind the container can seat, beside everything else
   * in it - the number a count selector stops at.
   */
  public secureLimit(itemId: ItemId): number {
    const step = stackSizeOf(itemId);
    const ceiling = this.secureCeiling(itemId);
    const others = { ...this.securedContents };
    delete others[itemId];
    let squares = 0;
    while (
      squares * step < ceiling &&
      fitsInGrid(
        { ...others, [itemId]: Math.min(ceiling, (squares + 1) * step) },
        this.secureGrid,
        this.securedCargo,
        this.secureSeats,
      )
    ) {
      squares += 1;
    }
    return squares;
  }

  /** The most units of a kind the container could ever hold, room aside. */
  private secureCeiling(itemId: ItemId): number {
    return isFoundOnly(itemId)
      ? gridCells(this.secureGrid) * stackSizeOf(itemId)
      : this.itemQuantity(itemId);
  }

  private noRoomInContainerMessage(): string {
    return this.securedCargo.length > 0
      ? `No room - ${this.securedCargo.map((piece) => piece.name.toUpperCase()).join(' and ')} ${this.securedCargo.length === 1 ? 'is' : 'are'} taking the container. Unsecure a Pokémon, or grow it.`
      : 'The secure container is full. Take something out of it first.';
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
        this.securedCargo,
        this.secureSeats,
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
      this.currentStep = 'dropin';
      return undefined;
    }
    if (this.currentStep === 'dropin') {
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
      this.currentStep = 'dropin';
      return true;
    }
    if (this.currentStep === 'dropin') {
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
      // The pack is named on the deployment because the raid has to be able to
      // destroy it: it never enters the bag, so nothing else on this object
      // knows it was risked.
      ...(this.packItemId === undefined ? {} : { packItemId: this.packItemId }),
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
      securePreference: this.securePreference,
      // The pack deploys laid out the way the player left it, so what they
      // arranged at base is the pack they open in the field.
      bagArrangement: this.bagSeats,
      secureArrangement: this.secureSeats,
    };
  }
}
