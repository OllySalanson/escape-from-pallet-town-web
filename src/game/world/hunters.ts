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
 * So a hunter is a name, a figure, six lines and one Pokemon of their own.
 * The levels, the arrival and the pursuit are the one ladder in `hunter.ts`,
 * and every rival fights on it. What a rival changes about a fight is only
 * its `signature`: the captain, 2026-10-11, answering playtest 33 - "each
 * rival leads with a signature Pokemon instead of the shared Rattata", because
 * five rivals who all sent out the same Rattata were one hunter with five
 * names. The signature leads; the shared escorts in `HUNTER_ROSTER` follow it.
 *
 * A signature has to be two things, and the second is measured
 * (`tools/hunter/measure.mts`): somebody's own Pokemon, and no starter's
 * lottery. The lead meets a lone starter alone, so a lead whose type answers
 * one starter's own type is the fight `hunter.ts` keeps the Normal lead for -
 * and the first picks were exactly that. Blue's Pidgey resists Vine Whip and
 * hits with a same-type Tackle, and a Lv 10 Bulbasaur beat it 0% of the time a
 * level under; Misty's Staryu learns Water Gun at 9 and a Lv 10 Charmander won
 * 13%; Sabrina's Mr. Mime has Confusion at 5 and took every lone starter to
 * nil at its level; her Kadabra line knows no move this game can play until
 * 16 (Teleport is not one) and then beats a Lv 18 Charmeleon half the time a
 * rung under; her Venonat resists Vine Whip twice over. So the five are:
 *
 * - **Blue's Eevee**, the partner he takes off Oak's table in Yellow. Normal,
 *   so it answers nobody; it never evolves here, because no FireRed trainer
 *   fields any of its evolutions and which stone it would be is a choice
 *   nobody made.
 * - **Misty's Psyduck**, the one that follows her everywhere. It throws
 *   Scratch, and learns no Water move before 50; Golduck from 33.
 * - **Lt. Surge's Voltorb**, from his own FireRed team, Electrode from 30. It
 *   learns no Electric attack before Spark at 21.
 * - **Koga's Grimer**, whose line is his FireRed Muk, Muk from 38.
 * - **Sabrina's Venonat**, whose line is her FireRed Venomoth, Venomoth from
 *   31.
 *
 * Surge led with his Pikachu, Koga with his Koffing and Sabrina with a Drowzee
 * until every species took FireRed's own learnset (the captain, 2026-10-11),
 * and then all three failed the floor below on the last ordinary rung: a
 * FireRed Pikachu knows Thunder Shock from level 1 and a lone Lv 5 Squirtle
 * beat it 9% of the time; the Koffing took a Lv 10 Squirtle to 53% and the
 * Drowzee's Confusion at 11 a Lv 13 Bulbasaur to 56%, because a FireRed
 * Squirtle has nothing of its own but Bubble before 13 and a Bulbasaur nothing
 * typed before Vine Whip at 10. Each now leads with the first stage of
 * another Pokemon from that leader's own FireRed team, and all three clear the
 * floor against every lone starter (firstmate's decision, the same day). The
 * Venonat refused above was refused against the old kits, when a Bulbasaur's
 * Vine Whip was its whole answer; with Leech Seed it is one answer of two.
 *
 * Each rival's ladder is measured on its own, and `hunter.test.ts` holds every
 * one to the floor a lone starter must clear on the last ordinary rung.
 *
 * The other field that would change a fight is `temperament`, the marked hook
 * for the harder hunter the captain means to add later ("keep everyone else
 * easy"): today every rival is `ordinary`, and a `hard` one is a new value
 * here plus the ladder it fights on, not a new system.
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
  /**
   * The species id of the first stage of the Pokemon they lead with. It
   * evolves with the level it is fielded at, like the rest of the team
   * (`hunterSpeciesAt` in `hunter.ts`).
   */
  readonly signature: string;
  /** What they shout when they pick up the trail - the one box the arrival raises. */
  readonly arrival: string;
  /** Said as they catch you, before the fight: always two lines, like the beat it replaced. */
  readonly caught: readonly [string, string];
  /** Shouted after you as you break away from them. */
  readonly getaway: string;
  /** What they say when their last Pokemon faints. */
  readonly defeat: string;
  /**
   * What they shout when they come back for the enrage. A beaten hunter is
   * gone for the raid except for this one return, when the clock runs out
   * (`hunterAtEnrage` in `hunter.ts`).
   */
  readonly comeback: string;
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
    signature: 'eevee',
    arrival: 'BLUE is on your trail! "Whatever you found, loser, it\'s mine!"',
    caught: ['BLUE: "There you are! Did you really think you could hide?"', 'BLUE: "Hand it over. Smell ya later!"'],
    getaway: 'BLUE: "Run, then! I\'ll catch you before the clock does!"',
    defeat: 'What?! I was just warming up... Smell ya later!',
    comeback: 'BLUE is back! "Time\'s up, loser! Round two!"',
  },
  {
    id: 'misty',
    name: 'MISTY',
    design: 'misty',
    personality: 'The tomboyish mermaid of Cerulean. Quick temper, all-out offence, hates being ignored.',
    temperament: 'ordinary',
    signature: 'psyduck',
    arrival: 'MISTY is on your trail! "Don\'t you dare walk off with that!"',
    caught: ['MISTY: "Got you! Nobody sneaks past me."', 'MISTY: "My policy is an all-out offensive!"'],
    getaway: 'MISTY: "Ugh! Get back here, you little shrimp!"',
    defeat: 'Wow, you\'re too much! ...Fine. Go on, get out of here.',
    comeback: 'MISTY is back! "Out of time! Now you\'re all mine!"',
  },
  {
    id: 'lt-surge',
    name: 'LT. SURGE',
    design: 'lt-surge',
    personality: 'The Lightning American. Loud, a soldier first, calls everyone kid, respects a fighter.',
    temperament: 'ordinary',
    signature: 'voltorb',
    arrival: 'LT. SURGE is on your trail! "Hey, kid! Nowhere to hide in a war zone!"',
    caught: ['LT. SURGE: "Hey, kid! Caught you red-handed!"', 'LT. SURGE: "You won\'t live long in combat!"'],
    getaway: 'LT. SURGE: "Tactical retreat, huh? Smart move, soldier!"',
    defeat: 'Whoa! You\'re the real deal, kid! Dismissed!',
    comeback: 'LT. SURGE is back! "Clock\'s out, kid! Second wave!"',
  },
  {
    id: 'koga',
    name: 'KOGA',
    design: 'koga',
    personality: 'A ninja master of poison. Patient, theatrical, laughs before he strikes.',
    temperament: 'ordinary',
    signature: 'grimer',
    arrival: 'KOGA is on your trail! "Fwahahaha! A ninja leaves no footprints."',
    caught: ['KOGA: "Fwahahaha! Did you not feel my eyes on you?"', 'KOGA: "Despair to the creeping horror of poison!"'],
    getaway: 'KOGA: "Hmph. You slip away like smoke... for now."',
    defeat: 'Humph! You have proven your worth. Go, before I change my mind.',
    comeback: 'KOGA is back! "Fwahahaha! The hour has come at last."',
  },
  {
    id: 'sabrina',
    name: 'SABRINA',
    design: 'sabrina',
    personality: 'The psychic of Saffron. Calm, eerie, already knows where you are going.',
    temperament: 'ordinary',
    signature: 'venonat',
    arrival: 'SABRINA is on your trail! "I had a vision of your arrival."',
    caught: ['SABRINA: "I knew you would come this way."', 'SABRINA: "I foresaw this. I foresaw how it ends."'],
    getaway: 'SABRINA: "I did not foresee that. How interesting."',
    defeat: 'This loss shocks me... Yet somehow I saw it coming.',
    comeback: 'SABRINA is back! "Your time has run out. I saw it."',
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
