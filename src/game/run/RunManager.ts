import type { ItemId } from '../items';
import type { Pokemon } from '../pokemon';
import { BASE_SECURE_ITEM_STACKS } from '../objectives/contracts';
import { hunterFleePenaltyMs } from './fleePenalty';

/** The first contract's one stop, kept here so the snapshot can still name it. */
const FIELD_KIT_STEP_ID = 'lost-field-kit';
const MAX_SECURE_ITEM_STACKS = BASE_SECURE_ITEM_STACKS;

/** Time the player has to extract after the raid timer reaches zero. */
export const ENRAGE_GRACE_MS = 15_000;

export const RunPhase = {
  InHub: 'IN_HUB',
  InRun: 'IN_RUN',
  Extracting: 'EXTRACTING',
  Escaped: 'ESCAPED',
  Wiped: 'WIPED',
} as const;

export type RunPhase = (typeof RunPhase)[keyof typeof RunPhase];

export interface ItemStack {
  readonly itemId: ItemId;
  readonly quantity: number;
}

export interface RunLoadout {
  readonly party: readonly Pokemon[];
  readonly items: readonly ItemStack[];
}

export interface RunConfig {
  readonly mapId: string;
  readonly durationMs: number;
  /**
   * How many item stacks this raid's secure slot protects. It is a raid
   * parameter rather than a constant because banking the cordon ledger enlarges
   * it permanently, so the limit belongs to the save, not to the code.
   */
  readonly secureItemStackLimit?: number;
}

export interface SecureSlot {
  readonly pokemon?: Pokemon;
  readonly items?: readonly ItemStack[];
}

export interface RunSnapshot {
  readonly phase: RunPhase;
  readonly loadout: RunLoadout | null;
  readonly secureSlot: SecureSlot;
  readonly caughtPokemon: readonly Pokemon[];
  readonly foundItems: readonly ItemStack[];
  /**
   * Contract stops made this raid, by marker id. A contract is a list of stops
   * rather than one flag because the braid survey is three of them.
   */
  readonly contractSteps: readonly string[];
  /** The first contract's only stop, which several systems still ask about. */
  readonly recoveredFieldKit: boolean;
  readonly defeatedTrainers: number;
  /** Escapes from the hunter so far; the next one costs more raid time. */
  readonly hunterFlees: number;
  readonly mapId: string | null;
  readonly visitedMapIds: readonly string[];
  readonly elapsedMs: number;
  readonly remainingMs: number;
  /**
   * The clock this raid actually started with. Recovery booked at base shortens
   * it, so a result screen that assumed the base duration would misreport how
   * much of the raid was spent.
   */
  readonly durationMs: number;
  /**
   * What each deployed Pokemon's total experience was at the moment of deploy,
   * paired by position with `loadout.party`.
   *
   * A raid is played on the stash's own Pokemon objects, so by the time a raid
   * resolves the party's own numbers are the *end* of the raid and the start of
   * it is gone. Recording it here is what lets the result screen say what the
   * raid was worth without any scene keeping a private copy.
   */
  readonly deployedExperience: readonly number[];
  readonly isEnraged: boolean;
  /**
   * What is left of `ENRAGE_GRACE_MS` once the raid clock has run out, so the
   * HUD can keep counting the only number that still decides the raid. Equal to
   * `ENRAGE_GRACE_MS` while the raid clock is still running.
   */
  readonly enrageGraceRemainingMs: number;
}

export interface RunResult {
  readonly outcome: 'ESCAPED' | 'WIPED';
  readonly bankedPokemon: readonly Pokemon[];
  readonly bankedItems: readonly ItemStack[];
  readonly lostPokemon: readonly Pokemon[];
  readonly lostItems: readonly ItemStack[];
  readonly permadeathPokemon: readonly Pokemon[];
}

export interface RunManagerOptions {
  /** Fires once when the raid timer reaches zero. */
  readonly onEnrage?: (snapshot: RunSnapshot) => void;
  /** Fires once when the enrage grace period ends without an extraction. */
  readonly onExpire?: (snapshot: RunSnapshot) => void;
}

/**
 * Framework-independent owner of one extraction raid's transient state.
 *
 * A consumer should pass its stash-selected loadout to startRun(), report catches
 * and pickups while the phase is IN_RUN, then apply the returned RunResult to
 * persistent storage after the raid resolves.
 */
