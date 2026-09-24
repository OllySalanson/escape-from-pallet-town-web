import type { CastCharacterDesignId } from './characterDesigns';

/**
 * Who is hunting you this raid.
 *
 * The captain, 2026-09-23: "we should have Blue to start with and then there
 * should be someone else and then someone else ... let's just make 5 hunters
 * to begin with ... all the same apart from their names and their
 * personalities and their art and their lines when they speak to you. But keep
 * all mechanics of how they fight the same for now." And, the same day, that
 * all five must be Pokemon characters people remember - the rule the base's
 * four people were chosen by, a person everyone knows over a clever fit.
 *
 * So a hunter is a name, a figure and five lines, and nothing here can change
 * a fight: the team, its levels, its arrival and its pursuit are the one
 * ladder in `hunter.ts`, and every rival fights on it. The one field that
 * *would* is `temperament`, and it is the marked hook for the harder hunter
 * the captain means to add later ("keep everyone else easy"): today every
 * rival is `ordinary`, and a `hard` one is a new value here plus the ladder it
 * fights on, not a new system.
 *
 * Blue leads because the captain named him. The other four are the Kanto gym
 * leaders the most people remember and whose FireRed/LeafGreen lines already
 * read as somebody who hunts you - the rival, a temper, a soldier, a ninja and
 * a psychic. Giovanni is kept back on purpose: the boss of Team Rocket is the
 * obvious face for the harder hunter, and spending him on an easy one would
 * leave nobody to be it.
 */
export type HunterTemperament = 'ordinary';

export interface HunterRival {
  readonly id: HunterRivalId;
  /** As the dialogue prints it, in the games' own capitals. */
  readonly name: string;
  /** Their figure on the map - `characterDesigns.ts`, cut from FireRed/LeafGreen. */
  readonly design: CastCharacterDesignId;
  /** Who they are, for whoever writes their next line. Never printed. */
  readonly personality: string;
  /** The harder-hunter hook: see the header. Every shipped rival is `ordinary`. */
  readonly temperament: HunterTemperament;
  /** What they shout when they pick up the trail - the one box the arrival raises. */
  readonly arrival: string;
  /** Said as they catch you, before the fight: always two lines, like the beat it replaced. */
  readonly caught: readonly [string, string];
  /** Shouted after you as you break away from them. */
  readonly getaway: string;
  /** What they say when their last Pokemon faints. */
  readonly defeat: string;
}

export type HunterRivalId = 'blue' | 'misty' | 'lt-surge' | 'koga' | 'sabrina';

/**
 * The five, in the order they come round. Lines stay short enough for one
 * dialogue box each, because the arrival is billed to the raid clock like any
 * other dialogue, and each borrows the person's own voice from the game where
 * it can ("Smell ya later!", "Hey, kid!", "Fwahahaha!", "I had a vision").
 */
export const HUNTER_RIVALS: readonly HunterRival[] = [
  {
    id: 'blue',
    name: 'BLUE',
    design: 'blue',
    personality: 'Your rival. Cocky, always one step ahead in his own head, never lets you forget it.',
    temperament: 'ordinary',
    arrival: 'BLUE is on your trail! "Whatever you found, loser, it\'s mine!"',
    caught: ['BLUE: "There you are! Did you really think you could hide?"', 'BLUE: "Hand it over. Smell ya later!"'],
    getaway: 'BLUE: "Run, then! I\'ll catch you before the clock does!"',
    defeat: 'What?! I was just warming up... Smell ya later!',
  },
  {
    id: 'misty',
    name: 'MISTY',
    design: 'misty',
    personality: 'The tomboyish mermaid of Cerulean. Quick temper, all-out offence, hates being ignored.',
    temperament: 'ordinary',
    arrival: 'MISTY is on your trail! "Don\'t you dare walk off with that!"',
    caught: ['MISTY: "Got you! Nobody sneaks past me."', 'MISTY: "My policy is an all-out offensive!"'],
    getaway: 'MISTY: "Ugh! Get back here, you little shrimp!"',
    defeat: 'Wow, you\'re too much! ...Fine. Go on, get out of here.',
  },
  {
    id: 'lt-surge',
    name: 'LT. SURGE',
    design: 'lt-surge',
    personality: 'The Lightning American. Loud, a soldier first, calls everyone kid, respects a fighter.',
    temperament: 'ordinary',
    arrival: 'LT. SURGE is on your trail! "Hey, kid! Nowhere to hide in a war zone!"',
    caught: ['LT. SURGE: "Hey, kid! Caught you red-handed!"', 'LT. SURGE: "You won\'t live long in combat!"'],
    getaway: 'LT. SURGE: "Tactical retreat, huh? Smart move, soldier!"',
    defeat: 'Whoa! You\'re the real deal, kid! Dismissed!',
  },
  {
    id: 'koga',
    name: 'KOGA',
    design: 'koga',
    personality: 'A ninja master of poison. Patient, theatrical, laughs before he strikes.',
    temperament: 'ordinary',
    arrival: 'KOGA is on your trail! "Fwahahaha! A ninja leaves no footprints."',
    caught: ['KOGA: "Fwahahaha! Did you not feel my eyes on you?"', 'KOGA: "Despair to the creeping horror of poison!"'],
    getaway: 'KOGA: "Hmph. You slip away like smoke... for now."',
    defeat: 'Humph! You have proven your worth. Go, before I change my mind.',
  },
  {
    id: 'sabrina',
    name: 'SABRINA',
    design: 'sabrina',
    personality: 'The psychic of Saffron. Calm, eerie, already knows where you are going.',
    temperament: 'ordinary',
    arrival: 'SABRINA is on your trail! "I had a vision of your arrival."',
    caught: ['SABRINA: "I knew you would come this way."', 'SABRINA: "I foresaw this. I foresaw how it ends."'],
    getaway: 'SABRINA: "I did not foresee that. How interesting."',
    defeat: 'This loss shocks me... Yet somehow I saw it coming.',
  },
];

/** A fresh save, and anything that does not know better, meets Blue. */
export const FIRST_HUNTER_RIVAL: HunterRivalId = 'blue';

export const hunterRival = (id: HunterRivalId): HunterRival =>
  HUNTER_RIVALS.find((rival) => rival.id === id) ?? HUNTER_RIVALS[0];

/**
 * Who hunts the next raid: one each, in turn, counted in raids deployed.
 *
 * Per raid rather than per encounter, because the rival is somebody you are
 * told about before you go (the final check names them) and meet once inside;
 * a face that changed mid-raid would be a different hunter, not the same one
 * catching up. Derived from the raid count the save already keeps
 * (`raidProgress.raidRecord`), so nothing new is stored and a reload cannot
 * skip anybody: the first raid is Blue, the sixth is Blue again.
 */
export const rivalForRaid = (raidsDeployed: number): HunterRivalId =>
  HUNTER_RIVALS[
    ((Math.floor(raidsDeployed) % HUNTER_RIVALS.length) + HUNTER_RIVALS.length) % HUNTER_RIVALS.length
  ].id;
