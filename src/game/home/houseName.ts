/**
 * THE BOLTHOLE and the player's name.
 *
 * A name is one each in all of Pallet Town (`names/`), asked as the first raid
 * comes home and at CONTINUE by anybody who still has none, and kept on the
 * device (`console/playerName.ts`). The house never asks for it: it is the
 * player's from the moment the game starts, and carries their name on its door
 * as soon as there is one to carry (the captain, 21 Nov 2026: "you shouldn't
 * have to walk in your house first to give it a name. It should just have your
 * name"). Until then it is THE BOLTHOLE, which is what the harbour's board,
 * its notices and THE GREAT LIBRARY call it.
 */

/** What the house is called before anybody has a name, and what everything else in the harbour calls it. */
export const HOUSE_NAME = 'THE BOLTHOLE';

/** The name over the house's door: the player's own, once they have one. */
export function houseTitle(ownerName: string | null): string {
  return ownerName ? `${ownerName}’S BOLTHOLE` : HOUSE_NAME;
}