export class RunManager {
  private phaseValue: RunPhase = RunPhase.InHub;
  private loadoutValue: RunLoadout | null = null;
  private secureSlotValue: SecureSlot = {};
  private caughtPokemonValue: Pokemon[] = [];
  private foundItemsValue: ItemStack[] = [];
  private contractStepsValue: string[] = [];
  private secureItemStackLimitValue = MAX_SECURE_ITEM_STACKS;
  private defeatedTrainersValue = 0;
  private hunterFleesValue = 0;
  private deployedExperienceValue: number[] = [];
  private mapIdValue: string | null = null;
  private visitedMapIdsValue: string[] = [];
  private durationMs = 0;
  private elapsedMsValue = 0;
  private enrageElapsedMs = 0;
  private isEnragedValue = false;
  private enrageNotified = false;
  private expiryNotified = false;
  private readonly options: RunManagerOptions;

  public constructor(options: RunManagerOptions = {}) {
    this.options = options;
  }

  public get phase(): RunPhase {
    return this.phaseValue;
  }

  /** Lets world systems escalate threats without coupling to raid resolution. */
  public get isEnraged(): boolean {
    return this.isEnragedValue;
  }

  public get isEnrageGraceExpired(): boolean {
    return this.isEnragedValue && this.enrageElapsedMs >= ENRAGE_GRACE_MS;
  }

  public enrageGraceRemainingMs(): number {
    return this.isEnragedValue ? Math.max(0, ENRAGE_GRACE_MS - this.enrageElapsedMs) : ENRAGE_GRACE_MS;
  }

  public startRun(
    loadout: RunLoadout,
    config: RunConfig,
    secureSlot: SecureSlot = {},
  ): RunSnapshot {
    this.requirePhase('start a run', RunPhase.InHub, RunPhase.Escaped, RunPhase.Wiped);
    validateRunConfig(config);
    validateItemStacks(loadout.items);
    this.secureItemStackLimitValue = config.secureItemStackLimit ?? MAX_SECURE_ITEM_STACKS;
    validateSecureSlot(secureSlot, loadout.party, loadout.items, this.secureItemStackLimitValue);

    this.loadoutValue = copyLoadout(loadout);
    this.deployedExperienceValue = loadout.party.map((member) => member.experience);
    this.secureSlotValue = copySecureSlot(secureSlot);
    this.caughtPokemonValue = [];
    this.foundItemsValue = [];
    this.contractStepsValue = [];
    this.defeatedTrainersValue = 0;
    this.hunterFleesValue = 0;
    this.mapIdValue = config.mapId;
    this.visitedMapIdsValue = [config.mapId];
    this.durationMs = config.durationMs;
    this.elapsedMsValue = 0;
    this.enrageElapsedMs = 0;
    this.isEnragedValue = false;
    this.enrageNotified = false;
    this.expiryNotified = false;
    this.phaseValue = RunPhase.InRun;
    return this.snapshot();
  }

  public setMap(mapId: string): RunSnapshot {
    this.requirePhase('change maps', RunPhase.InRun);
    if (mapId.length === 0) {
      throw new Error('A run map id must not be empty.');
    }

    this.mapIdValue = mapId;
    if (!this.visitedMapIdsValue.includes(mapId)) {
      this.visitedMapIdsValue.push(mapId);
    }
    return this.snapshot();
  }

  public registerCaughtPokemon(pokemon: Pokemon): RunSnapshot {
    this.requirePhase('register a caught Pokemon', RunPhase.InRun);
    this.caughtPokemonValue.push(pokemon);
    return this.snapshot();
  }

  public registerFoundItem(itemId: ItemId, quantity = 1): RunSnapshot {
    this.requirePhase('register a found item', RunPhase.InRun);
    validateItemStack({ itemId, quantity });
    this.foundItemsValue = combineItems([...this.foundItemsValue, { itemId, quantity }]);
    return this.snapshot();
  }

  /**
   * Records one contract stop. Repeating a stop is a no-op rather than an
   * error: a marker is a tile, and stepping back onto it must not double-count.
   */
  public registerContractStep(stepId: string): RunSnapshot {
    this.requirePhase('record a contract step', RunPhase.InRun);
    if (stepId.length === 0) {
      throw new Error('A contract step id must not be empty.');
    }
    if (!this.contractStepsValue.includes(stepId)) {
      this.contractStepsValue.push(stepId);
    }
    return this.snapshot();
  }

  public recoverFieldKit(): RunSnapshot {
    return this.registerContractStep(FIELD_KIT_STEP_ID);
  }

  public registerTrainerDefeat(): RunSnapshot {
    this.requirePhase('register a trainer defeat', RunPhase.InRun);
    this.defeatedTrainersValue += 1;
    return this.snapshot();
  }

