import { BOUTIQUE_NAME } from '../look/wearables';

/**
 * Today's notice on THE HARBOUR's board (`baseMap.ts`'s `NOTICE_BOARD`): one
 * line pinned under the board's own words, a different one each day by the
 * player's clock, so the board is worth a look every time a raid comes home.
 *
 * Every notice is something true about the game that nobody else in the
 * harbour says out loud - the things a player finds out by accident, or never
 * does. Nothing is stored: the day picks the notice.
 */
export const HARBOUR_NOTICES: readonly string[] = [
  'The ANGLER at THE COVE lends his rod. The good ones bite off the end of the long pier.',
  'The S.S. ANNE\'s captain lends his spyglass on the long pier. Go after dark.',
  'Raid after nine at night and the wild Pokémon are not the ones you met by day.',
  'The DAY-CARE MAN raises one Pokémon while you raid: a level every two raids, and no fee.',
  'NURSE JOY heals in full, and charges in time: what she spends comes off your next raid\'s clock.',
  'Lose a raid and you lose what you took into it - unless it rode home in the secure container.',
  'BILL trades rods, HMs and evolution stones for what you bring home. Never for money.',
  'The telly in THE BOLTHOLE says which rival is hunting tonight.',
  'Read the town map at HARBOUR SQUARE for where everything is.',
  'PROFESSOR OAK has something for every Pokédex milestone. The first is at 10 kinds.',
  'Hold L to read the name of everything in view.',
  'Two brass telescopes stand on the rail in THE RAID ARENA: all of GREYSTONE VALE, in one look.',
  'Somebody else walking the harbour? Face them and press SPACE to wave.',
  'Everything BROCK builds stands in the harbour: the mast, the lockers, the light at the breakwater\'s head.',
  `${BOUTIQUE_NAME} at the top of THE GREEN dresses you. Trying a look on in its mirror is free.`,
  'Legendary and shiny colours are never on a shop\'s shelves. They turn up on raids in GREYSTONE VALE.',
  'Change what you wear at home: YOUR WARDROBE is the drawers upstairs in THE BOLTHOLE.',
];

/** The notice pinned up on `now`'s day, by the player's own clock. */
export function noticeFor(now: Date): string {
  const day = Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / (24 * 60 * 60 * 1000),
  );
  return HARBOUR_NOTICES[((day % HARBOUR_NOTICES.length) + HARBOUR_NOTICES.length) % HARBOUR_NOTICES.length];
}
