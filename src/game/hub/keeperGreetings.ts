import type { BaseScreen } from '../base/doors';

/**
 * What every keeper says when spoken to: one box, the same on every visit and in
 * every save, and then what they keep opens - the way a FireRed clerk says hello
 * and the shop is there, and a nurse welcomes you and asks.
 *
 * The harbour audit of 27 Nov 2026 counted four to six boxes in front of
 * Nurse Joy, Bill and Brock on a first visit home, three in front of THE
 * MARSHAL and then a question nobody came for, and four from the GAME CORNER's
 * attendant with nothing to do after them. Every one of those boxes explained
 * a rule. The owner's word (PR #980): "We don't want these AI reminder things
 * everywhere that explain how to do things." So a keeper greets you, in their
 * own voice, and everything they used to explain is shown where it is true: the
 * price of a heal in the question that spends it, only what Bill sells you today
 * on his shelf, a build Brock cannot start greyed on his screen.
 *
 * Nothing here reads the save, and that is the rule: a greeting that changed
 * with the save would be a situation line again. A favour a keeper has to ask,
 * thank or grieve over waits until their screen or question is done with
 * (`BaseScene.sayFavourIfAny`), so it never stands in front of it. Every
 * greeting fits one box (`keeperGreetings.test.ts`).
 */
export const KEEPER_GREETINGS: Readonly<Record<BaseScreen, string>> = {
  lab: 'Ah, there you are! How is your Pokédex coming along?',
  stash: "Welcome to the Pokémon Center! Let's get your Pokémon fit to raid again.",
  workshop: "Brock's the name. I build things into this base, and they stay built.",
  trader: "Hiya! I'm BILL. Everything on these shelves came off my boat.",
  boutique: 'Welcome to THE HARBOUR BOUTIQUE! Have a good look round.',
  'game-corner': 'Welcome to the GAME CORNER! The cabinets in here pay out in TICKETS.',
  prizes: 'Welcome to the PRIZE WINDOW! We swap TICKETS for prizes here.',
  'battle-arena': 'Welcome to the BATTLE ARENA! Bouts here are for the fun of it.',
  arena: 'Welcome to the RAID ARENA! The vale is down the pit, through the doors.',
};

/** What a keeper says when spoken to. */
export function keeperGreeting(screen: BaseScreen): string {
  return KEEPER_GREETINGS[screen];
}

/**
 * Oak's question after his greeting, as FireRed's Oak asks after the Pokédex
 * in his lab: YES is him looking it over, and paying a milestone if one is due
 * (`hub/pokedex.ts`).
 */
export const OAK_POKEDEX_QUESTION = 'Shall I take a look at it?';

/**
 * What THE RAID ARENA's sign-up board asks, faced: raiding with a friend
 * (`raidRoom/friendRoom.ts`). It was the marshal's last question, glued on
 * after whatever she had said, and then Oak's before that (the harbour critic
 * tour, 26 Nov 2026); it is the board's now, so nobody is asked it who did
 * not walk up to it.
 */
export const FRIEND_BOARD_QUESTION = 'Going to raid with a friend?';

/** What the board asks while this browser holds a room: the code is pinned up on it. */
export function heldRoomQuestion(code: string): string {
  return `Your room ${code} is pinned up. Go and see to it?`;
}
