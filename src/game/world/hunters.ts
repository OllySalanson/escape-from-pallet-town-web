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
 * names. The signature leads, and the rival's own `escorts` follow it (the
 * captain, 22 Nov 2026: "give each hunter its own type-true second Pokemon",
 * because a shared Raticate behind every lead was the same enemy in a
 * different hat - the 20 Nov playtest met it behind three hunters
 * alike). An escort is typed like the person, which a signature may not be:
 * it never meets a lone starter, only the party's second strongest and on.
 *
 * A signature has to be two things, and the second is measured
 * (`tools/hunter/measure.mts`): somebody's own Pokemon, and no starter's
 * lottery. The lead meets a lone starter alone, so a lead whose type answers
 * one starter's own type is the fight `hunter.ts` keeps the Normal lead for.
 * So the five are:
 *
 * - **Blue's Eevee**, the partner he takes off Oak's table in Yellow. Normal,
 *   so it answers nobody; it never evolves here, because no FireRed trainer
 *   fields any of its evolutions and which stone it would be is a choice
 *   nobody made.
 * - **Lorelei's Shellder**, the first stage of her FireRed Cloyster. It
 *   Tackles, then Icicle Spear from 8. Not her Seel (a lone Lv 8 Squirtle won
 *   5%) nor her Slowpoke (Water Gun at 13 took a Lv 16 Charmeleon to 10%).
 * - **Bruno's Mankey**, Scratch and then Low Kick and Karate Chop, which answer
 *   no starter. Not his Machop: Low Kick is all it has until 13, and this
 *   game's Low Kick is a weight move a hunter's sums count as nothing.
 * - **Agatha's Zubat**, the first stage of her FireRed Golbat. Not her Gastly:
 *   a Ghost cannot be touched by the Tackle and Scratch a Lv 5 starter has.
 * - **Lance's Ekans**, a serpent for the dragon tamer: his Dratini has only
 *   Wrap and Leer below 15, and his Horsea's Bubble took a lone Lv 8
 *   Charmander to 9%.
 *
 * The four after Blue were the gym leaders MISTY, LT. SURGE, KOGA and SABRINA
 * until 22 Nov 2026, when 13 of 19 first-time players in that day's playtest
 * met a Lv 2 "MISTY" on their first raid, beat her, and took the real Misty at
 * Cerulean Gym for somebody they had already beaten. Two of the four are the
 * vale's gym leaders and the others will be, so the hunters are now the Elite
 * Four: people everyone remembers, whom no gym in the vale will ever be.
 *
 * Each rival's ladder is measured on its own, and `hunter.test.ts` holds every
 * one to the floor a lone starter must clear on the last ordinary rung.
 *
 * The other field that would change a fight is `temperament`, the marked hook
 * for the harder hunter the captain means to add later ("keep everyone else
 * easy"): today every rival is `ordinary`, and a `hard` one is a new value
 * here plus the ladder it fights on, not a new system.
 *
 * Blue leads because the captain named him. The other four are the Elite Four
 * of FireRed/LeafGreen, whose own lines already read as somebody who hunts
 * you - the ice queen, a fighter, an old woman with a grudge and a dragon
 * tamer. Giovanni is kept back on purpose: the boss of Team Rocket is the
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
   * The first stages that follow the signature, in order: a team of N is the
   * signature and the first N - 1 of these. Five, so a full party of six is
   * met one for one. Each is the person's own type, and the first is one
   * they field in FireRed or another Kanto game where there is one. All of
   * them can attack by Lv 8, and none needs a stone
   * `HUNTER_STONE_EVOLUTION_LEVELS` has no row for (`hunter.test.ts`).
   */
  readonly escorts: readonly string[];
  /**
   * Said as they catch you, before the fight: always two lines, like the beat
   * it replaced, and the first of them is about your loot. Nothing else a rival
   * says is said out loud until then - the arrival is a red glow at the screen's
   * edge and the chip naming them (`hunterWarning.ts`), never a box that stops
   * the player - so the catch is where they get to gloat (the captain,
   * 2026-10-29: "whatever you found, loser, it's mine").
   */
  readonly caught: readonly [string, string];
  /**
   * What they say instead when they catch you after the raid clock has hit
   * 0:00, when every hunter comes stronger (`RunManager.isEnraged`). Said in the
   * caught lines, a hunter beaten earlier in the raid came back with a team
   * twice the level and the same words, and nothing said why (the overnight
   * retest, 23 Nov 2026). About the clock, never "I'm back", because the
   * hunter who catches you then may be one you never met.
   */
  readonly lateCaught: readonly [string, string];
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

export type HunterRivalId = 'blue' | 'lorelei' | 'bruno' | 'agatha' | 'lance';

/**
 * The five, in the order they come round. Lines stay short enough for one
 * dialogue box each, and each borrows the person's own voice from FireRed where
 * it can ("Smell ya later!", "frozen solid", "Hoo hah!", "that old duff", "Dragons are mythical").
 */
export const HUNTER_RIVALS: readonly HunterRival[] = [
  {
    id: 'blue',
    name: 'BLUE',
    design: 'blue',
    personality: 'Your rival. Cocky, always one step ahead in his own head, never lets you forget it.',
    temperament: 'ordinary',
    signature: 'eevee',
    // FireRed's own: his Rattata at Cerulean (the only hunter with one now)
    // and his Pidgey from Route 22, then the other birds and the Normal types a
    // rival with no type of his own fields.
    escorts: ['rattata', 'pidgey', 'spearow', 'doduo', 'meowth'],
    caught: ['BLUE: "Whatever you found, loser, it\'s mine!"', 'BLUE: "Hand it over. Smell ya later!"'],
    lateCaught: ['BLUE: "Time\'s up, loser! Now you get my best team."', 'BLUE: "Should\'ve left when you had the chance!"'],
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
    id: 'lorelei',
    name: 'LORELEI',
    design: 'lorelei',
    personality: 'The ice queen of the Elite Four. Cool, poised, amused; freezes you out with a smile.',
    temperament: 'ordinary',
    signature: 'shellder',
    // The rest of her FireRed team's first stages - Slowpoke, Seel, Jynx and
    // Lapras - then the sea she keeps them in.
    escorts: ['slowpoke', 'seel', 'jynx', 'lapras', 'krabby'],
    caught: ['LORELEI: "Whatever you found out here is mine now. Hand it over."', 'LORELEI: "Your POKéMON will be at my mercy when they are frozen solid!"'],
    lateCaught: ['LORELEI: "Your time ran out. I\'ve brought my coldest now."', 'LORELEI: "You should have left before the frost set in."'],
    getaway: 'LORELEI: "Run along, then. You\'ll only catch a chill."',
    defeat: 'You\'re better than I thought! ...Go on, then. Off you go.',
    hall: {
      first: 'LORELEI: "A new face. I\'ll be waiting out there, where it\'s cold."',
      afterLoss: 'LORELEI: "Lost the lot, I heard. The cold gets everyone in the end."',
      afterOut: 'LORELEI: "You got out. How refreshing. Don\'t let it go to your head."',
      offer: 'LORELEI: "A bout, here and now? Nothing at stake but a little frostbite."',
      later: 'LORELEI: "Suit yourself. I can wait. Ice is patient."',
      beaten: 'You\'re better than I thought! ...With everyone watching, too.',
      gloat: 'LORELEI: "Frozen solid. Do warm up before you try again."',
      sulk: 'LORELEI: "Hmph. Lucky. It won\'t thaw like that out there."',
    },
  },
  {
    id: 'bruno',
    name: 'BRUNO',
    design: 'bruno',
    personality: 'The fighter of the Elite Four. Loud, trains without rest, respects anyone who stands their ground.',
    temperament: 'ordinary',
    signature: 'mankey',
    // A Poliwag for the Poliwrath he'd make of it, the Geodude a man who
    // trains in caves picks up, then his FireRed Hitmonchan, Onix and
    // Hitmonlee. A Hitmonchan second was a wall (a Lv 10 Squirtle with a
    // Rattata won 45% on rung 4), and Rock seconds wall a team of Normal and
    // Flying birds (a Lv 25 Charmander's four, 1%; `measure.mts`).
    escorts: ['poliwag', 'geodude', 'hitmonchan', 'onix', 'hitmonlee'],
    caught: ['BRUNO: "That loot you found? It\'s mine now! Hoo hah!"', 'BRUNO: "We will grind you down with our superior power!"'],
    lateCaught: ['BRUNO: "Time\'s up! Now I fight at full strength! Hoo hah!"', 'BRUNO: "You stayed out too long. Brace yourself!"'],
    getaway: 'BRUNO: "Running is training too! I\'ll catch you next lap!"',
    defeat: 'Why? How could I lose? ...My job is done. Go!',
    hall: {
      first: 'BRUNO: "A new challenger! I\'ll be out there. Train hard!"',
      afterLoss: 'BRUNO: "You went down out there. Get up. Train harder. Hoo hah!"',
      afterOut: 'BRUNO: "You got out! Good legs. Now build the arms."',
      offer: 'BRUNO: "Spar with me! No stakes, just sweat! Hoo hah!"',
      later: 'BRUNO: "Rest, then. A fighter knows when to rest."',
      beaten: 'Why? How could I lose? ...In front of the whole hall!',
      gloat: 'BRUNO: "Superior power! Back to training with you! Hoo hah!"',
      sulk: 'BRUNO: "Hah! You have real strength. I must train harder."',
    },
  },
  {
    id: 'agatha',
    name: 'AGATHA',
    design: 'agatha',
    personality: "The oldest of the Elite Four. Cackling, cranky, calls you child, and has a lifelong grudge against Oak.",
    temperament: 'ordinary',
    signature: 'zubat',
    // Her FireRed Arbok's Ekans, then poison and ghosts: the Gastly late,
    // because a Ghost is no fight for a team whose Pokemon only Tackle.
    escorts: ['ekans', 'koffing', 'grimer', 'gastly', 'venonat'],
    caught: ['AGATHA: "Hehehe! All that loot you found, child? I\'ll take it."', 'AGATHA: "That old duff OAK sent you out here alone? Hah!"'],
    lateCaught: ['AGATHA: "Hehehe! Out of time, child. Now you meet my nasty ones."', 'AGATHA: "Should\'ve gone home when the clock said so!"'],
    getaway: 'AGATHA: "Run, child, run! I\'m old, not slow. Hehehe!"',
    defeat: 'Oh, my! You\'re something special, child! ...Shoo, then.',
    hall: {
      first: 'AGATHA: "So you\'re OAK\'s new pet. I\'ll be out there, child."',
      afterLoss: 'AGATHA: "Lost everything, did you? Hehehe! Just like OAK used to."',
      afterOut: 'AGATHA: "You got out, child. That old duff must be pleased."',
      offer: 'AGATHA: "A bout with an old woman? No stakes. I\'ll still win."',
      later: 'AGATHA: "Scared of a granny? Hehehe! Off you go, then."',
      beaten: 'Oh, my! You\'re something special, child! ...Don\'t tell OAK.',
      gloat: 'AGATHA: "Hehehe! Tell that old duff who taught you a lesson."',
      sulk: 'AGATHA: "Hmph! I see what the old duff sees in you, child."',
    },
  },
  {
    id: 'lance',
    name: 'LANCE',
    design: 'lance',
    personality: 'The dragon tamer who leads the Elite Four. Proud, grand, sure dragons are better than anything you own.',
    temperament: 'ordinary',
    signature: 'ekans',
    // Dragons are rare, and neither of his can lead: a Dratini has only Wrap
    // and Leer below 15, and a Horsea's Bubble is a Charmander's lottery. So a
    // serpent leads, then the Horsea whose line ends in a dragon, the sea and
    // sky a Gyarados keeps, and last his FireRed Aerodactyl, which second took
    // a Lv 10 Charmander with a Pidgey to 3% (`measure.mts`).
    escorts: ['horsea', 'goldeen', 'spearow', 'tentacool', 'aerodactyl'],
    caught: ['LANCE: "What you found belongs to a dragon tamer now. It\'s mine."', 'LANCE: "Dragons are mythical POKéMON! Their powers are superior!"'],
    lateCaught: ['LANCE: "Your time is up. Now my dragons fight for real."', 'LANCE: "You lingered too long. That was your mistake."'],
    getaway: 'LANCE: "Fly, then. A dragon always finds its prey."',
    defeat: 'That\'s it! I hate to admit it, but you\'re good. Go!',
    hall: {
      first: 'LANCE: "So you\'re the new one. I\'ll be out there, with my dragons."',
      afterLoss: 'LANCE: "You lost everything. Dragons never forget a weakness."',
      afterOut: 'LANCE: "You got out. Impressive, for someone without a dragon."',
      offer: 'LANCE: "A bout, for nothing? Come and meet a dragon."',
      later: 'LANCE: "Wise. Not everyone is ready to face a dragon."',
      beaten: 'That\'s it! I hate to admit it... and in front of everyone.',
      gloat: 'LANCE: "Dragons are superior. Come back when you know it."',
      sulk: 'LANCE: "I hate to admit it, but you are a fine trainer."',
    },
  },
];

/** A fresh save, and anything that does not know better, meets Blue. */
export const FIRST_HUNTER_RIVAL: HunterRivalId = 'blue';

export const hunterRival = (id: HunterRivalId): HunterRival =>
  HUNTER_RIVALS.find((rival) => rival.id === id) ?? HUNTER_RIVALS[0];

/** What a hunter says as they catch you: past 0:00, their late lines (`HunterRival.lateCaught`). */
export const caughtLines = (rival: HunterRival, enraged: boolean): readonly [string, string] =>
  enraged ? rival.lateCaught : rival.caught;

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

/**
 * The four hunters after Blue were MISTY, LT. SURGE, KOGA and SABRINA until
 * 22 Nov 2026 (see the header), and a save written before then names them in
 * its bout record. Each is read as the hunter who took their turn, so a ladder
 * half climbed is still half climbed.
 */
const RENAMED_RIVALS: Readonly<Record<string, HunterRivalId>> = {
  misty: 'lorelei',
  'lt-surge': 'bruno',
  koga: 'agatha',
  sabrina: 'lance',
};

/** A rival named in a save, under their name today, or undefined if it names nobody. */
export function storedRivalId(value: unknown): HunterRivalId | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  return HUNTER_RIVALS.find((rival) => rival.id === value)?.id ?? RENAMED_RIVALS[value];
}
