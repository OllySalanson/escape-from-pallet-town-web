import type { SoundEffectName } from '../audio/soundEffects';
import type { WindowLight } from '../base/homeClock';
import { windowLight } from '../base/homeClock';
import type { ItemId } from '../items';
import type { Pokemon } from '../pokemon';
import type { PokemonType } from '../pokemon/PokemonType';
import { fieldMoveUser, type FieldMoveId } from './fieldMoves';
import type { PokemonGift } from './gifts';
import { CHEST_ITEM_ID, TREASURE_PLACE, TREASURE_SECRET_ID } from '../treasure/treasureMap';
import { MISTY_BOSS_ID } from './valeQuarters';

/**
 * Secrets: small hidden nooks in Greystone Vale, each with a clue beside it,
 * holding something only under a condition fixed when the raid starts.
 *
 * Five parts make one, and each has a rule (the harbour arenas plan, section 4):
 *
 * - **The nook** is always there and always reachable: a hidden item spot, a
 *   Pokemon standing in a dead end, a person, or a stretch of water. It is
 *   drawn in its district's own program and tagged with the secret's id
 *   (`MapFileItemSpot.secret` and its kin), so this file knows no coordinate.
 * - **The clue** is a sign tagged with the same id, within ten steps of the
 *   nook, always readable. It says the place and hints at the condition and
 *   never gives the tile (`secrets.test.ts` holds all three).
 * - **The condition** is a fact the game already knows, read once as the raid
 *   deploys into `RaidConditions` and carried on the plan, so nothing changes
 *   under the player's feet and a seed plays the same raid. The one exception
 *   is a stretch of the raid clock (`raid-clock`): the deploy reading says it
 *   may come, and the nook asks the clock again as it is worked
 *   (`secretOpenAt`).
 * - **The reward** is an item, a Pokemon met or a Pokemon given. A secret may
 *   have several, given in order (the old shells' two fossils); the next is
 *   the first not yet found.
 * - **Found** is derived where it can be and stored where it cannot:
 *   `raidProgress.secretsFound` is written by every save from what the vault
 *   holds (`secretsHeldBy`), as the Pokedex is, so a reward lost with the pack
 *   on a wipe was never found and is there again next time its condition holds.
 *   A gift is found when its raid banks it (`giftsReceived`), as every gift is.
 *
 * A secret is never rolled: whether it is there is the condition and nothing
 * else, so a player who reads the clue and comes back at dusk is never told
 * "not this time". The one thing rolled is what a nook holds once everything
 * in it has been found - a berry, on a stream of the secrets' own
 * (`SECRET_STREAM` in `runGeneration.ts`), so no other roll of any raid moves.
 */

/** What a raid deployed under: the facts a secret's condition is asked of. */
export interface RaidConditions {
  /** The player's own clock as the raid left (`homeClock.ts`). */
  readonly hour: WindowLight;
  /** 0 is Sunday, by the player's own clock. */
  readonly weekday: number;
  /** 0 is January. */
  readonly month: number;
  /** The types of the party's first Pokemon, the one that leads. */
  readonly leadTypes: readonly PokemonType[];
  /** The field moves anybody in the party knows. */
  readonly fieldMoves: readonly FieldMoveId[];
  /** What was packed: every item id with at least one in the pack. */
  readonly carried: readonly string[];
  /** The bosses this save had beaten as the raid left: its badges among them (`base/badgeCase.ts`). */
  readonly badges: readonly string[];
  /**
   * Whether the treasure map is whole on THE CHART ROOM's wall
   * (`../treasure/treasureMap.ts`): the one condition the harbour sets rather
   * than the raid.
   */
  readonly chartWhole: boolean;
  /** How many Pokemon went on the raid: one is a raid gone on alone. */
  readonly partySize: number;
  /** Whether the party's first Pokemon, the one that leads, is in its other colours (`Pokemon.shiny`). */
  readonly leadShiny: boolean;
}

/** Read as the raid deploys. A party with nobody in it leads with no type. */
export function raidConditions(
  now: Date,
  party: readonly Pokemon[],
  packed: readonly { readonly itemId: string; readonly quantity: number }[],
  chartWhole: boolean,
  defeatedBosses: readonly string[],
): RaidConditions {
  return {
    hour: windowLight(now),
    weekday: now.getDay(),
    month: now.getMonth(),
    leadTypes: party[0] ? [party[0].base.primaryType, ...(party[0].base.secondaryType ? [party[0].base.secondaryType] : [])] : [],
    fieldMoves: (['cut', 'surf', 'rock-smash', 'strength'] as const).filter(
      (move) => fieldMoveUser(party, move) !== undefined,
    ),
    carried: packed.filter((stack) => stack.quantity > 0).map((stack) => stack.itemId),
    badges: [...defeatedBosses],
    chartWhole,
    partySize: party.length,
    leadShiny: party[0]?.shiny === true,
  };
}