  /**
   * What the next escape from the hunter will cost, so the battle screen can print
   * the price on the command before the player commits to it.
   */
  public nextHunterFleePenaltyMs(): number {
    return hunterFleePenaltyMs(this.hunterFleesValue);
  }

  /**
   * Charges an escape from the hunter to the raid clock.
   *
   * The penalty goes through tick(), so an escape that runs the clock out enrages
   * the raid on exactly the path the timer already uses. It never fails: fleeing is
   * a priced choice, not a roll, and the price is shown before the player takes it.
   */
  public registerHunterFlee(): { readonly penaltyMs: number; readonly snapshot: RunSnapshot } {
    this.requirePhase('flee the hunter', RunPhase.InRun);
    const penaltyMs = this.nextHunterFleePenaltyMs();
    this.hunterFleesValue += 1;
    return { penaltyMs, snapshot: this.tick(penaltyMs) };
  }

  public tick(elapsedMs: number): RunSnapshot {
    this.requirePhase('tick the run clock', RunPhase.InRun);
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
      throw new Error('Run clock ticks must be finite, non-negative numbers.');
    }

    if (!this.isEnragedValue) {
      const totalElapsedMs = this.elapsedMsValue + elapsedMs;
      this.elapsedMsValue = Math.min(this.durationMs, totalElapsedMs);
      if (this.elapsedMsValue === this.durationMs) {
        this.isEnragedValue = true;
        this.enrageElapsedMs = totalElapsedMs - this.durationMs;
      }
    } else {
      this.enrageElapsedMs += elapsedMs;
    }

    const snapshot = this.snapshot();
    if (this.isEnragedValue && !this.enrageNotified) {
      this.enrageNotified = true;
      this.options.onEnrage?.(snapshot);
    }
    if (this.isEnrageGraceExpired && !this.expiryNotified) {
      this.expiryNotified = true;
      this.options.onExpire?.(snapshot);
    }
    return snapshot;
  }

  public remainingMs(): number {
    return Math.max(0, this.durationMs - this.elapsedMsValue);
  }

  public beginExtraction(): RunSnapshot {
    this.requirePhase('begin extraction', RunPhase.InRun);
    this.phaseValue = RunPhase.Extracting;
    return this.snapshot();
  }

  public resolveEscape(): RunResult {
    this.beginResolution();
    const bankedPokemon = this.allPokemon();
    const bankedItems = this.allItems();
    const result: RunResult = {
      outcome: 'ESCAPED',
      bankedPokemon,
      bankedItems,
      lostPokemon: [],
      lostItems: [],
      permadeathPokemon: [],
    };
    this.phaseValue = RunPhase.Escaped;
    return result;
  }

  public resolveWipe(secureSlot?: SecureSlot): RunResult {
    this.requirePhase('resolve a run', RunPhase.InRun, RunPhase.Extracting);
    const allPokemon = this.allPokemon();
    const allItems = this.allItems();
    const resolvedSecureSlot = secureSlot ?? this.secureSlotValue;
    validateSecureSlot(resolvedSecureSlot, allPokemon, allItems, this.secureItemStackLimitValue);
    this.beginResolution();

    const bankedPokemon =
      resolvedSecureSlot.pokemon === undefined ? [] : [resolvedSecureSlot.pokemon];
    const bankedItems = combineItems(resolvedSecureSlot.items ?? []);
    const lostPokemon = removePokemon(allPokemon, bankedPokemon);
    const lostItems = subtractItems(allItems, bankedItems);
    const result: RunResult = {
      outcome: 'WIPED',
      bankedPokemon,
      bankedItems,
      lostPokemon,
      lostItems,
      permadeathPokemon: lostPokemon,
    };
    this.phaseValue = RunPhase.Wiped;
    return result;
  }

  public snapshot(): RunSnapshot {
    return {
      phase: this.phaseValue,
      loadout: this.loadoutValue === null ? null : copyLoadout(this.loadoutValue),
      secureSlot: copySecureSlot(this.secureSlotValue),
      caughtPokemon: [...this.caughtPokemonValue],
      foundItems: [...this.foundItemsValue],
      contractSteps: [...this.contractStepsValue],
      recoveredFieldKit: this.contractStepsValue.includes(FIELD_KIT_STEP_ID),
      defeatedTrainers: this.defeatedTrainersValue,
      hunterFlees: this.hunterFleesValue,
      mapId: this.mapIdValue,
      visitedMapIds: [...this.visitedMapIdsValue],
      elapsedMs: this.elapsedMsValue,
      remainingMs: this.remainingMs(),
      durationMs: this.durationMs,
      isEnraged: this.isEnragedValue,
      deployedExperience: [...this.deployedExperienceValue],
      enrageGraceRemainingMs: this.enrageGraceRemainingMs(),
    };
  }

  private beginResolution(): void {
    if (this.phaseValue === RunPhase.InRun) {
      this.phaseValue = RunPhase.Extracting;
      return;
    }
    this.requirePhase('resolve a run', RunPhase.Extracting);
  }

  private allPokemon(): Pokemon[] {
    return [...(this.loadoutValue?.party ?? []), ...this.caughtPokemonValue];
  }

  private allItems(): ItemStack[] {
    return combineItems([...(this.loadoutValue?.items ?? []), ...this.foundItemsValue]);
  }

  private requirePhase(action: string, ...allowedPhases: readonly RunPhase[]): void {
    if (!allowedPhases.includes(this.phaseValue)) {
      throw new RunTransitionError(action, this.phaseValue, allowedPhases);
    }
  }
}

