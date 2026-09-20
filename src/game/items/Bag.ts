import { RAID_BAG_GRID, VAULT_GRID } from './containers';
import { ITEM_DEFINITIONS, type ItemCategory, type ItemDefinition } from './items';
import {
  arrangementOf,
  EMPTY_ARRANGEMENT,
  fitsInGrid,
  packContents,
  roomFor,
  tidyArrangement,
  tidyWouldFit,
  type GridArrangement,
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
 * Where each piece sits is derived by `layout()` from the contents, the
 * capacity and the **arrangement** - the seats the player chose. The pack keeps
 * that arrangement, so a pack somebody laid out by hand comes back the way they
 * left it: a battle hands the same `Bag` back, and a raid hands its arrangement
 * home through the settlement. Until anything is moved it is empty, which is
 * the automatic pack exactly as it always was. See `./itemGrid` for the rule
 * that a seat is honoured before anything is packed automatically.
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
  /** The seats the player chose. Empty until they move something. */
  private arrangementValue: GridArrangement = EMPTY_ARRANGEMENT;
  /**
   * Whether anything has been arranged by hand.
   *
   * Once it has, the whole layout is written down after every change, so a
   * Potion picked up in the field is seated in the room that is left and
   * nothing the player placed moves out from under it.
   */
  private arrangedByHand = false;

  public constructor(
    initialContents: BagContents = {},
    capacity: GridSize | null = RAID_BAG_GRID,
    arrangement: GridArrangement = EMPTY_ARRANGEMENT,
  ) {
    this.capacity = capacity;
    this.arrangementValue = arrangement;
    this.arrangedByHand = arrangement.items.length > 0 || arrangement.cargo.length > 0;
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
    this.holdLayout();
  }

  /** The seats the player chose, for a save or for the next screen to draw. */
  public get arrangement(): GridArrangement {
    return this.arrangementValue;
  }

  /**
   * Lays the pack out as the player asked.
   *
   * The arrangement handed in is taken as the whole answer and then frozen from
   * what actually packed, so a seat that has stopped working is dropped here
   * rather than lingering to surprise the next change.
   */
  public arrange(arrangement: GridArrangement): void {
    this.arrangementValue = arrangement;
    this.arrangedByHand = true;
    this.arrangementValue = arrangementOf(this.layout());
  }

  /**
   * Gives the pack no opinion of its own again: every piece packs automatically.
   *
   * It is what "the pack re-packed itself" means when the thing being made room
   * for is not a supply - a Pokemon coming aboard is not in the contents the
   * packer could seat around, so the honest answer is to let the packer have
   * the whole container back.
   */
  public unarrange(): void {
    this.arrangementValue = EMPTY_ARRANGEMENT;
    this.arrangedByHand = false;
  }

  /**
   * Packs everything again from scratch, rotation allowed: the TIDY control.
   *
   * It is a deed the player asks for, never something that happens to them -
   * an auto-tidy that undoes somebody's arranging is worse than no arranging.
   */
  public tidy(): void {
    if (this.capacity === null) {
      return;
    }
    this.arrangementValue = tidyArrangement(this.contents, this.capacity, this.cargoValue);
    this.arrangedByHand = true;
  }

  /**
   * Whether a tidy would seat what the pack as it stands will not.
   *
   * It is what turns "no room" into "no room the way you have packed it", which
   * is the difference between a refusal a player can act on and a wall.
   */
  public tidyWouldFit(itemId: string, quantity = 1): boolean {
    return (
      this.capacity !== null &&
      tidyWouldFit(
        { ...this.contents, [itemId]: this.count(itemId) + quantity },
        this.capacity,
        this.cargoValue,
        this.arrangementValue,
      )
    );
  }

  /** Whether a tidy would seat a whole set of additions the pack as packed will not. */
  public tidyWouldFitAll(
    additions: readonly { readonly itemId: string; readonly quantity: number }[],
  ): boolean {
    if (this.capacity === null) {
      return false;
    }
    const trial: Record<string, number> = { ...this.contents };
    for (const { itemId, quantity } of additions) {
      trial[itemId] = (trial[itemId] ?? 0) + quantity;
    }
    return tidyWouldFit(trial, this.capacity, this.cargoValue, this.arrangementValue);
  }

  /** Whether a tidy would seat one more piece of cargo the pack will not. */
  public tidyWouldFitCargo(piece: GridCargo): boolean {
    return (
      this.capacity !== null &&
      tidyWouldFit(this.contents, this.capacity, [...this.cargoValue, piece], this.arrangementValue)
    );
  }

  /**
   * Writes the layout down again after the contents changed.
   *
   * Only once the player has arranged something: before that the pack has no
   * opinion of its own and the automatic pack answers every time, which is the
   * behaviour every save that has never opened the grid keeps.
   */
  private holdLayout(): void {
    if (this.arrangedByHand && this.capacity !== null) {
      this.arrangementValue = arrangementOf(this.layout());
    }
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
      fitsInGrid(this.contents, this.capacity, [...this.cargoValue, piece], this.arrangementValue)
    );
  }

  /**
   * Takes something found in the field, re-seating the pack around it if that
   * is the only way it goes in.
   *
   * `add` never moves what the player arranged, which is the right answer on a
   * screen where they can move it themselves. A find is not on a screen: it is
   * on the ground in front of them, and "no room, the way you have packed it"
   * is a refusal they cannot act on without walking away from the thing. So a
   * find that has no seat but whose squares the container has is taken, and the
   * pack says it re-seated itself - `reseated` is what the message is for.
   *
   * @returns What happened, so the caller can say it.
   */
  public takeFind(itemId: string, quantity = 1): 'seated' | 'reseated' | 'refused' {
    if (this.add(itemId, quantity)) {
      return 'seated';
    }
    if (!isPositiveInteger(quantity) || this.capacity === null || !this.tidyWouldFit(itemId, quantity)) {
      return 'refused';
    }
    this.contents[itemId] = this.count(itemId) + quantity;
    this.arrangementValue = tidyArrangement(this.contents, this.capacity, this.cargoValue);
    this.arrangedByHand = true;
    return 'reseated';
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
    this.holdLayout();
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
    this.holdLayout();
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
        this.arrangementValue,
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
    return fitsInGrid(trial, this.capacity, this.cargoValue, this.arrangementValue);
  }

  /** How many more of an id would go in, up to `limit`. */
  public room(itemId: string, limit = 99): number {
    return this.capacity === null
      ? limit
      : roomFor(this.contents, this.capacity, itemId, limit, this.cargoValue, this.arrangementValue);
  }

  /** Where everything sits, recomputed from the contents every time it is asked. */
  public layout(): GridPacking {
    return packContents(
      this.contents,
      this.capacity ?? VAULT_GRID,
      this.cargoValue,
      this.arrangementValue,
    );
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
