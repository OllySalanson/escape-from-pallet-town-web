/**
 * F is the FEEDBACK key everywhere but where a screen has a use of its own for
 * it. THE BOLTHOLE is one: F is its FURNITURE key (the captain, 7 Nov 2026), so
 * while the player stands in a house - their own, or one they are visiting,
 * where F says why nothing there is theirs to move - the house holds the
 * letter and the FEEDBACK tab is still a click away. A module of its own, so
 * `BaseScene` can hold the key without importing the desk and the lab behind it.
 */
let heldByTheHouse = false;

/** Called by `BaseScene` as it builds a place: true in a house, false anywhere else and on shutdown. */
export function holdFeedbackKeyInTheHouse(held: boolean): void {
  heldByTheHouse = held;
}

/**
 * Whether the house has F right now: only while the scene that holds it is
 * running, so a panel opened over the paused house (the FEEDBACK panel's own
 * pause included) gives the letter back.
 */
export function houseHoldsFeedbackKey(scenes: { isActive(key: string): boolean }): boolean {
  return heldByTheHouse && scenes.isActive('base');
}