export class RunTransitionError extends Error {
  public readonly currentPhase: RunPhase;
  public readonly allowedPhases: readonly RunPhase[];

  public constructor(
    action: string,
    currentPhase: RunPhase,
    allowedPhases: readonly RunPhase[],
  ) {
    super(`Cannot ${action} while run phase is ${currentPhase}.`);
    this.name = 'RunTransitionError';
    this.currentPhase = currentPhase;
    this.allowedPhases = allowedPhases;
  }
}

function copyLoadout(loadout: RunLoadout): RunLoadout {
  return {
    party: [...loadout.party],
    items: combineItems(loadout.items),
  };
}

function copySecureSlot(secureSlot: SecureSlot): SecureSlot {
  return {
    ...(secureSlot.pokemon === undefined ? {} : { pokemon: secureSlot.pokemon }),
    ...(secureSlot.items === undefined ? {} : { items: combineItems(secureSlot.items) }),
  };
}

function validateRunConfig(config: RunConfig): void {
  if (config.mapId.length === 0) {
    throw new Error('A run map id must not be empty.');
  }
  if (!Number.isFinite(config.durationMs) || config.durationMs < 0) {
    throw new Error('Run duration must be a finite, non-negative number.');
  }
}

function validateSecureSlot(
  secureSlot: SecureSlot,
  availablePokemon: readonly Pokemon[],
  availableItems: readonly ItemStack[],
  itemStackLimit: number = MAX_SECURE_ITEM_STACKS,
): void {
  if (
    secureSlot.pokemon !== undefined &&
    !availablePokemon.some((pokemon) => pokemon === secureSlot.pokemon)
  ) {
    throw new Error('The secure-slot Pokemon must come from the current run.');
  }

  const secureItems = secureSlot.items ?? [];
  if (secureItems.length > itemStackLimit) {
    throw new Error(`A secure slot can contain at most ${itemStackLimit} item stacks.`);
  }
  validateItemStacks(secureItems);

  const availableQuantities = toItemQuantities(availableItems);
  for (const item of combineItems(secureItems)) {
    if ((availableQuantities.get(item.itemId) ?? 0) < item.quantity) {
      throw new Error(`The secure slot contains unavailable item "${item.itemId}".`);
    }
  }
}

function validateItemStacks(items: readonly ItemStack[]): void {
  for (const item of items) {
    validateItemStack(item);
  }
}

function validateItemStack(item: ItemStack): void {
  if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
    throw new Error('Item quantities must be positive integers.');
  }
}

function combineItems(items: readonly ItemStack[]): ItemStack[] {
  const quantities = toItemQuantities(items);
  return [...quantities].map(([itemId, quantity]) => ({ itemId, quantity }));
}

function toItemQuantities(items: readonly ItemStack[]): Map<ItemId, number> {
  const quantities = new Map<ItemId, number>();
  for (const item of items) {
    quantities.set(item.itemId, (quantities.get(item.itemId) ?? 0) + item.quantity);
  }
  return quantities;
}

function removePokemon(pokemon: readonly Pokemon[], kept: readonly Pokemon[]): Pokemon[] {
  const remainingKept = [...kept];
  return pokemon.filter((member) => {
    const keptIndex = remainingKept.indexOf(member);
    if (keptIndex === -1) {
      return true;
    }
    remainingKept.splice(keptIndex, 1);
    return false;
  });
}

function subtractItems(items: readonly ItemStack[], kept: readonly ItemStack[]): ItemStack[] {
  const keptQuantities = toItemQuantities(kept);
  return combineItems(items)
    .map((item) => ({
      itemId: item.itemId,
      quantity: item.quantity - (keptQuantities.get(item.itemId) ?? 0),
    }))
    .filter((item) => item.quantity > 0);
}
