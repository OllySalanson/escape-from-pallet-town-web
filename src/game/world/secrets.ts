import type { WindowLight } from '../base/homeClock';
import { windowLight } from '../base/homeClock';
import type { ItemId } from '../items';
import type { Pokemon } from '../pokemon';
import type { PokemonType } from '../pokemon/PokemonType';
import { fieldMoveUser, type FieldMoveId } from './fieldMoves';
import type { PokemonGift } from './gifts';

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
 *   under the player's feet and a seed plays the same raid.
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
}

/** Read as the raid deploys. A party with nobody in it leads with no type. */
export function raidConditions(
  now: Date,
  party: readonly Pokemon[],
  packed: readonly { readonly itemId: string; readonly quantity: number }[],
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
  };
}

/** One fact a secret waits for. */
export type SecretCondition =
  | { readonly kind: 'hour'; readonly hour: WindowLight }
  | { readonly kind: 'weekday'; readonly day: number }
  | { readonly kind: 'lead-type'; readonly type: PokemonType }
  | { readonly kind: 'field-move'; readonly move: FieldMoveId }
  /** Any one of these items in the pack. */
  | { readonly kind: 'carried'; readonly items: readonly ItemId[] }
  /** Any one of these. */
  | { readonly kind: 'either'; readonly of: readonly SecretCondition[] };

export function conditionHolds(condition: SecretCondition, raid: RaidConditions): boolean {
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
    case 'either':
      return condition.of.some((each) => conditionHolds(each, raid));
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
  | 'line';

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
  /** Which wave of the plan it shipped in: the first needs no badge. */
  readonly wave: 1;
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

/** Whether a secret's condition holds for a raid. */
export function secretConditionHolds(secret: Secret, raid: RaidConditions): boolean {
  return secret.when.every((condition) => conditionHolds(condition, raid));
}

/**
 * The secrets open this raid: condition met. A spent secret's nook is still
 * open - a spot holds a berry, a giver says their after-lines - so the place
 * goes on answering the clue; what it holds is `nextReward`.
 */
export function openSecrets(raid: RaidConditions): readonly string[] {
  return SECRETS.filter((secret) => secretConditionHolds(secret, raid)).map((secret) => secret.id);
}

/** What the vault holds that a save writes as found: the item and Pokemon rewards it has had. */
export function secretsHeldBy(vault: {
  readonly itemCount: (itemId: string) => number;
  readonly pokemon: readonly { readonly speciesId: string; readonly shiny: boolean }[];
}): readonly string[] {
  return SECRETS.flatMap((secret) =>
    secret.rewards.flatMap((reward) => {
      if (reward.kind === 'item') {
        return vault.itemCount(reward.itemId) > 0 ? [rewardKey(secret, reward)] : [];
      }
      if (reward.kind === 'meet') {
        const held = vault.pokemon.some(
          (pokemon) => pokemon.speciesId === reward.speciesId && (reward.shiny !== true || pokemon.shiny),
        );
        return held ? [rewardKey(secret, reward)] : [];
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
