import type { CharacterDesignId } from './characterDesigns';

/**
 * What a beaten trainer pays: FireRed's prize money, into the pack.
 *
 * "PLAYER got ¥80 for winning!" is the line every one of these games has said
 * after every trainer fight, and this game said nothing: a trainer paid
 * experience and "You win. On you go, then.", so the only money in the game
 * was a few bundles on the ground and a whole raid's cash did not buy one
 * Potion (the overnight critic's problems 11 and 16, 25 Nov 2026). Now a win
 * pays, by FireRed's own rule - `Cmd_getmoneyreward` in pret/pokefirered:
 * four times the level of the trainer's last Pokémon times their class's
 * value in `gTrainerMoneyTable` - so a Lv 6 bug catcher pays ₽72 and a leader
 * whose last Pokémon is Lv 15 pays ₽1,500.
 *
 * It is money, so it is loot: it goes into the raid's pack and is lost with
 * the pack on a wipe like every other Pokédollar (`hub/trader.ts`'s first
 * constraint). A pack with no room for all of it takes what it can and the rest
 * is put down where the fight began, as anything dropped out of the pack is
 * (`loot.ts`, `layDroppedPiece`), and the fight says so: a boss is fought once
 * a save, so a prize that simply vanished for want of a square would be gone
 * for good.
 *
 * Every trainer pays it, the roadside ones a walk straight out passes
 * included: a fight is a risk the walk is not, and a first bug catcher paying
 * "₽9 for winning!" read as the game mocking the player (tried, 25 Nov 2026).
 * Three rules keep it from being a vending machine:
 * - a trainer pays **once a save**, as FireRed's do (`raidProgress.trainersPaid`,
 *   written the moment the prize is paid). A roadside trainer stands back up
 *   every raid, and fights cost no raid clock, so paying every time made six
 *   trainers by STEPPING STONES a ₽960 round in forty seconds, raid after raid,
 *   and Bill's unrationed Potions a supply line (the fresh critic, 25 Nov 2026).
 *   Paid once, the vale's trainers are a purse spread over the map: new money
 *   is a trainer you have not beaten yet, further out;
 * - a **hunter** pays only the first time a raid beats one: there is one in
 *   every district and they are beaten every raid (hunters are new each raid,
 *   so this one is per raid, as the trainer bags' is, `trainerBags.ts`);
 * - a fight for sport - a bout, a practice, a gym leader sparring in the hall
 *   - pays nothing, and is never handed a prize. A boss pays once a save
 *   because a boss is fought once a save.
 */

/** FireRed's class values (`gTrainerMoneyTable`), by the look that says who a trainer is here. */
export const PRIZE_VALUE_FOR_DESIGN: Readonly<Partial<Record<CharacterDesignId, number>>> = {
  youngster: 4,
  boy: 4,
  'little-boy': 4,
  'bug-catcher': 3,
  lass: 4,
  'little-girl': 4,
  picnicker: 5,
  camper: 5,
  'straw-hat': 5,
  hiker: 9,
  'heavy-man': 9,
  'bald-man': 6,
  fisherman: 9,
  sailor: 8,
  captain: 8,
  swimmer: 1,
  'swimmer-woman': 1,
  'tuber-boy': 1,
  'tuber-girl': 1,
  beauty: 18,
  woman: 7,
  'old-woman': 7,
  'old-man': 18,
  gentleman: 18,
  'rich-boy': 50,
  'crush-girl': 6,
  'black-belt': 6,
  rocker: 6,
  'rocket-grunt': 8,
  'rocket-grunt-woman': 8,
  worker: 12,
  'worker-woman': 12,
  scientist: 12,
  'poke-maniac': 12,
  channeler: 8,
  cooltrainer: 9,
  'cooltrainer-woman': 9,
  clerk: 5,
  man: 5,
  misty: 25,
  koga: 25,
  brock: 25,
  'lt-surge': 25,
  sabrina: 25,
  lorelei: 25,
  bruno: 25,
  agatha: 25,
  lance: 25,
  blue: 4,
};

/** FireRed's last row, `{ 0xFF, 5 }`: what a class with no row of its own pays. */
export const PRIZE_VALUE_FALLBACK = 5;
/** A keeper or gym leader: FireRed's `TRAINER_CLASS_LEADER`. */
export const PRIZE_VALUE_BOSS = 25;
/** A hunter: FireRed's early rival, who is what a hunter is. */
export const PRIZE_VALUE_HUNTER = 4;

export interface PrizeOwner {
  /** Their party's levels, in the order they send them out. */
  readonly levels: readonly number[];
  readonly design?: CharacterDesignId;
  readonly boss?: boolean;
  readonly hunter?: boolean;
}

/** FireRed's prize for beating this trainer, in Pokédollars. Never negative, always whole. */
export function prizeMoneyFor(owner: PrizeOwner): number {
  const last = owner.levels[owner.levels.length - 1] ?? 0;
  const value = owner.hunter
    ? PRIZE_VALUE_HUNTER
    : owner.boss
      ? Math.max(PRIZE_VALUE_BOSS, (owner.design && PRIZE_VALUE_FOR_DESIGN[owner.design]) ?? 0)
      : ((owner.design && PRIZE_VALUE_FOR_DESIGN[owner.design]) ?? PRIZE_VALUE_FALLBACK);
  return 4 * Math.max(0, Math.floor(last)) * value;
}

/**
 * What beating this trainer pays now: their prize, or nothing if this save has
 * been paid by them before (`raidProgress.trainersPaid`). A hunter is new each
 * raid and is never on that list; the raid's own `hunterPrizePaid` rules it.
 */
export function prizeDue(trainerId: string, owner: PrizeOwner, trainersPaid: readonly string[] = []): number {
  return !owner.hunter && trainersPaid.includes(trainerId) ? 0 : prizeMoneyFor(owner);
}

/** FireRed's line, with this game's money. */
export function prizeLine(amount: string): string {
  return `You got ${amount} for winning!`;
}

/**
 * Said when the pack could not take all of it: what it took, and that the rest
 * lies on the ground where the fight began, to be picked up once there is room.
 */
export function prizeLeftLine(taken: string, left: string): string {
  return taken === ''
    ? `Your pack has no room for ${left}. It's on the ground - make room and pick it up.`
    : `Your pack had room for ${taken}. The other ${left} is on the ground.`;
}
