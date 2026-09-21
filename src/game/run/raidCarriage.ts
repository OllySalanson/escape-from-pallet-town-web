import type { Bag } from '../items';
import type { Pokemon, PokemonParty } from '../pokemon';
import type { HunterState } from '../world/hunter';
import type { ActiveRunSession, RaidLocation } from './RunSession';

/**
 * Everything about a raid in progress that lives on `WorldScene` and nowhere
 * else, and so has to be carried through a battle and handed back.
 *
 * `scene.start('battle')` shuts the world down and `scene.start('world')`
 * builds it again from its payload, so a fact that is not in the payload is a
 * fact the raid forgets. The wild-encounter payload was written out by hand
 * beside the trainer one and was two fields short of it: every wild fight
 * un-spawned the hunter - which then arrived and announced itself again, even
 * one already beaten - and stood every beaten trainer back up.
 *
 * Every key is required, with `undefined` spelled out where there is nothing to
 * carry, and both directions are typed against it: `WorldScene.raidCarriage()`
 * is the one place the world packs it for every kind of fight, and
 * `BattleScene` has to hand back a whole one. A new piece of per-raid world
 * state is added here, and the compiler then names each place that must carry
 * it.
 */
export interface RaidCarriage {
  readonly party: PokemonParty;
  /**
   * The raid's own pack, balls included, and the same object both ways: an item
   * drunk in a fight is gone from the supplies the overworld, the settlement and
   * the stash all read.
   */
  readonly bag: Bag;
  readonly caughtPokemonStash: Pokemon[];
  /** Undefined only outside a raid, where there is no session to carry. */
  readonly runSession: ActiveRunSession | undefined;
  /** Trainer victories, loot pickups and landmark activations last one raid. */
  readonly defeatedTrainerIds: readonly string[];
  /**
   * Gear a beaten boss dropped that the pack had no room for, still waiting.
   *
   * A boss drops its gear once per save, at the moment the win is recorded, so
   * a full pack used to destroy it with nothing the player could do: they were
   * told after the fact. It waits here instead, and the raid hands it over the
   * moment there is room for it - which means it has to survive the next fight,
   * like every other fact about a raid in progress.
   */
  readonly unclaimedBossGear: readonly { readonly itemId: string; readonly name: string }[];
  readonly collectedLootIds: readonly string[];
  /**
   * Rare finds this raid has laid eyes on, by loot id.
   *
   * The prize chip is the caption's memory - it keeps asking for a thing the
   * player has seen and walked away from - so what it remembers is per-raid
   * world state like any other, and a fight is exactly the moment it would
   * otherwise be forgotten: the hunter arrives beside the Fire Stone, you win,
   * and the world comes back with no idea the stone is there.
   */
  readonly seenPrizeIds: readonly string[];
  readonly activatedPoiIds: readonly string[];
  /** Spawned, beaten, searching: the hunter is the same hunter after a fight. */
  readonly hunterState: HunterState | undefined;
  /** The exact tile and facing the world puts the player back on. */
  readonly returnLocation: RaidLocation | undefined;
}

/**
 * The carriage's keys as data, so a test can hold a payload to the whole list.
 * The check under it fails to compile if the interface gains a key this list
 * does not name.
 */
export const RAID_CARRIAGE_KEYS = [
  'party',
  'bag',
  'caughtPokemonStash',
  'runSession',
  'defeatedTrainerIds',
  'unclaimedBossGear',
  'collectedLootIds',
  'seenPrizeIds',
  'activatedPoiIds',
  'hunterState',
  'returnLocation',
] as const satisfies readonly (keyof RaidCarriage)[];

type MissingCarriageKey = Exclude<keyof RaidCarriage, (typeof RAID_CARRIAGE_KEYS)[number]>;
// Assignable only while no key is missing from the list above.
const everyKeyIsListed: [MissingCarriageKey] extends [never] ? true : never = true;
void everyKeyIsListed;
