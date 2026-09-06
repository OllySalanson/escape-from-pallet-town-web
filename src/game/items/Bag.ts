import { ITEM_DEFINITIONS, type ItemCategory, type ItemDefinition } from './items';

export type BagContents = Readonly<Record<string, number>>;

/**
 * A run's item inventory. Contents are stored as a simple id-to-quantity record
 * so they can be persisted without custom serialization.
 */
export class Bag {
  private readonly contents: Record<string, number>;

  public constructor(initialContents: BagContents = {}) {
    this.contents = {};
    for (const [itemId, quantity] of Object.entries(initialContents)) {
      if (Number.isInteger(quantity) && quantity > 0) {
        this.contents[itemId] = quantity;
      }
    }
  }

  public add(itemId: string, quantity = 1): boolean {
    if (!isPositiveInteger(quantity)) {
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