/** How long THE HERON THAT IS NOT is stood still for: long enough to count, short enough that a raid can afford it. */
export const HERON_STILL_MS = 12_000;

/** One fact a secret waits for. */
export type SecretCondition =
  | { readonly kind: 'hour'; readonly hour: WindowLight }
  | { readonly kind: 'weekday'; readonly day: number }
  | { readonly kind: 'lead-type'; readonly type: PokemonType }
  | { readonly kind: 'field-move'; readonly move: FieldMoveId }
  /** Any one of these items in the pack. */
  | { readonly kind: 'carried'; readonly items: readonly ItemId[] }
  /** The treasure map whole on THE CHART ROOM's wall (`../treasure/treasureMap.ts`). */
  | { readonly kind: 'whole-chart' }
  /** A gym leader beaten before the raid left: their badge in the case. */
  | { readonly kind: 'badge'; readonly bossId: string }
  /**
   * A stretch of the raid clock: from `fromMs` until `untilMs` gone by since
   * the raid dropped in, which is what every clue and the library's book say
   * ("a minute in, until two"). Never the tide (`WorldScene.tideMs`), which a
   * boat and a timed exit are read against: that runs ahead by whatever the
   * Pokemon Center took off the raid, so after a heal the bell rang only in a
   * raid's first seconds, or with two minutes owed not at all (the bug hunt of
   * 10 Nov). A stretch must end before the shortest raid does - half the clock,
   * `MAX_PENDING_RECOVERY_MS` - which `secrets.test.ts` holds.
   */
  | { readonly kind: 'raid-clock'; readonly fromMs: number; readonly untilMs: number }
  /**
   * A raid gone on alone: one Pokemon in the party and no more. The one
   * condition that is a risk taken rather than a thing brought - nobody to
   * switch to, and a wipe on the first faint.
   */
  | { readonly kind: 'alone' }
  /**
   * A shiny walking in front: the party's first Pokemon in its other colours.
   * The one condition that is a rare find itself, so what waits for it is the
   * second link of a chain - THE RED ONE and THE PINK ONE are each a shiny a
   * raid can go and get.
   */
  | { readonly kind: 'lead-shiny' }
  /**
   * Standing still: `forMs` with no step and no turn, as the nook is worked.
   * It is paid for in raid clock, and a hunter walks up on anybody who stands
   * (`hunterIdleSteps`). Like a stretch of the clock it is read at the moment,
   * never as the raid deploys.
   */
  | { readonly kind: 'stood-still'; readonly forMs: number }
  /**
   * Dry boots: not one step in tall grass the whole raid, as the nook is
   * worked. It is paid for in the long way round - the boards, not the reeds -
   * and in every wild Pokemon the raid did not go into the grass for. Read at
   * the moment, like standing still: no raid has waded as it deploys.
   */
  | { readonly kind: 'dry-boots' }
  /** Any one of these. */
  | { readonly kind: 'either'; readonly of: readonly SecretCondition[] };

/** What is only known at the moment a nook is worked. */
export interface SecretMoment {
  /** How long the raid has been going. */
  readonly elapsedMs: number;
  /** How long the player has stood without a step or a turn. */
  readonly stillMs: number;
  /** Whether the raid has set foot in tall grass yet. */
  readonly waded: boolean;
}

/**
 * Whether a condition holds for a raid. `moment` is the moment a nook is
 * worked; without it - as the raid deploys - a stretch of the clock or of
 * standing still is one that may yet come, and holds, so the nook is laid and
 * asks again when it is worked.
 */
export function conditionHolds(condition: SecretCondition, raid: RaidConditions, moment?: SecretMoment): boolean {
  switch (condition.kind) {
    case 'hour':
      return raid.hour === condition.hour;
    case 'weekday':
      return raid.weekday === condition.day;
    case 'lead-type':
      return raid.leadTypes.includes(condition.type);
    case 'field-move':
      return raid.fieldMoves.includes(condition.move);
    case 'carried':
      return condition.items.some((item) => raid.carried.includes(item));
    case 'whole-chart':
      return raid.chartWhole;
    case 'badge':
      return raid.badges.includes(condition.bossId);
    case 'alone':
      return raid.partySize === 1;
    case 'lead-shiny':
      return raid.leadShiny;
    case 'raid-clock':
      return moment === undefined || (moment.elapsedMs >= condition.fromMs && moment.elapsedMs < condition.untilMs);
    case 'stood-still':
      return moment === undefined || moment.stillMs >= condition.forMs;
    case 'dry-boots':
      return moment === undefined || !moment.waded;
    case 'either':
      return condition.of.some((each) => conditionHolds(each, raid, moment));
  }
}

