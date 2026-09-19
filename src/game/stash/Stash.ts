import {
  Bag,
  BASE_SECURE_GRID,
  fitsInGrid,
  getItemById,
  isHeldItemId,
  isMaterial,
  type BagContents,
  type GridSize,
} from '../items';
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

/** How many Pokemon one box holds, as in the games this is dressed as. */
export const BOX_CAPACITY = 30;
/** Longest box name; the game's face has to fit it in a chip at the smallest stage. */
export const MAX_BOX_NAME_LENGTH = 12;

/**
 * A named box and the Pokemon in it. Boxes are only a way of *finding*: every
 * Pokemon is still one entry in `Stash.listPokemon()`, which is what the
 * Outfitter's payment, the swap-partner offer, the loadout and a wipe all read,
 * so a boxed Pokemon is exactly as spendable and as deployable as it was in one
 * flat list.
 */
export interface StashBox {
  readonly name: string;
  readonly pokemonIds: readonly string[];
}

export interface StashContents {
  readonly pokemon: readonly StashedPokemon[];
  readonly items: BagContents;
  /**
   * The boxes, in order. Absent on every save written before boxes existed,
   * which reads as one box holding everything - so a flat stash is box one
   * without anybody being asked. Ids that name no Pokemon are dropped and any
   * Pokemon no box names is put in the first box with room.
   */
  readonly boxes?: readonly StashBox[];
}

/**
 * The extraction manager passes this shape to bankRun. A completed run contains
 * only Pokemon that survived to extraction and every item found during the run.
 */
export interface RunResult {
  readonly pokemon: readonly Pokemon[];
  readonly items: readonly { readonly itemId: string; readonly quantity: number }[];
  /** Gifts among `pokemon`, by gift id, for the save to record as received. */
  readonly gifts?: readonly string[];
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
  /**
   * The gear this Pokemon was carrying when the raid ended, or null for an
   * empty slot.
   *
   * It travels home on the condition rather than in the supply delta because
   * gear is not in the pack: it is on the Pokemon, which is what makes it
   * something a wipe can take. Carried on every ending, including a lost one -
   * a secured Pokemon comes home holding what it held.
   */
  readonly heldItemId: string | null;
  /**
   * The moveset the raid ended with, by name. Battle asks the player what to
   * forget and applies it to the raid's own Pokemon, which this settlement
   * outlives; replaying experience alone would re-derive the level-up and lose
   * the choice, so the answer travels with the condition. A settlement with no
   * moveset (nobody was asked) keeps what the replay produced: the move is
   * queued on the Pokemon, never forgotten, and the base asks.
   */
  readonly moves?: readonly string[];
  /** Moves still waiting on a choice; the base asks about them (see `HubScene`). */
  readonly pendingMoves?: readonly string[];
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
  /** The squares the container has. What fits in them is what comes home. */
  readonly grid: GridSize;
}

/** The secure slot every save starts with: one Pokemon and four squares. */
export const BASE_SECURE_SLOT_LIMITS: SecureSlotLimits = {
  pokemon: 1,
  grid: BASE_SECURE_GRID,
};

/**
 * The persistent vault. Its methods only change in-memory state; persistence is
 * deliberately handled by SaveManager so the model remains easy to test.
 */
export class Stash {
  private readonly storedPokemon: StashedPokemon[];
  private readonly bag: Bag;
  /** Every stored Pokemon is in exactly one of these, and there is always one. */
  private readonly boxes: { name: string; pokemonIds: string[] }[] = [];

  public constructor(contents: Partial<StashContents> = {}) {
    this.storedPokemon = [...(contents.pokemon ?? [])];
    // The vault has no size. A grid is what a raid is carried in; what a
    // player has banked is a warehouse, and capping it would make banking a
    // thing that can fail.
    this.bag = new Bag(contents.items, null);
    this.arrangeBoxes(contents.boxes ?? []);
  }

  /**
   * Every Pokemon in the vault, whichever box it is in. Boxes are a view over
   * this list, never a partition of it: anything that asks "what do I own"
   * asks here.
   */
  public listPokemon(): readonly StashedPokemon[] {
    return [...this.storedPokemon];
  }

  public listBoxes(): readonly StashBox[] {
    return this.boxes.map((box) => ({ name: box.name, pokemonIds: [...box.pokemonIds] }));
  }

