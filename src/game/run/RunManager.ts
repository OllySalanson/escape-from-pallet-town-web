import type { ItemId } from '../items';
import type { Pokemon } from '../pokemon';

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
}

export interface SecureSlot {
  readonly pokemon?: Pokemon;
  readonly items?: readonly ItemStack[];
}

export interface RunSnapshot {
  readonly phase: RunPhase;
  readonly loadout: RunLoadout | null;
  readonly caughtPokemon: readonly Pokemon[];
  readonly foundItems: readonly ItemStack[];
  readonly mapId: string | null;
  readonly elapsedMs: number;
  readonly remainingMs: number;
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
  private caughtPokemonValue: Pokemon[] = [];
  private foundItemsValue: ItemStack[] = [];
  private mapIdValue: string | null = null;
  private durationMs = 0;
  private elapsedMsValue = 0;
  private expiryNotified = false;
  private readonly options: RunManagerOptions;

  public constructor(options: RunManagerOptions = {}) {
    this.options = options;
  }

  public get phase(): RunPhase {
    return this.phaseValue;
  }

  public startRun(loadout: RunLoadout, config: RunConfig): RunSnapshot {
    this.requirePhase('start a run', RunPhase.InHub, RunPhase.Escaped, RunPhase.Wiped);
    validateRunConfig(config);
    validateItemStacks(loadout.items);

    this.loadoutValue = copyLoadout(loadout);
    this.caughtPokemonValue = [];
    this.foundItemsValue = [];
    this.mapIdValue = config.mapId;
    this.durationMs = config.durationMs;
    this.elapsedMsValue = 0;
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

  public tick(elapsedMs: number): RunSnapshot {
    this.requirePhase('tick the run clock', RunPhase.InRun);
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
      throw new Error('Run clock ticks must be finite, non-negative numbers.');
    }

    this.elapsedMsValue = Math.min(this.durationMs, this.elapsedMsValue + elapsedMs);
    const snapshot = this.snapshot();
    if (this.elapsedMsValue === this.durationMs && !this.expiryNotified) {
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

  public resolveWipe(secureSlot: SecureSlot = {}): RunResult {
    this.requirePhase('resolve a run', RunPhase.InRun, RunPhase.Extracting);
    const allPokemon = this.allPokemon();
    const allItems = this.allItems();
    validateSecureSlot(secureSlot, allPokemon, allItems);
    this.beginResolution();

    const bankedPokemon = secureSlot.pokemon === undefined ? [] : [secureSlot.pokemon];
    const bankedItems = combineItems(secureSlot.items ?? []);
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
      caughtPokemon: [...this.caughtPokemonValue],
      foundItems: [...this.foundItemsValue],
      mapId: this.mapIdValue,
      elapsedMs: this.elapsedMsValue,
      remainingMs: this.remainingMs(),
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
): void {
  if (
    secureSlot.pokemon !== undefined &&
    !availablePokemon.some((pokemon) => pokemon === secureSlot.pokemon)
  ) {
    throw new Error('The secure-slot Pokemon must come from the current run.');
  }

  const secureItems = secureSlot.items ?? [];
  if (secureItems.length > 2) {
    throw new Error('A secure slot can contain at most two item stacks.');
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
