import {
  arrangementOf,
  BASE_SECURE_GRID,
  bestPackIn,
  blocksFor,
  cargoCells,
  EMPTY_ARRANGEMENT,
  fitsInGrid,
  footprintOf,
  getItemById,
  gridCells,
  isFoundOnly,
  ItemCategory,
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
import { evolutionFamily } from '../pokemon/evolution';
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
 * The most of the pack the stash's medicine is packed into by default.
 *
 * The captain, 2026-09-23, on a playtest that lost its first fight with an
 * empty bag: "put the stash's medicine in the pack by default". The playtest's
 * numbers are why: a Lv 5 starter beats the first contract's checkpoint 2-8%
 * of the time with no Potions and 85-92% with the three a fresh save holds,
 * and nothing on the way to the raid said the pack was empty.
 *
 * Half, and not all of it, because a pack filled wall to wall with Potions has
 * no room for what a raid is *for*: a vault that has banked twenty Potions
 * would otherwise open every loadout with no square left for a find. A fresh
 * save's three Potions are three squares of eighteen.
 */
export const MEDICINE_PREPACK_SHARE = 0.5;

/** Why a fainted Pokemon stays out of the raid party: the row's help line and the refusal of a press on it. */
export const faintedRefusal = (name: string, only = false): string =>
  `${name} has fainted and cannot fight. Only the Pokémon Center can revive ${only ? 'your only Pokémon' : 'it'}.`;

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
 * Preparation is a set of choices with one way out of it. A player walks about
 * THE RAID ARENA's hall choosing what to risk, in any order and as often as they
 * like (`base/arenaKit.ts`), and only when they look down from the rim is the
 * plan `confirm`ed. `deploy()` refuses to hand anything back before that, so a
 * raid can never begin with a loadout the player did not look at.
 */
export type DeploymentStep = 'loadout' | 'confirm';

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
  /** True when the player never touched the container and the autofill chose. */
  readonly secureFilledForYou: boolean;
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
  private stash: Stash;
  private selectedPokemonIds: string[] = [];
  private readonly selectedItems = new Map<ItemId, number>();
  private securedPokemonIds: string[] = [];
  /** How many of each kind is in the secure container, by id. */
  private readonly securedItemCounts = new Map<ItemId, number>();
  private insertion: RunInsertionId;
  private currentStep: DeploymentStep = 'loadout';
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
   * Every species of the partner's line, so the container can break a level tie
   * in the partner's favour whether or not it has evolved. Empty when the save
   * names no starter, which leaves the tie to the alphabet as before.
   */
  private readonly partnerSpecies: ReadonlySet<string>;
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
  /**
   * What the default put in the pack, by kind, so a row can say "packed for
   * you" for exactly as long as the player has not changed it. Nothing about
   * it is stored: the next loadout packs it again, as the pack is chosen again.
   */
  private readonly prepacked = new Map<ItemId, number>();

  public constructor(
    stash: Stash,
    insertionId: RunInsertionId = 'floodplain-relay',
    capacity: LoadoutCapacity = BASE_LOADOUT_CAPACITY,
    preference: SecurePreference = DEFAULT_SECURE_PREFERENCE,
    arrangements: LoadoutArrangements = EMPTY_LOADOUT_ARRANGEMENTS,
    partnerSpeciesId: string | null = null,
    lastBench: readonly string[] = [],
  ) {
    this.stash = stash;
    this.partnerSpecies = new Set(
      partnerSpeciesId ? evolutionFamily(partnerSpeciesId).map((species) => species.id) : [],
    );
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
    this.packMedicine();
    this.packLonePokemon();
    this.packLastBench(lastBench);
  }

  /**
   * Puts back who went down last raid, as a default and never a cage, the way
   * the medicine is packed: home from a raid, SPACE at the rim and ENTER are all
   * going again should ask, and a team of two or more was otherwise on the bench
   * for one raid only and walked back to it every time (the third Arena sweep).
   * Anybody lost is simply not in the vault, and anybody fainted cannot fight, so
   * neither is there; nobody left says so at the rim as an empty bench always has.
   */
  private packLastBench(lastBench: readonly string[]): void {
    const held = this.stash.listPokemon();
    for (const id of lastBench) {
      const stored = held.find((each) => each.id === id);
      if (stored && !stored.pokemon.isFainted && !this.selectedPokemonIds.includes(id)) {
        this.togglePokemon(id);
      }
    }
  }

  /**
   * Puts a vault's only Pokemon in the raid party, as a default and never a
   * cage, the way the medicine is packed: a player with one Pokemon has one
   * party to send, and was made to ADD it again on every raid under "0/6
   * POKEMON PACKED" (playtest 47). One that cannot fight is left out, because a
   * party of one fainted Pokemon is no party; a team comes back as `packLastBench`
   * puts it.
   */
  /**
   * A lone Pokemon revived while the loadout is open goes into the party as it
   * would have at the door: it was left out only because it had fainted, and a
   * fainted Pokemon is never packed (`togglePokemon`).
   */
  public packRevivedLonePokemon(): void {
    if (this.selectedPokemonIds.length === 0) {
      this.packLonePokemon();
    }
  }

  private packLonePokemon(): void {
    const [only, ...others] = this.stash.listPokemon();
    if (only && others.length === 0 && !only.pokemon.isFainted) {
      this.togglePokemon(only.id);
    }
  }

  /**
   * Puts the stash's medicine in the pack, as a default and never a cage - the
   * same rule the worn pack and the secure container follow. Every row can
   * take it straight back out, and each says it was packed for the player
   * until they touch it, so the pack is still visibly the player's decision.
   *
   * Medicine only: a Poke Ball is a choice about what the raid is for, while a
   * Potion is what lets the raid's first fight be won at all.
   */
  private packMedicine(only?: readonly ItemId[]): void {
    const medicine = this.stashMedicine;
    // Medicine the player packed themselves counts against the share and is
    // never re-packed: the default fills in around a choice, never over one.
    let budget = medicine.reduce((left, itemId) => {
      const { width, height } = footprintOf(itemId);
      return left - this.itemQuantity(itemId) * width * height;
    }, Math.floor(gridCells(this.bagGrid) * MEDICINE_PREPACK_SHARE));
    for (const itemId of medicine.filter((candidate) => only === undefined || only.includes(candidate))) {
      const { width, height } = footprintOf(itemId);
      const wanted = Math.min(this.stash.itemCount(itemId), Math.floor(budget / (width * height)));
      if (wanted <= 0) {
        continue;
      }
      this.setItemQuantity(itemId, wanted);
      const packed = this.itemQuantity(itemId);
      if (packed > 0) {
        this.prepacked.set(itemId, packed);
        budget -= packed * width * height;
      }
    }
  }

  /** Every kind of medicine the stash holds, in the order the stash lists it. */
  private get stashMedicine(): ItemId[] {
    return Object.keys(this.stash.listItems())
      .filter((itemId) => getItemById(itemId)?.category === ItemCategory.Medicine)
      .map((itemId) => itemId as ItemId);
  }

  /** The medicine in the pack right now. */
  private get packedMedicine(): ItemId[] {
    return this.stashMedicine.filter((itemId) => this.itemQuantity(itemId) > 0);
  }

  /** Whether this row is still exactly what the default packed. */
  public isPrepacked(itemId: ItemId): boolean {
    const packed = this.itemQuantity(itemId);
    return packed > 0 && this.prepacked.get(itemId) === packed;
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
      const holds = fitsInGrid(this.chosenContents, packGridFor(itemId));
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
    if (!fitsInGrid(this.chosenContents, packGridFor(itemId))) {
      return `${packName(itemId)} holds ${packSquares(itemId)} squares and you have packed ${this.bagCells.used}. Take something out first.`;
    }
    // The medicine the default packed is not the player's choice yet, so it
    // is packed again for the pack now being worn rather than standing in the
    // way of it: a smaller pack takes less of it, a bigger one more.
    const repack = [...this.prepacked.keys()].filter((prepacked) => this.isPrepacked(prepacked));
    for (const prepacked of repack) {
      this.selectedItems.delete(prepacked);
      this.securedItemCounts.delete(prepacked);
    }
    this.prepacked.clear();
    this.packItemIdValue = itemId;
    if (repack.length > 0) {
      this.packMedicine(repack);
    }
    this.refillSecureSlot();
    this.holdLayouts();
    return undefined;
  }

  /**
   * What is packed less whatever the medicine default put in and the player
   * has not touched since - the part of the pack that is the player's own
   * choice, and so the part a change of pack has to make room for.
   */
  private get chosenContents(): Readonly<Record<string, number>> {
    const contents: Record<string, number> = { ...this.packedContents };
    for (const itemId of this.prepacked.keys()) {
      if (this.isPrepacked(itemId)) {
        delete contents[itemId];
      }
    }
    return contents;
  }

  public get step(): DeploymentStep {
    return this.currentStep;
  }

  /**
   * Carries these choices over to the vault as storage now has it: a panel
   * opened from the hall reads the save again, and another tab may have spent
   * something. Everything chosen is resolved against the live stash on every
   * read, so a Pokemon or a supply it no longer holds simply drops out.
   */
  public rebase(stash: Stash): void {
    this.stash = stash;
    this.packItemIdValue = this.packItemId;
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

  /** Who a wipe would take: the party, less whoever is in the container. */
  public get riskedPokemon(): readonly StashedPokemon[] {
    const secured = this.securedPokemon;
    return this.party.filter((stored) => !secured.includes(stored));
  }

  /** What a wipe would take of the pack's contents: what was packed, less what is in the container. */
  public get riskedItems(): readonly ItemStack[] {
    const secured = this.securedItems;
    return this.items
      .map(({ itemId, quantity }) => ({
        itemId,
        quantity: quantity - (secured.find((held) => held.itemId === itemId)?.quantity ?? 0),
      }))
      .filter((item) => item.quantity > 0);
  }

  /**
   * What is in the secure container: loadout supplies the player put in it, and
   * room set aside for the found goods they expect to bring back - materials,
   * and the money they have not picked up yet.
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

  /**
   * What the container was left holding, for the save to start next raid from.
   *
   * Only a container the player touched says anything new. One the autofill
   * filled is the preference it was filled from: read back off its contents, a
   * raid whose party had no Pokemon small enough went home remembering "no
   * Pokemon", and every later raid deployed its best unprotected.
   */
  public get securePreference(): SecurePreference {
    if (!this.secureTouched) {
      return this.preference;
    }
    return {
      pokemon: this.securedPokemon.length > 0,
      items: this.securedItems.map(({ itemId, quantity }) => ({ itemId, quantity })),
    };
  }

  /**
   * Whether anything packed is a ball, and whether the base holds one to pack.
   * The default packs medicine only, so a first loadout carries no ball and its
   * raid cannot catch; the loadout says so rather than packing one unasked.
   */
  public get packsABall(): boolean {
    return this.items.some(({ itemId }) => isBallItem(itemId));
  }

  public get ballAtBase(): boolean {
    return Object.keys(this.stash.listItems()).some(
      (itemId) => isBallItem(itemId) && this.stash.itemCount(itemId) > 0,
    );
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
    // A fainted Pokemon cannot fight and nothing in a raid revives one, so in
    // the party it is only something a wipe can take: the row used to read ADD
    // and pack it, secure slot and all, under a help line saying it could not
    // fight.
    const fainted = this.stash.listPokemon().find((stored) => stored.id === id)?.pokemon;
    if (fainted?.isFainted) {
      return faintedRefusal(fainted.name, this.stash.listPokemon().length === 1);
    }
    if (this.selectedPokemonIds.length >= MAX_RUN_PARTY) {
      return `Your run party can hold up to ${MAX_RUN_PARTY} Pokémon.`;
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
        partner: this.partnerSpecies.has(stored.pokemon.base.id),
      })),
      this.preference,
      this.secureGrid,
      this.securePokemonSlots,
      (itemId) => this.itemQuantity(itemId),
      // When no Pokemon fits, the medicine the loadout carries rather than nothing.
      this.packedMedicine,
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
    // Materials are for Brock and money is for Bill: neither
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
    return `${stored.pokemon.name.toUpperCase()} needs ${squares} - ${room}. Take something out, or grow the container.`;
  }

  /**
   * Puts one more *square* of a kind into the secure container, or takes one
   * out.
   *
   * A square rather than a unit, because that is what the container is measured
   * in and what the row's own line says one of these costs. For everything a
   * square holds one of they are the same number; for the money, which stacks a
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

  /**
   * Why nobody can jump yet, in the marshal's own terms, or undefined when
   * somebody can. A fainted Pokemon cannot fight and nothing in a raid revives
   * one, and a bench with nobody on it is not a raid party.
   */
  public get notReady(): string | undefined {
    if (this.isDeployable) {
      return undefined;
    }
    const standing = this.stash.listPokemon().some((stored) => !stored.pokemon.isFainted);
    if (!standing) {
      return 'Everyone you have has fainted. Nurse Joy can revive them, out of the door and across the yard.';
    }
    return this.party.length === 0
      ? 'Nobody is on the bench. Choose at least one Pokémon to take into the raid.'
      : 'Everybody on the bench has fainted. Choose somebody who can fight, or see Nurse Joy.';
  }

  /**
   * Looks the plan over: the player is at the rim and the raid is one press away.
   *
   * @returns A message when nobody can go yet, otherwise undefined.
   */
  public advance(): string | undefined {
    const refusal = this.notReady;
    if (refusal === undefined) {
      this.currentStep = 'confirm';
    }
    return refusal;
  }

  /** Steps back from the rim, keeping what the player picked. */
  public restart(): void {
    this.currentStep = 'loadout';
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
      secureFilledForYou: !this.secureTouched,
      // The pack deploys laid out the way the player left it, so what they
      // arranged at base is the pack they open in the field.
      bagArrangement: this.bagSeats,
      secureArrangement: this.secureSeats,
    };
  }
}

/** A ball of any kind, as the battle's BALL command counts one (`carriedBalls`). */
function isBallItem(itemId: string): boolean {
  return getItemById(itemId)?.category === ItemCategory.PokeBall;
}