  /** The Pokemon in one box, in the order the box holds them. */
  public listBoxPokemon(boxIndex: number): readonly StashedPokemon[] {
    return (this.boxes[boxIndex]?.pokemonIds ?? [])
      .map((id) => this.storedPokemon.find((stored) => stored.id === id))
      .filter((stored): stored is StashedPokemon => stored !== undefined);
  }

  /** Which box holds this Pokemon, or -1 when it is not in the vault. */
  public boxIndexOf(pokemonId: string): number {
    return this.boxes.findIndex((box) => box.pokemonIds.includes(pokemonId));
  }

  public boxHasRoom(boxIndex: number): boolean {
    const box = this.boxes[boxIndex];
    return box !== undefined && box.pokemonIds.length < BOX_CAPACITY;
  }

  /**
   * Moves a Pokemon into another box. Refused into a full box, into the box it
   * is already in, and for anything not in the vault - nothing is ever created,
   * removed or reordered in the flat list by it.
   */
  public movePokemon(pokemonId: string, boxIndex: number): boolean {
    const from = this.boxIndexOf(pokemonId);
    if (from < 0 || from === boxIndex || !this.boxHasRoom(boxIndex)) {
      return false;
    }
    this.boxes[from].pokemonIds = this.boxes[from].pokemonIds.filter((id) => id !== pokemonId);
    this.boxes[boxIndex].pokemonIds.push(pokemonId);
    return true;
  }

  /**
   * Names a box. The name is tidied (trimmed, runs of space collapsed, cut to
   * `MAX_BOX_NAME_LENGTH`) and refused if it is empty or another box already
   * wears it, because two boxes with one name are a place nobody can be sent to
   * on purpose.
   */
  public renameBox(boxIndex: number, name: string): boolean {
    const box = this.boxes[boxIndex];
    const tidy = tidyBoxName(name);
    if (!box || tidy.length === 0) {
      return false;
    }
    if (this.boxes.some((other, index) => index !== boxIndex && sameName(other.name, tidy))) {
      return false;
    }
    box.name = tidy;
    return true;
  }

  /** Adds an empty box on the end and returns its index. */
  public addBox(): number {
    this.boxes.push({ name: this.nextBoxName(), pokemonIds: [] });
    return this.boxes.length - 1;
  }

  /** Removes a box that holds nothing. The last box, and any box in use, stays. */
  public removeBox(boxIndex: number): boolean {
    const box = this.boxes[boxIndex];
    if (!box || box.pokemonIds.length > 0 || this.boxes.length <= 1) {
      return false;
    }
    this.boxes.splice(boxIndex, 1);
    return true;
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
    this.placeInFirstBoxWithRoom(id);
    return id;
  }

