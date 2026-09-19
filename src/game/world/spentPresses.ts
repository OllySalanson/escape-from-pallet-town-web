/**
 * Key presses that have already been answered, and so must not be read twice.
 *
 * A dialogue the world raises unasked - the hunter's arrival, a trainer's line
 * of sight - advances on a direction key as well as the interact keys, because
 * trying to walk away is what a player does when a box lands in front of them
 * and a key that does nothing reads as a freeze. That rule stands. What it got
 * wrong was what happened next: the box closed on the key's *press*, the key
 * was still *down* on the following frame, and movement reads held keys - so
 * the one press that said "OK" also walked a tile, in whatever direction the
 * player happened to have answered with. Into the hunter, in the playtest.
 *
 * A press is one intention. Once it has dismissed a dialogue it is spent, and a
 * spent key reads as up until it has actually been released; walking that way
 * is a second press, made with the map back on screen. Costing a deliberate
 * walker one extra tap is the cheap side of that trade: the other side is a
 * step the player never chose, taken at the moment the world is most dangerous.
 *
 * Phaser-free and generic over the key object so the rule is tested directly.
 */
export class SpentPresses<Key extends { readonly isDown: boolean }> {
  private readonly spent = new Set<Key>();

  /** Marks every key in `keys` that is down right now as already answered. */
  public spendHeld(keys: readonly Key[]): void {
    for (const key of keys) {
      if (key.isDown) {
        this.spent.add(key);
      }
    }
  }

  /** Whether `key` is down on a press that has not been answered yet. */
  public isFreshlyDown(key: Key): boolean {
    if (!key.isDown) {
      this.spent.delete(key);
      return false;
    }
    return !this.spent.has(key);
  }

  public clear(): void {
    this.spent.clear();
  }
}
