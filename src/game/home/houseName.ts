/**
 * THE BOLTHOLE and the player's name.
 *
 * A name is one each in all of Pallet Town (`names/`), asked as the first raid
 * comes home. The house is where a name belongs - it goes on the door - so it
 * is also the fallback: anybody who walks in without one (put off then, or no
 * answer from the harbour) is asked here, and does not walk
 * about inside until they have answered or gone back out (`BaseScene.askHouseName`).
 * It is the console's name and the console's rule (`console/playerName.ts`):
 * one per device, kept under its own key, so the console never asks anybody
 * who has a name.
 */

/** Whether walking into the house has to stop and ask: nobody has named this device yet. */
export function houseNameNeeded(name: string | null): boolean {
  return name === null;
}

/** What the house says once it has a name. */
export function welcomeHomeLines(name: string): readonly string[] {
  return [
    `Welcome home, ${name}!`,
    'Everybody in the harbour sees you by that name now, and the console puts your scores up under it.',
  ];
}