  public removePokemon(id: string): Pokemon | null {
    const index = this.storedPokemon.findIndex((stored) => stored.id === id);
    if (index < 0) {
      return null;
    }

    for (const box of this.boxes) {
      box.pokemonIds = box.pokemonIds.filter((boxed) => boxed !== id);
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
      // The replay above re-derives what the level-up offered; what the player
      // decided about it in the raid is the truth, so it overrides. After any
      // evolution, so the moves resolve against the line it now belongs to.
      if (entry.moves) {
        stored.pokemon.restoreMoveset(entry.moves, entry.pendingMoves ?? []);
      }
      stored.pokemon.currentHp = clampHp(entry.currentHp, stored.pokemon.maxHp);
      stored.pokemon.primaryStatus = entry.primaryStatus;
      stored.pokemon.giveHeldItem(entry.heldItemId);
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

  /**
   * Moves one piece of gear out of the vault's supplies and onto a Pokemon,
   * putting whatever it displaced back in the supplies.
   *
   * It is a move rather than a copy in both directions, so the gear a save holds
   * is always either on a Pokemon or in the bag and never in both - the one rule
   * that keeps "one item per Pokemon, never two" honest across a give, a swap and
   * a take.
   *
   * @returns Whether the gear changed hands.
   */
  public giveHeldItem(pokemonId: string, itemId: string): boolean {
    const stored = this.storedPokemon.find((entry) => entry.id === pokemonId);
    if (!stored || !isHeldItemId(itemId) || this.itemCount(itemId) <= 0) {
      return false;
    }
    if (stored.pokemon.heldItemId === itemId) {
      return false;
    }
    this.removeItem(itemId, 1);
    const displaced = stored.pokemon.giveHeldItem(itemId);
    if (displaced) {
      this.addItem(displaced, 1);
    }
    return true;
  }

  /** Takes a Pokemon's gear back into the vault's supplies. */
  public takeHeldItem(pokemonId: string): boolean {
    const stored = this.storedPokemon.find((entry) => entry.id === pokemonId);
    const taken = stored?.pokemon.takeHeldItem();
    if (!taken) {
      return false;
    }
    this.addItem(taken, 1);
    return true;
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
    const box = Math.max(0, this.boxIndexOf(outgoing.id));
    this.removePokemon(outgoing.id);
    const id = this.addPokemon(incoming);
    // The partner stays where the old one was kept.
    this.movePokemon(id, box);
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
   * it reported that stack as safe. They are squares now, and the cut is made
   * by the same packer that drew the container, so what a screen showed fitting
   * is exactly what a wipe honours.
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

    const securedItems = cutToContainer(secureSlot.items ?? [], limits.grid);
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
    return { pokemon: this.listPokemon(), items: this.listItems(), boxes: this.listBoxes() };
  }

  /**
   * Builds the boxes from what a save names, then finds a home for everything it
   * did not: a save from before boxes, a Pokemon a hand-edited save left out, or
   * a box a save overfilled. There is always at least one box.
   */
  private arrangeBoxes(saved: readonly StashBox[]): void {
    const known = new Set(this.storedPokemon.map((stored) => stored.id));
    const placed = new Set<string>();
    for (const savedBox of saved) {
      const ids: string[] = [];
      for (const id of savedBox.pokemonIds) {
        if (known.has(id) && !placed.has(id) && ids.length < BOX_CAPACITY) {
          ids.push(id);
          placed.add(id);
        }
      }
      const tidy = tidyBoxName(savedBox.name);
      const name =
        tidy.length > 0 && !this.boxes.some((box) => sameName(box.name, tidy)) ? tidy : this.nextBoxName();
      this.boxes.push({ name, pokemonIds: ids });
    }
    if (this.boxes.length === 0) {
      this.boxes.push({ name: this.nextBoxName(), pokemonIds: [] });
    }
    for (const { id } of this.storedPokemon) {
      if (!placed.has(id)) {
        this.placeInFirstBoxWithRoom(id);
      }
    }
  }

  private placeInFirstBoxWithRoom(id: string): void {
    const box = this.boxes.find((candidate) => candidate.pokemonIds.length < BOX_CAPACITY);
    if (box) {
      box.pokemonIds.push(id);
      return;
    }
    // Banking a raid can never fail for want of room: a full vault grows a box.
    this.boxes.push({ name: this.nextBoxName(), pokemonIds: [id] });
  }

  private nextBoxName(): string {
    let number = this.boxes.length + 1;
    while (this.boxes.some((box) => sameName(box.name, `Box ${number}`))) {
      number += 1;
    }
    return `Box ${number}`;
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
/**
 * What of a secure slot the container actually holds, entry by entry in the
 * order they were chosen, dropping the first thing that will not fit and
 * everything after it. A slot built by the loadout screen already fits; this is
 * the last word on one that came from anywhere else.
 */
function cutToContainer(
  items: readonly { readonly itemId: string; readonly quantity: number }[],
  grid: GridSize,
): Map<string, number> {
  const held = new Map<string, number>();
  for (const { itemId, quantity } of items) {
    if (!isPositiveInteger(quantity)) {
      continue;
    }
    const next = new Map(held).set(itemId, (held.get(itemId) ?? 0) + quantity);
    if (!fitsInGrid(Object.fromEntries(next), grid)) {
      break;
    }
    held.set(itemId, next.get(itemId)!);
  }
  return held;
}

export function starterInConditionOf(outgoing: Pokemon, starter: PokemonBase): Pokemon {
  const incoming = new Pokemon(starter, 5);
  const carriedHp = outgoing.isFainted
    ? 0
    : Math.max(1, Math.floor((incoming.maxHp * outgoing.currentHp) / outgoing.maxHp));
  incoming.takeDamage(incoming.maxHp - carriedHp);
  incoming.primaryStatus = outgoing.primaryStatus;
  // The gear comes across with the condition. A swap is a change of species; it
  // is not a way to lose a piece of gear that can never be found twice.
  incoming.giveHeldItem(outgoing.heldItemId);
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

function tidyBoxName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_BOX_NAME_LENGTH).trim();
}

function sameName(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}
