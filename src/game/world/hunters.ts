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
 * So a hunter is a name, a figure, four lines and one Pokemon of their own.
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
 * floor against every lone starter (decided the same day). The
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
  /**
   * Said as they catch you, before the fight: always two lines, like the beat
   * it replaced, and the first of them is about your loot. Nothing else a rival
   * says is said out loud until then - the arrival is a red glow at the screen's
   * edge and the chip naming them (`hunterWarning.ts`), never a box that stops
   * the player - so the catch is where they get to gloat (the captain,
   * 2026-10-29: "whatever you found, loser, it's mine").
   */
  readonly caught: readonly [string, string];
  /** Shouted after you as you break away from them. */
  readonly getaway: string;
  /** What they say when their last Pokemon faints. */
  readonly defeat: string;
  /** What they say on the far floor of the Raid Arena, where they wait for a bout for show (`base/arenaBouts.ts`). */
  readonly hall: {
    /** Before there has been a raid to talk about. */
    readonly first: string;
    /** About a raid that was lost. */
    readonly afterLoss: string;
    /** About a raid that got out. */
    readonly afterOut: string;
    /** What they ask, in their own words, before the box asks YES or NOT NOW. */
    readonly offer: string;
    /** To a NOT NOW. */
    readonly later: string;
    /** Their last Pokemon fainting, in a bout. */
    readonly beaten: string;
    /** Back on the floor, having won. */
    readonly gloat: string;
    /** Back on the floor, having lost. */
    readonly sulk: string;
  };
}

export type HunterRivalId = 'blue' | 'misty' | 'lt-surge' | 'koga' | 'sabrina';

