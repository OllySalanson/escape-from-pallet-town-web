import { RAID_BAG_GRID, VAULT_GRID } from './containers';
import { ITEM_DEFINITIONS, type ItemCategory, type ItemDefinition } from './items';
import {
  fitsInGrid,
  packContents,
  roomFor,
  type GridCargo,
  type GridPacking,
  type GridSize,
} from './itemGrid';

export type BagContents = Readonly<Record<string, number>>;

/**
 * A run's item inventory, and the chequered squares it is packed into.
 *
 * Contents are still a plain id-to-quantity record, so everything that settles a
 * raid counts items exactly as it did before a grid existed. What the grid adds
 * is one word the bag could never say: no. `add` refuses what will not fit, and
 * because it already returned a boolean that every caller already checked -
 * loot pickup, boss gear, the run's collection seam - the refusal reaches the
 * player as the message those callers were already written to show.
 *
 * Where each piece sits is derived by `layout()` from the contents and the
 * capacity, never stored. See `./itemGrid` for why.
 *
 * A pack also carries **cargo**: the Pokemon a raid caught or was given, which
 * take squares by evolution stage (`../pokemon/pokemonCargo.ts`). Cargo is not
 * contents - it never enters `toJSON`, the supply delta or any save - it is a
 * list of rectangles the pack is told about so that `add` and `fits` answer
 * with the room that is actually left. The raid owns the Pokemon; the pack only
 * owns the squares they stand on.
 */
export class Bag {
  private readonly contents: Record<string, number>;
  /**
   * The squares this pack has. A property, so the Outfitter can grow it - and
   * `null` for the vault at base, which is a warehouse rather than a pack and
   * has never had a size. A raid is what is carried; the stash is what is kept.
   */
  public readonly capacity: GridSize | null;
  /** The Pokemon this pack is carrying home, as squares. Never persisted. */
  private cargoValue: readonly GridCargo[] = [];

  public constructor(
    initialContents: BagContents = {},
    capacity: GridSize | null = RAID_BAG_GRID,
  ) {
    this.capacity = capacity;
    this.contents = {};
    // Contents handed in are taken as given rather than re-packed: a vault is
    // not a pack and has no size, and a pack rebuilt from a battle must come
    // back holding exactly what it went in with.
    for (const [itemId, quantity] of Object.entries(initialContents)) {
      if (Number.isInteger(quantity) && quantity > 0) {
        this.contents[itemId] = quantity;
      }
    }
  }

  public get cargo(): readonly GridCargo[] {
    return this.cargoValue;
  }

  /**
   * Tells the pack what it is carrying home.
   *
   * The raid's own catch list is the truth, so this is re-derived from it on
   * every scene that rebuilds the world rather than pushed a piece at a time:
   * a battle tears the overworld down and hands the same `Bag` back, and a pack
   * that had been told about a Pokemon twice would charge for it twice.
   */
  public setCargo(cargo: readonly GridCargo[]): void {
    this.cargoValue = [...cargo];
  }

  /**
   * Whether one more piece of cargo would go in beside everything already here.
   *
   * Asked *before* a ball is thrown, because a pack with no room must refuse
   * the catch out loud: losing the Pokemon afterwards would be the same fact
   * told dishonestly, and it would cost a ball to hear it.
   */
  public fitsCargo(piece: GridCargo): boolean {
    return (
      this.capacity === null ||
      fitsInGrid(this.contents, this.capacity, [...this.cargoValue, piece])
    );
  }

  /** @returns False when the pack has no room, having changed nothing. */
  public add(itemId: string, quantity = 1): boolean {
    if (!isPositiveInteger(quantity)) {
      return false;
    }
    if (!this.fits(itemId, quantity)) {
      return false;
    }

    this.contents[itemId] = this.count(itemId) + quantity;
    return true;
  }

  public remove(itemId: string, quantity = 1): boolean {
    if (!isPositiveInteger(quantity) || this.count(itemId) < quantity) {
      return false;
    }

    const remaining = this.contents[itemId] - quantity;
    if (remaining === 0) {
      delete this.contents[itemId];
    } else {
      this.contents[itemId] = remaining;
    }
    return true;
  }

  public count(itemId: string): number {
    return this.contents[itemId] ?? 0;
  }

  /** Whether this many more of an id would go in beside what is already here. */
  public fits(itemId: string, quantity = 1): boolean {
    return (
      this.capacity === null ||
      fitsInGrid(
        { ...this.contents, [itemId]: this.count(itemId) + quantity },
        this.capacity,
        this.cargoValue,
      )
    );
  }

  /**
   * Whether a whole set of additions goes in **together**.
   *
   * Asked as one question rather than one id at a time, because a cache is
   * taken whole or not at all: two Poke Balls that fit and a Potion that does
   * not used to leave the balls in the pack and the cache still sealed, which
   * is a cache that can be opened twice.
   */
  public fitsAll(
    additions: readonly { readonly itemId: string; readonly quantity: number }[],
  ): boolean {
    if (this.capacity === null) {
      return true;
    }
    const trial: Record<string, number> = { ...this.contents };
    for (const { itemId, quantity } of additions) {
      trial[itemId] = (trial[itemId] ?? 0) + quantity;
    }
    return fitsInGrid(trial, this.capacity, this.cargoValue);
  }

  /** How many more of an id would go in, up to `limit`. */
  public room(itemId: string, limit = 99): number {
    return this.capacity === null
      ? limit
      : roomFor(this.contents, this.capacity, itemId, limit, this.cargoValue);
  }

  /** Where everything sits, recomputed from the contents every time it is asked. */
  public layout(): GridPacking {
    return packContents(this.contents, this.capacity ?? VAULT_GRID, this.cargoValue);
  }

  public itemsInCategory(category: ItemCategory): readonly ItemDefinition[] {
    return ITEM_DEFINITIONS.filter(
      (item) => item.category === category && this.count(item.id) > 0,
    );
  }

  public toJSON(): BagContents {
    return { ...this.contents };
  }
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}