/** What a nook holds. */
export type SecretReward =
  /** An item on the nook's hidden spot. Found once the vault has held it. */
  | { readonly kind: 'item'; readonly itemId: ItemId }
  /**
   * A Pokemon met at the nook - standing in it, or on the first bite of a line
   * cast into it - and fought as a wild one. Found once the vault has held one
   * of its kind (and shiny, when it is).
   */
  | { readonly kind: 'meet'; readonly speciesId: string; readonly level: number; readonly shiny?: true }
  /** A Pokemon the nook's person hands over. Found once a raid banks it. */
  | { readonly kind: 'gift'; readonly gift: PokemonGift };

/** How a nook is worked, which says which tagged thing in the file it is. */
export type SecretNook =
  /** A hidden item spot tagged with the secret. */
  | 'spot'
  /** A standing Pokemon tagged with the secret, there only while it is open. */
  | 'figure'
  /** A person tagged with the secret, who gives only while it is open. */
  | 'giver'
  /** The water of the secret's place: the first bite of a raid it is open. */
  | 'line'
  /**
   * A sign tagged with the secret - the drowned church's bell rope - that,
   * worked while the secret is open, calls its Pokemon up to fight. Any other
   * time it reads as what it is, which is its clue.
   */
  | 'summons';

export interface Secret {
  readonly id: string;
  /** What a player would call it. */
  readonly name: string;
  /** The vale's named place it is in, as the file's districts name it. */
  readonly place: string;
  readonly nook: SecretNook;
  /** Every one of these, as the raid deployed. */
  readonly when: readonly SecretCondition[];
  /** In order: the next is the first not yet found. */
  readonly rewards: readonly SecretReward[];
  /** What is said as it is found, before the item or the fight. */
  readonly foundLine: string;
  /** What is heard as it is found, before the fight: the flute that wakes the sleeper. */
  readonly foundSound?: SoundEffectName;
  /**
   * For a `figure`: it stands every raid until it is had, not only while the
   * secret is open, and says these when spoken to while it is shut. The sleeper
   * in the pines lies across his clearing whatever the raid; only the flute in
   * the pack wakes him.
   */
  readonly shutLines?: readonly string[];
  /**
   * For a `figure` met in its other colours: the tint its standing figure
   * wears, so what is seen on the map is what the clue promised. The map's
   * figures are drawn from one sheet of icons in their ordinary colours, and
   * THE PINK ONE stood on its ride as blue as any Butterfree until the fight
   * began. A multiply over the icon, as a place's weather tints its ground.
   */
  readonly figureTint?: number;
  /**
   * Which wave of the plan it shipped in: the first needs no badge; the second
   * needs something bought or won first - the POKé FLUTE from THE GAME
   * CORNER's prize window, or MISTY beaten and THE COAST behind her open. The
   * third is four Pokemon a raid meets nowhere else, kinds FireRed keeps for
   * an in-game trade or a trade evolution: a Hypno, a Lickitung, a Mr. Mime
   * and a Gengar, each in a place that already had half the story. The fourth
   * is two more of the same making: an Alakazam among the Little Stones, and
   * the vale's second Pokemon in its other colours, a pink Butterfree.
   */
  readonly wave: 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * The Navvies' foreman's Machamp: a gift on the gift rule (`gifts.ts`), carried
 * home at risk and offered again until a raid banks it. It is a gift that
 * outclasses a starter on purpose, which is why it is not in `POKEMON_GIFTS`
 * (whose test holds every gift under the starters): it is only ever offered to
 * a party led by a Fighting type, and its level is measured against the first
 * gym (`secrets.test.ts`): handed over with no fight to pay for it, led into
 * Misty alone it must win less often than her best team has to (72% at Lv 16;
 * at 18 it was 94%, and the gym was its).
 */
export const NAVVIES_MACHAMP: PokemonGift = {
  id: 'navvies-machamp',
  giverId: 'secret:the-navvies-wager',
  mapId: 'greystone-vale',
  speciesId: 'machamp',
  level: 16,
  offer: [
    'You lead with a fighter. Right. Sleeves up.',
    'One... two... THREE! ...Well. Nobody has put my arm down in twenty years.',
    'A wager is a wager. MACHAMP has carried rails for me since it was a MACHOP. Take it - it wants a real fight, not track.',
    'MACHAMP joined your party! It is only yours once you carry it off the mountain.',
  ],
  offerPackLine:
    'MACHAMP is in your pack - your party is full. It is only yours once you carry it off the mountain.',
  offerNoRoomLine: 'Make some room and come back. I am not going anywhere. The rails are not either.',
  after: [
    'My arm still aches. Good wager, that.',
    'Look after MACHAMP. It liked the rails, mind.',
  ],
};

/** Every berry a pack can hold: what brings the sticky tongue out from behind the barrels. */
export const BERRY_ITEM_IDS: readonly ItemId[] = [
  'oran-berry',
  'sitrus-berry',
  'pecha-berry',
  'cheri-berry',
  'rawst-berry',
  'chesto-berry',
  'aspear-berry',
];

export const SECRETS: readonly Secret[] = [
  {
    id: 'the-long-shadow',
    name: 'THE LONG SHADOW',
    place: 'THE GREY STONES',
    nook: 'spot',
    when: [{ kind: 'hour', hour: 'dusk' }],
    rewards: [{ kind: 'item', itemId: 'chart-piece-1' }],
    foundLine: 'Where the tall stone\'s shadow ends, something is wrapped in oilcloth under the turf.',
    wave: 1,
  },
  {
    id: 'the-red-one',
    name: 'THE RED ONE',
    place: 'THE TARN',
    nook: 'line',
    when: [
      { kind: 'hour', hour: 'night' },
      { kind: 'carried', items: ['old-rod', 'good-rod'] },
    ],
    rewards: [{ kind: 'meet', speciesId: 'gyarados', level: 20, shiny: true }],
    foundLine: 'The line goes tight and the whole tarn heaves. Something red comes up out of the black water!',
    wave: 1,
  },
  {
    id: 'the-tappers-sunday',
    name: 'THE TAPPERS\' SUNDAY',
    place: 'THE TAPPERS’ CAMP',
    nook: 'spot',
    when: [{ kind: 'weekday', day: 0 }],
    rewards: [{ kind: 'item', itemId: 'chart-piece-2' }],
    foundLine: 'By the upturned pot, wrapped against the resin: no key. Somebody left this instead.',
    wave: 1,
  },
  {
    id: 'the-lost-fold',
    name: 'THE LOST FOLD',
    place: 'THE LOST FOLD',
    nook: 'spot',
    when: [{ kind: 'hour', hour: 'night' }],
    rewards: [{ kind: 'item', itemId: 'chart-piece-3' }],
    // Locked as well as timed: the fold is shut by High Moor's Strength
    // boulder, so it takes a night and a Pokemon that can push it.
    foundLine: 'The bells ring once, all together. Where the old ram used to lie, something is tucked into the wall.',
    wave: 1,
  },
  {
    id: 'the-old-shells',
    name: 'THE OLD SHELLS',
    place: 'Greystone Caves B1F',
    nook: 'spot',
    when: [
      {
        kind: 'either',
        of: [
          { kind: 'lead-type', type: 'Ground' },
          { kind: 'carried', items: ['pickaxe'] },
        ],
      },
    ],
    rewards: [
      { kind: 'item', itemId: 'helix-fossil' },
      { kind: 'item', itemId: 'dome-fossil' },
    ],
    foundLine: 'The cracked sand gives way. Something old and spiralled was waiting under it.',
    wave: 1,
  },
  {
    id: 'the-cracked-crag',
    name: 'THE CRACKED CRAG',
    place: 'THE GOAT TRACK',
    nook: 'figure',
    when: [
      { kind: 'hour', hour: 'dusk' },
      { kind: 'field-move', move: 'rock-smash' },
    ],
    rewards: [{ kind: 'meet', speciesId: 'golem', level: 22 }],
    foundLine: 'The red crack splits wide open - and the boulder stands up!',
    wave: 1,
  },
  {
    id: 'the-navvies-wager',
    name: 'THE NAVVIES\' WAGER',
    place: 'THE NAVVIES’ CAMP',
    nook: 'giver',
    when: [{ kind: 'lead-type', type: 'Fighting' }],
    rewards: [{ kind: 'gift', gift: NAVVIES_MACHAMP }],
    foundLine: 'The foreman looks your fighter up and down, and spits on his hand.',
    wave: 1,
  },
  {
    // The end of the treasure map (`../treasure/treasureMap.ts`): with the
    // whole chart on THE CHART ROOM's wall, the X at the foot of the cove's
    // cliff gives up the smugglers' chest. Behind MISTY, in THE COAST.
    id: TREASURE_SECRET_ID,
    name: 'X MARKS THE SPOT',
    place: TREASURE_PLACE,
    nook: 'spot',
    when: [{ kind: 'whole-chart' }],
    rewards: [{ kind: 'item', itemId: CHEST_ITEM_ID }],
    foundLine: 'Where the sand runs out under the cliff, the spade hits wood. An iron-bound chest, right under the X!',
    wave: 2,
  },
  {
    // FireRed's own way to wake a Snorlax: the POKé FLUTE, which THE GAME
    // CORNER's prize window sells (`../minigames/tickets.ts`). He lies at the
    // back of the bee wood's glade every raid until he is had - the honey is
    // what brought him - and only a flute in the pack wakes him. Lv 25 is an
    // earned fight before MISTY (`secrets.test.ts`).
    id: 'the-sleeper-in-the-pines',
    name: 'THE SLEEPER IN THE PINES',
    place: 'THE BEE WOOD',
    nook: 'figure',
    when: [{ kind: 'carried', items: ['poke-flute'] }],
    rewards: [{ kind: 'meet', speciesId: 'snorlax', level: 25 }],
    foundLine: "You played the POKé FLUTE. Now, that's a catchy tune! SNORLAX woke up! It attacked in a grumpy rage!",
    foundSound: 'pokeFlute',
    shutLines: ['A huge POKéMON is fast asleep across the back of the glade, snoring like a saw.', 'It will not budge for anything. Not for shouting, not for shoving.'],
    wave: 2,
  },
  {
    // THE COAST's own secret, past MISTY's sandbags: the old church went down
    // with the lower town, and its bell rope comes up out of the sea and is
    // tied off to a bollard on Market Street. Pulled at low water, a minute
    // into the raid and gone by two by the raid's own clock, with her badge
    // already won, the bell tolls and what has made the belfry its home comes
    // up to see who rang.
    // Lv 28 is an earned fight in the Coast's rain at KOGA's level, the gym it
    // comes before (`secrets.test.ts`).
    id: 'the-drowned-bell',
    name: 'THE DROWNED BELL',
    place: 'THE DROWNED TOWN',
    nook: 'summons',
    when: [
      { kind: 'badge', bossId: MISTY_BOSS_ID },
      { kind: 'raid-clock', fromMs: 60_000, untilMs: 120_000 },
    ],
    rewards: [{ kind: 'meet', speciesId: 'kabutops', level: 28 }],
    foundLine: 'You haul on the rope. Far below, the drowned bell tolls once... and something with scythes climbs up out of the belfry!',
    foundSound: 'bellToll',
    wave: 2,
  },
  {
    // FireRed's own story, from the Pokedex and from Berry Forest on Three
    // Island, where a HYPNO led a girl off into the trees: the picnicker in
    // Tanglewood's north glade has been "here since this morning" for longer
    // than he knows. After dark what keeps him there comes and stands by his
    // bench. Lv 26 is the level a DROWZEE turns into one, and an earned fight
    // before MISTY (`secrets.test.ts`); the DROWZEE dozing in the same glade by
    // day and by night is an ordinary standing Pokemon, in the district's file.
    id: 'the-lost-picnic',
    name: 'THE LOST PICNIC',
    place: 'THE LOST PICNIC',
    nook: 'figure',
    when: [{ kind: 'hour', hour: 'night' }],
    rewards: [{ kind: 'meet', speciesId: 'hypno', level: 26 }],
    foundLine: 'A little weight swings on its string, to and fro, to and fro... You shake your head clear. HYPNO was not expecting that!',
    wave: 3,
  },
  {
    // Something has licked every barrel behind the cider press clean round the
    // bung. It keeps to the gap between the barrels and the wood, and comes out
    // only for something sweeter than cider: a berry that was in the pack as
    // the raid set out (one picked on the way is picked too late - the
    // condition is read as the raid deploys). FireRed has LICKITUNG only by
    // trade, on Route 18. Lv 24 is an earned fight before MISTY.
    id: 'the-sticky-tongue',
    name: 'THE STICKY TONGUE',
    place: 'THE CIDER PRESS',
    nook: 'figure',
    when: [{ kind: 'carried', items: BERRY_ITEM_IDS }],
    rewards: [{ kind: 'meet', speciesId: 'lickitung', level: 24 }],
    foundLine: 'Something pink unrolls out of the gap behind the barrels, sniffing at your pack. LICKITUNG wants that berry!',
    wave: 3,
  },
  {
    // The Power Station's pickets have been out nine years, and the best of
    // them has not said a word or shifted a foot in all of it, holding up a
    // placard that is not there. He stands in the line every raid until he is
    // had (`shutLines`), and breaks his silence only for a mind he can hear: a
    // Psychic type walking in front. FireRed has MR. MIME only by trade, on
    // Route 2. Lv 22 is an earned fight before MISTY.
    id: 'the-silent-picket',
    name: 'THE SILENT PICKET',
    place: 'THE POWER STATION',
    nook: 'figure',
    when: [{ kind: 'lead-type', type: 'Psychic' }],
    rewards: [{ kind: 'meet', speciesId: 'mr-mime', level: 22 }],
    foundLine: 'The silent picket turns its head. It has heard something think. MR. MIME puts its placard down, very carefully, on nothing!',
    shutLines: [
      'This picket does not speak. It does not blink. It is holding up a placard that is not there.',
      'It leans, very slightly, on a wall that is not there either.',
    ],
    wave: 3,
  },
  {
    // A HAUNTER turns into a GENGAR only by trade, so no grass or floor in the
    // vale rolls one: the GENGAR a raid can meet is the shadow on the crypt
    // floor under THE MOOR CHAPEL - a place only a night raid reaches. It lies at the foot
    // of the gold graves every raid until it is had, with nothing in the room
    // to cast it, and gets up only for its own kind: a Ghost type
    // walking in front, which the churchyard above is where to catch. Lv 25 is
    // an earned fight before MISTY.
    id: 'the-shadow-in-the-crypt',
    name: 'THE SHADOW IN THE CRYPT',
    place: 'The Crypt',
    nook: 'figure',
    when: [{ kind: 'lead-type', type: 'Ghost' }],
    rewards: [{ kind: 'meet', speciesId: 'gengar', level: 25 }],
    foundLine: 'Your Ghost drifts over the shadow, and the shadow sits up and grins. GENGAR peels itself off the floor!',
    shutLines: [
      'A shadow lies across the floor at the foot of the gold graves. There is nothing in the crypt to cast it.',
      'It does not move when you do. You have the feeling it is being polite.',
    ],
    wave: 3,
  },
  {
    // The anime's own: a pink Butterfree, and the Butterfree that left with
    // it. Nell on the ride has been saying since the wood was filled that hers
    // "was a Butterfree and it left"; the pink one comes down the ride only to
    // see its own kind, a Bug type walking in front. A Butterfree in its other
    // colours, as THE RED ONE is a Gyarados in its: Lv 28 is an earned fight
    // before MISTY (at 25 the three starters won nine fights in ten).
    id: 'the-pink-one',
    name: 'THE PINK ONE',
    place: 'THE BUTTERFLY RIDE',
    nook: 'figure',
    when: [{ kind: 'lead-type', type: 'Bug' }],
    rewards: [{ kind: 'meet', speciesId: 'butterfree', level: 28, shiny: true }],
    figureTint: 0xff9ecf,
    foundLine: 'Something pink comes tumbling down the ride on the wind, round your Bug, and round again. A BUTTERFREE, and not the usual colour!',
    wave: 4,
  },
  {
    // The Little Stones' notice says there are nine and there were seven, and
    // Mother Stone counted nine and eleven in one night. One of them is not a
    // stone: an ALAKAZAM sits among them with its eyes shut, every raid until
    // it is had (`shutLines`), and opens them only for somebody who came up
    // alone - one Pokemon in the party, which is a raid with nobody to switch
    // to. A Kadabra becomes one only by trade, so nothing in the vale's grass
    // rolls one. Lv 22 is an earned fight before MISTY.
    id: 'the-eleventh-stone',
    name: 'THE ELEVENTH STONE',
    place: 'THE LITTLE STONES',
    nook: 'figure',
    when: [{ kind: 'alone' }],
    rewards: [{ kind: 'meet', speciesId: 'alakazam', level: 22 }],
    foundLine: 'The stone opens its eyes. It has been counting you. ALAKAZAM lifts both spoons!',
    shutLines: [
      'A stone among the stones, sitting very upright with its eyes shut. It is breathing.',
      'It knows exactly how many of you there are. It is waiting for fewer.',
    ],
    wave: 4,
  },
  {
    // The Heron Man on the Wide Water has timed a heron standing still for six
    // hours, and the Watcher in the hide says they stand just out of the slot.
    // What stands out among the lilies never moves while anybody fidgets. Stand
    // at the end of the boards as still as it does - twelve seconds with no
    // step and no turn, which is twelve seconds of raid clock and of a hunter
    // walking up - and it looks round, and it is blue. FireRed keeps DRAGONAIR
    // in the Safari Zone's water, on the Super Rod, at about this level. Lv 24
    // is an earned fight before MISTY.
    id: 'the-heron-that-is-not',
    name: 'THE HERON THAT IS NOT',
    place: 'THE WIDE WATER',
    nook: 'summons',
    when: [{ kind: 'stood-still', forMs: HERON_STILL_MS }],
    rewards: [{ kind: 'meet', speciesId: 'dragonair', level: 24 }],
    foundLine: 'You have not so much as shuffled. Out among the lilies the heron turns its long neck to look at you. It is blue. It is not a heron. DRAGONAIR!',
    wave: 5,
  },
  {
    // Old Bertie has lit THE OLD LIGHT every night for forty years, and the
    // boats have had radios for thirty of them. Something on the headland has
    // been signalling back the whole time: a STARMIE, whose core lights up at
    // night and is said to talk to others that way. It lies under the light
    // every raid until it is had (`shutLines`) and answers only a light in the
    // wrong colours - a shiny walking in front. A raid can go and get one: THE
    // RED ONE and THE PINK ONE are each always shiny, so this is the second
    // link of a chain. Lv 22 is an earned fight before MISTY, a level over her
    // own.
    id: 'the-light-that-answers',
    name: 'THE LIGHT THAT ANSWERS',
    place: 'THE OLD LIGHT',
    nook: 'figure',
    when: [{ kind: 'lead-shiny' }],
    rewards: [{ kind: 'meet', speciesId: 'starmie', level: 22 }],
    foundLine: 'Its core flares, colour after colour, at the one walking in front of you. Something has finally answered in the wrong colours. STARMIE spins up out of the grass!',
    shutLines: [
      'A star lies in the grass at the foot of the light, with a red stone at its heart. The stone flickers, stops, and flickers again.',
      'It is signalling. It waits a long time for an answer, and then it tries again.',
    ],
    wave: 5,
  },
  {
    // The Kite Flyer on the headland has lost four kites over the cliff and
    // says there is "a very well-off Krabby down there". There is: a KINGLER
    // on WRACKERS' SAND with four strings wound round its claw, every raid
    // until it is had (`shutLines`). It grabs at anything the wind brings over
    // the cliff, and comes for a Flying type walking in front - the commonest
    // lead there is after a starter, so this is the wave's easy one, as the
    // light is its hard one. FireRed keeps KINGLER on the Super Rod; a KRABBY
    // turns into one at 28. Lv 20 is an earned fight before MISTY.
    id: 'the-kite-thief',
    name: 'THE KITE THIEF',
    place: 'WRACKERS’ SAND',
    nook: 'figure',
    when: [{ kind: 'lead-type', type: 'Flying' }],
    rewards: [{ kind: 'meet', speciesId: 'kingler', level: 20 }],
    foundLine: 'It looks up at what is flying over its head, and it wants that as well. KINGLER drops the strings and comes for you, big claw first!',
    shutLines: [
      'A big crab sits in the sand with four kite strings wound round its claw. It is not flying them. It is keeping them.',
      'It watches the sky over the cliff, and nothing of yours. You have brought nothing it wants.',
    ],
    wave: 5,
  },
  {
    // The notice on THE DUCK HIDE says the ones on the bank are real and the
    // one in the water is a doll, and Birder Tess says it has not moved in a
    // week. It is a LAPRAS, and it lifts its head only for somebody the ducks
    // did not hear coming: dry boots, not one step in tall grass the whole
    // raid. Reedmere is "tall grass everywhere, and the dry way is the long
    // way" (`plan.ts`), so that is the boards from wherever the raid landed -
    // ten steps longer from Mill Square - and nothing caught in the grass on
    // the way. The doll is the map's own furniture and floats there after, so
    // once it is had the notice is true. FireRed hands its one LAPRAS over at
    // Lv 25, in Silph Co.; here it is an earned fight before MISTY.
    id: 'the-lapras-doll',
    name: 'THE LAPRAS DOLL',
    place: 'THE DUCK HIDE',
    nook: 'summons',
    when: [{ kind: 'dry-boots' }],
    rewards: [{ kind: 'meet', speciesId: 'lapras', level: 25 }],
    foundLine: 'You came all this way without bending a reed, and not a duck has stirred. Out on the water the doll lifts its head and looks at you. It is not a doll. LAPRAS!',
    wave: 6,
  },
];

export type SecretId = (typeof SECRETS)[number]['id'];

export function secretById(id: string): Secret | undefined {
  return SECRETS.find((secret) => secret.id === id);
}

/** Whether a string names a secret: what a map file's `secret` tag must be. */
export function isSecretId(id: string): boolean {
  return secretById(id) !== undefined;
}

/** What a save has found: the stored list, and the gifts banked. */
export interface SecretsKnown {
  readonly secretsFound: readonly string[];
  readonly giftsReceived: readonly string[];
}

/** The key `secretsFound` records a reward under. A gift is recorded as gifts are. */
export function rewardKey(secret: Secret, reward: SecretReward): string {
  switch (reward.kind) {
    case 'item':
      return reward.itemId;
    case 'meet':
      return `${secret.id}/${reward.speciesId}`;
    case 'gift':
      return reward.gift.id;
  }
}

export function rewardFound(secret: Secret, reward: SecretReward, known: SecretsKnown): boolean {
  return reward.kind === 'gift'
    ? known.giftsReceived.includes(reward.gift.id)
    : known.secretsFound.includes(rewardKey(secret, reward));
}

/** What the nook holds next: the first reward not found, or none once all are. */
export function nextReward(secret: Secret, known: SecretsKnown): SecretReward | undefined {
  return secret.rewards.find((reward) => !rewardFound(secret, reward, known));
}

/** Whether every reward of a secret has been found. */
export function secretSpent(secret: Secret, known: SecretsKnown): boolean {
  return nextReward(secret, known) === undefined;
}

/** Whether a secret's condition holds for a raid as it deploys: a stretch of the clock is one that may yet come. */
export function secretConditionHolds(secret: Secret, raid: RaidConditions): boolean {
  return secret.when.every((condition) => conditionHolds(condition, raid));
}

/**
 * Whether a secret is open at this moment of a raid: every condition, the
 * clock's stretch read at how long the raid has been going and a stretch of
 * standing still at how long the player has stood.
 */
export function secretOpenAt(secret: Secret, raid: RaidConditions, moment: SecretMoment): boolean {
  return secret.when.every((condition) => conditionHolds(condition, raid, moment));
}

/**
 * The secrets shut this raid whose figure stands anyway (`shutLines`): the
 * sleeper, across his glade every raid until he is had.
 */
export function sleepingSecrets(raid: RaidConditions, known: SecretsKnown): readonly string[] {
  return SECRETS.filter(
    (secret) =>
      secret.shutLines !== undefined &&
      !secretConditionHolds(secret, raid) &&
      nextReward(secret, known)?.kind === 'meet',
  ).map((secret) => secret.id);
}

/**
 * The secrets open this raid: condition met. A spent secret's nook is still
 * open - a spot holds a berry, a giver says their after-lines - so the place
 * goes on answering the clue; what it holds is `nextReward`.
 */
export function openSecrets(raid: RaidConditions): readonly string[] {
  return SECRETS.filter((secret) => secretConditionHolds(secret, raid)).map((secret) => secret.id);
}

/**
 * What the vault holds that a save writes as found: the item rewards it has
 * had, and every secret Pokemon it holds that *is* that secret's - tagged as it
 * was met (`Pokemon.fromSecret`). A Lapras caught in the Frozen Lagoon, or a
 * Krabby grown into a Kingler, is not the Lapras doll or the kite thief's, and
 * matching on species alone spent those secrets for good unfound (the gyms
 * playtest of 14 Nov 2026).
 */
export function secretsHeldBy(vault: {
  readonly itemCount: (itemId: string) => number;
  readonly pokemon: readonly { readonly fromSecret: string | null }[];
}): readonly string[] {
  return SECRETS.flatMap((secret) =>
    secret.rewards.flatMap((reward) => {
      if (reward.kind === 'item') {
        return vault.itemCount(reward.itemId) > 0 ? [rewardKey(secret, reward)] : [];
      }
      if (reward.kind === 'meet') {
        const key = rewardKey(secret, reward);
        return vault.pokemon.some((pokemon) => pokemon.fromSecret === key) ? [key] : [];
      }
      return [];
    }),
  );
}

/** The secret a tagged thing in a map file belongs to, if its tag names one. */
export function secretOf(tag: string | undefined): Secret | undefined {
  return tag === undefined ? undefined : secretById(tag);
}

/** The berries a spent spot may hold, one a raid it is open, rolled on the secrets' own stream. */
export const SPENT_NOOK_BERRIES: readonly ItemId[] = ['oran-berry', 'sitrus-berry', 'pecha-berry', 'cheri-berry'];