/**
 * The five, in the order they come round. Lines stay short enough for one
 * dialogue box each, and each borrows the person's own voice from the game where
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
    caught: ['BLUE: "Whatever you found, loser, it\'s mine!"', 'BLUE: "Hand it over. Smell ya later!"'],
    getaway: 'BLUE: "Run, then! I\'ll catch you before the clock does!"',
    defeat: 'What?! I was just warming up... Smell ya later!',
    hall: {
      first: 'BLUE: "First raid coming up? You\'ll be seeing me, loser."',
      afterLoss: 'BLUE: "Heard you went down out there. Can\'t say I\'m surprised."',
      afterOut: 'BLUE: "So you got out. That\'s luck, and luck runs out."',
      offer: 'BLUE: "A bout, then? No stakes. Just you losing in front of people."',
      later: 'BLUE: "Scared? Smart. Smell ya later."',
      beaten: 'What?! I was only warming up, and they all saw it...',
      gloat: 'BLUE: "And that\'s with nothing riding on it. Smell ya later!"',
      sulk: 'BLUE: "That doesn\'t count. Wait till there\'s a clock on it."',
    },
  },
  {
    id: 'misty',
    name: 'MISTY',
    design: 'misty',
    personality: 'The tomboyish mermaid of Cerulean. Quick temper, all-out offence, hates being ignored.',
    temperament: 'ordinary',
    signature: 'psyduck',
    caught: ['MISTY: "Got you! Whatever\'s in that pack is mine now."', 'MISTY: "My policy is an all-out offensive!"'],
    getaway: 'MISTY: "Ugh! Get back here, you little shrimp!"',
    defeat: 'Wow, you\'re too much! ...Fine. Go on, get out of here.',
    hall: {
      first: 'MISTY: "So you\'re the new one. I\'ll be after you out there."',
      afterLoss: 'MISTY: "You lost the lot, I heard. Honestly, what a shrimp."',
      afterOut: 'MISTY: "You got out? Don\'t get cocky. I wasn\'t even trying."',
      offer: 'MISTY: "Fight me, right here! All-out offensive, no stakes!"',
      later: 'MISTY: "Ugh! Fine. Ignore me, see if I care."',
      beaten: 'Wow, you\'re too much! ...In front of everybody, too.',
      gloat: 'MISTY: "Ha! That\'s my policy for you. Next!"',
      sulk: 'MISTY: "Ugh! You just got lucky. Do NOT tell anyone."',
    },
  },
  {
    id: 'lt-surge',
    name: 'LT. SURGE',
    design: 'lt-surge',
    personality: 'The Lightning American. Loud, a soldier first, calls everyone kid, respects a fighter.',
    temperament: 'ordinary',
    signature: 'voltorb',
    caught: ['LT. SURGE: "Caught you red-handed, kid! That loot\'s mine!"', 'LT. SURGE: "You won\'t live long in combat!"'],
    getaway: 'LT. SURGE: "Tactical retreat, huh? Smart move, soldier!"',
    defeat: 'Whoa! You\'re the real deal, kid! Dismissed!',
    hall: {
      first: 'LT. SURGE: "New recruit, huh? I\'ll be out there, kid."',
      afterLoss: 'LT. SURGE: "Lost your whole squad, kid? That\'s combat."',
      afterOut: 'LT. SURGE: "Made it out alive, huh? Not bad, soldier."',
      offer: 'LT. SURGE: "Hey, kid! Live-fire drill, no casualties. You in?"',
      later: 'LT. SURGE: "Fall back, then! Dismissed!"',
      beaten: 'Whoa! You\'re the real deal, kid! Good drill!',
      gloat: 'LT. SURGE: "You won\'t live long in combat, kid! Drill again!"',
      sulk: 'LT. SURGE: "Ha! You\'ve got guts, soldier. Don\'t let it show."',
    },
  },
  {
    id: 'koga',
    name: 'KOGA',
    design: 'koga',
    personality: 'A ninja master of poison. Patient, theatrical, laughs before he strikes.',
    temperament: 'ordinary',
    signature: 'grimer',
    caught: ['KOGA: "Fwahahaha! All you have gathered, I shall take."', 'KOGA: "Despair to the creeping horror of poison!"'],
    getaway: 'KOGA: "Hmph. You slip away like smoke... for now."',
    defeat: 'Humph! You have proven your worth. Go, before I change my mind.',
    hall: {
      first: 'KOGA: "Fwahahaha! A new face. I shall remember it."',
      afterLoss: 'KOGA: "Fwahahaha! It went badly for you. Poison is patient."',
      afterOut: 'KOGA: "You left by the way you meant to. This time."',
      offer: 'KOGA: "Shall we spar? Nothing is at stake but your pride."',
      later: 'KOGA: "Hmph. The wise ninja also knows when to wait."',
      beaten: 'Humph! You have proven your worth. The crowd saw it.',
      gloat: 'KOGA: "Fwahahaha! You have much to learn of poison."',
      sulk: 'KOGA: "Humph. In the field, I would not have stood so close."',
    },
  },
  {
    id: 'sabrina',
    name: 'SABRINA',
    design: 'sabrina',
    personality: 'The psychic of Saffron. Calm, eerie, already knows where you are going.',
    temperament: 'ordinary',
    signature: 'venonat',
    caught: ['SABRINA: "I saw what you found. It was always mine."', 'SABRINA: "I foresaw this. I foresaw how it ends."'],
    getaway: 'SABRINA: "I did not foresee that. How interesting."',
    defeat: 'This loss shocks me... Yet somehow I saw it coming.',
    hall: {
      first: 'SABRINA: "I knew you would come. I have seen your first raid."',
      afterLoss: 'SABRINA: "You fell. I saw it. You will walk back to that place."',
      afterOut: 'SABRINA: "You got out. I had seen that as well."',
      offer: 'SABRINA: "A bout, for nothing. I already know how it ends."',
      later: 'SABRINA: "You were always going to say that."',
      beaten: 'This loss shocks me... Yet somehow I saw it coming.',
      gloat: 'SABRINA: "As I foresaw. Next time, try surprising me."',
      sulk: 'SABRINA: "How interesting. I shall look again."',
    },
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
