import { describe, expect, it } from 'vitest';
import {
  HELD_ITEM_DEFINITIONS,
  HOLDABLE_ITEM_DEFINITIONS,
  ITEMS,
  ItemCategory,
  heldItemEffect,
  isHeldBerry,
  isHeldItemId,
} from '../../items';
import { Move } from '../Move';
import type { MoveBase } from '../MoveBase';
import type { PokemonBase } from '../PokemonBase';
import { SLEEP_POWDER, TACKLE, THUNDER_WAVE } from '../moves';
import { PrimaryStatus } from './status';
import { PokemonType } from '../PokemonType';
import { BULBASAUR, CHARMANDER, PIDGEY, SQUIRTLE, getSpeciesById } from '../species';
import { Pokemon } from '../Pokemon';
import {
  createBattleState,
  createTrainerBattleState,
  resolveTurn,
  type BattleEvent,
} from './battleEngine';
import {
  attackMultiplier,
  attackRecoil,
  berryBite,
  endOfTurnHeal,
  gearLabel,
  rollsFirstStrike,
  survivesKnockout,
} from './heldItems';

/** A random source that answers with a fixed list, then always zero. */
const rolls = (...values: readonly number[]): (() => number) => {
  let index = 0;
  return () => values[index++] ?? 0;
};

const holding = (itemId: string | null, maxHp = 32) => ({ heldItemId: itemId, maxHp });

describe('the gear catalogue', () => {
  it('is pieces each a different kind of answer and each its own sentence', () => {
    expect(HELD_ITEM_DEFINITIONS.length).toBeGreaterThanOrEqual(5);
    // One item a mechanism: a percentage on everything is the failure mode,
    // and two items that do the same thing differently are one item. FireRed's
    // type-boosting items are one mechanism a type, so each is told apart by
    // the type it boosts.
    const kinds = HELD_ITEM_DEFINITIONS.map((item) => {
      const effect = heldItemEffect(item.id);
      return effect?.type === 'type-power' ? `${effect.type}:${effect.moveType}` : effect?.type;
    });
    expect(new Set(kinds).size).toBe(kinds.length);
    for (const item of HELD_ITEM_DEFINITIONS) {
      expect(item.category).toBe(ItemCategory.Held);
      expect(isHeldItemId(item.id)).toBe(true);
      // The description is the whole rule, so it is a sentence and it ends.
      expect(item.description.endsWith('.')).toBe(true);
      expect(item.description.length).toBeGreaterThan(30);
    }
  });

  it('is never a supply: no kit line, no Brock price, no contract payout', () => {
    // `SupplyItemId` is what enforces the last two at the type level; this is
    // the runtime half of the same promise.
    for (const item of HELD_ITEM_DEFINITIONS) {
      expect(ITEMS[item.id as keyof typeof ITEMS].effect.type).toBe('held');
    }
    expect(isHeldItemId('potion')).toBe(false);
    expect(isHeldItemId('radio-valve')).toBe(false);
    expect(isHeldItemId(null)).toBe(false);
  });
});

describe('what each piece of gear does', () => {
  it('Leftovers pays back a share of maximum HP, and nothing to a full or empty holder', () => {
    expect(endOfTurnHeal(holding('leftovers', 32), 10)).toBe(2);
    // At least one, so the smallest Pokemon still sees it happen.
    expect(endOfTurnHeal(holding('leftovers', 12), 3)).toBe(1);
    // Never past full, and never to something already at zero.
    expect(endOfTurnHeal(holding('leftovers', 32), 31)).toBe(1);
    expect(endOfTurnHeal(holding('leftovers', 32), 32)).toBe(0);
    expect(endOfTurnHeal(holding('leftovers', 32), 0)).toBe(0);
    expect(endOfTurnHeal(holding(null, 32), 10)).toBe(0);
  });

  it('Focus Band takes one knockout blow, from above 1 HP, once', () => {
    const band = holding('focus-band');
    expect(survivesKnockout(band, 8, 9, false)).toBe(true);
    expect(survivesKnockout(band, 8, 8, false)).toBe(true);
    // A hit it would have survived anyway is not a hit the band spends itself on.
    expect(survivesKnockout(band, 8, 7, false)).toBe(false);
    // Already spent this battle, and a holder already on 1 HP: no free second life.
    expect(survivesKnockout(band, 8, 9, true)).toBe(false);
    expect(survivesKnockout(band, 1, 9, false)).toBe(false);
    expect(survivesKnockout(holding('leftovers'), 8, 9, false)).toBe(false);
  });

  it('Life Orb multiplies the hit and charges the holder for it, only when it lands', () => {
    expect(attackMultiplier(holding('life-orb'))).toBe(1.3);
    expect(attackMultiplier(holding(null))).toBe(1);
    expect(attackRecoil(holding('life-orb', 30), 7)).toBe(3);
    // A missed or nil-damage hit is not a hit, so it costs nothing.
    expect(attackRecoil(holding('life-orb', 30), 0)).toBe(0);
    expect(attackRecoil(holding('leftovers', 30), 7)).toBe(0);
  });

  it('Spell Tag raises Ghost moves by a tenth, as FireRed’s does, and nothing else', () => {
    expect(attackMultiplier(holding('spell-tag'), 'Ghost')).toBe(1.1);
    expect(attackMultiplier(holding('spell-tag'), 'Normal')).toBe(1);
    expect(attackMultiplier(holding('spell-tag'))).toBe(1);
    expect(attackMultiplier(holding('life-orb'), 'Ghost')).toBe(1.3);
  });

  it('Quick Claw is a quarter of the time, and only for its holder', () => {
    expect(rollsFirstStrike(holding('quick-claw'), () => 0.24)).toBe(true);
    expect(rollsFirstStrike(holding('quick-claw'), () => 0.25)).toBe(false);
    expect(rollsFirstStrike(holding('life-orb'), () => 0)).toBe(false);
    expect(rollsFirstStrike(holding(null), () => 0)).toBe(false);
  });

  it("NeverMeltIce raises an ICE move's power by FireRed's ten per cent, and nothing else's", () => {
    const ice = holding('never-melt-ice');
    expect(attackMultiplier(ice, PokemonType.Ice)).toBeCloseTo(1.1);
    expect(attackMultiplier(ice, PokemonType.Water)).toBe(1);
    expect(attackMultiplier(ice)).toBe(1);
  });

  it("Charcoal raises a FIRE move's power by FireRed's ten per cent, and nothing else's", () => {
    const charcoal = holding('charcoal');
    expect(attackMultiplier(charcoal, PokemonType.Fire)).toBeCloseTo(1.1);
    expect(attackMultiplier(charcoal, PokemonType.Grass)).toBe(1);
    expect(attackMultiplier(charcoal)).toBe(1);
  });

  it('names itself in the battle log', () => {
    expect(gearLabel('focus-band')).toBe('FOCUS BAND');
    expect(gearLabel(null)).toBe('');
  });
});

describe('the slot itself', () => {
  it('holds one item, never two, and hands back what it displaced', () => {
    const pokemon = new Pokemon(BULBASAUR, 5);

    expect(pokemon.heldItemId).toBeNull();
    expect(pokemon.giveHeldItem('leftovers')).toBeNull();
    expect(pokemon.giveHeldItem('life-orb')).toBe('leftovers');
    expect(pokemon.heldItemId).toBe('life-orb');
    expect(pokemon.takeHeldItem()).toBe('life-orb');
    expect(pokemon.heldItemId).toBeNull();
  });

  it('refuses anything that is not gear, so a stale save leaves the slot empty', () => {
    const pokemon = new Pokemon(BULBASAUR, 5);
    pokemon.giveHeldItem('potion');
    expect(pokemon.heldItemId).toBeNull();
    pokemon.giveHeldItem('never-shipped');
    expect(pokemon.heldItemId).toBeNull();
  });
});

describe('gear in a real fight', () => {
  const types = (events: readonly BattleEvent[]): string[] => events.map((event) => event.type);

  it('feeds its holder at the end of the turn, in the same breath as the damage', () => {
    const player = new Pokemon(BULBASAUR, 10);
    const enemy = new Pokemon(PIDGEY, 10);
    player.giveHeldItem('leftovers');
    player.takeDamage(10);
    const before = player.currentHp;
    const state = createBattleState(player, enemy);

    // Player first, both hits land, no crit: every roll is a middling one.
    const result = resolveTurn(state, 0, rolls(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5));
    const healed = result.events.find((event) => event.type === 'gear-heal');

    expect(healed).toBeDefined();
    expect(result.state.player.currentHp).toBeGreaterThan(before - 20);
    // The Pokemon underneath is untouched: HP belongs to the combatant until
    // the battle writes it back.
    expect(player.currentHp).toBe(before);
  });

  it('takes the blow that would have ended it, once, and says so', () => {
    // The band is on the target, so the lethal blow is one this test chooses:
    // an enemy's move is picked by a roll, and a roll can pick a Growl.
    const attacker = new Pokemon(CHARMANDER, 30);
    const hit = attacker.moves.findIndex((move) => move.base.power > 0);
    // Under the Sand-Attack FireRed teaches a Pidgey at 5, so its reply cannot
    // move the second blow's accuracy roll.
    const target = new Pokemon(PIDGEY, 4);
    target.giveHeldItem('focus-band');
    const state = createBattleState(attacker, target);

    const result = resolveTurn(state, hit, rolls(0.5, 0.9, 0.9, 0.5, 0.5, 0.5, 0.5, 0.5));

    expect(types(result.events)).toContain('gear-endured');
    expect(result.state.enemy.currentHp).toBe(1);
    expect(result.state.enemy.heldItemSpent).toBe(true);
    expect(result.state.outcome).toBe('active');

    // The band is spent for this battle, so the next blow lands as it would have.
    const second = resolveTurn(result.state, hit, rolls(0.5, 0.9, 0.9, 0.5, 0.5, 0.5, 0.5, 0.5));
    expect(second.state.outcome).toBe('victory');
  });

  it('hits harder for the Life Orb and charges the holder on the spot', () => {
    // By name, not by slot: which four moves a level-20 Charmander knows is a
    // property of its learnset, and a learnset entry added below 20 used to
    // silently turn this into a test of Growl.
    const attackIndex = (pokemon: Pokemon): number =>
      pokemon.moves.findIndex((move) => move.base.name === 'Ember');
    const player = new Pokemon(CHARMANDER, 20);
    const enemy = new Pokemon(PIDGEY, 20);
    const plain = resolveTurn(
      createBattleState(player, enemy),
      attackIndex(player),
      rolls(0.5, 0.5, 0.5, 0.5, 0.5, 0.5),
    );
    const plainDamage = enemy.maxHp - plain.state.enemy.currentHp;

    const armed = new Pokemon(CHARMANDER, 20);
    armed.giveHeldItem('life-orb');
    const orbed = resolveTurn(
      createBattleState(armed, new Pokemon(PIDGEY, 20)),
      attackIndex(armed),
      rolls(0.5, 0.5, 0.5, 0.5, 0.5, 0.5),
    );

    expect(orbed.state.enemy.pokemon.maxHp - orbed.state.enemy.currentHp).toBeGreaterThan(plainDamage);
    expect(types(orbed.events)).toContain('gear-recoil');
    expect(orbed.state.player.currentHp).toBeLessThan(armed.maxHp);
  });

  it('lets the Quick Claw move a slower holder first, and only when it fires', () => {
    // Pidgey outruns Bulbasaur at every level, so the order is never in doubt.
    // The first roll of a turn picks the enemy's move; the claws are rolled
    // after it, the player's first.
    const slow = new Pokemon(BULBASAUR, 10);
    slow.giveHeldItem('quick-claw');
    const fast = new Pokemon(PIDGEY, 10);
    expect(fast.stats.speed).toBeGreaterThan(slow.stats.speed);

    const clawed = resolveTurn(
      createBattleState(slow, fast),
      0,
      rolls(0.5, 0.1, 0.9, 0.5, 0.5, 0.5, 0.5, 0.5),
    );
    const clawedOrder = clawed.events.filter(
      (event): event is Extract<BattleEvent, { type: 'used-move' }> => event.type === 'used-move',
    );
    expect(types(clawed.events)[0]).toBe('gear-first-strike');
    expect(clawedOrder[0]?.user).toBe('player');

    const quiet = resolveTurn(
      createBattleState(new Pokemon(BULBASAUR, 10), new Pokemon(PIDGEY, 10)),
      0,
      rolls(0.5, 0.9, 0.9, 0.5, 0.5, 0.5, 0.5, 0.5),
    );
    const quietOrder = quiet.events.filter(
      (event): event is Extract<BattleEvent, { type: 'used-move' }> => event.type === 'used-move',
    );
    expect(quietOrder[0]?.user).toBe('enemy');
  });

  it('gives a newly sent-out Pokemon its own unspent band', () => {
    const lead = new Pokemon(BULBASAUR, 5);
    const bench = new Pokemon(CHARMANDER, 5);
    bench.giveHeldItem('focus-band');
    const trainer = { id: 'x', name: 'FOE', party: [lead, bench] };
    const state = createTrainerBattleState(new Pokemon(PIDGEY, 5), trainer);

    // The flag belongs to the combatant, so it starts false for whoever is out.
    expect(state.enemy.heldItemSpent).toBe(false);
    expect(state.enemy.pokemon.heldItemId).toBeNull();
  });
});

describe('the Miracle Seed', () => {
  it("raises a GRASS move's power by FireRed's ten per cent, and nothing else's", () => {
    const seed = holding('miracle-seed');
    expect(attackMultiplier(seed, PokemonType.Grass)).toBeCloseTo(1.1);
    expect(attackMultiplier(seed, PokemonType.Fire)).toBe(1);
    expect(attackMultiplier(seed)).toBe(1);
    expect(attackRecoil(seed, 10)).toBe(0);
  });

  it("lands a holder's Vine Whip harder in a real fight", () => {
    const vineWhip = (held: string | null): number => {
      const lead = new Pokemon(BULBASAUR, 12);
      if (held) lead.giveHeldItem(held);
      const slot = lead.moves.findIndex((move) => move.base.name === 'Vine Whip');
      expect(slot).toBeGreaterThanOrEqual(0);
      const foe = new Pokemon(SQUIRTLE, 30);
      foe.moves = [];
      const state = createBattleState(lead, foe);
      const { events } = resolveTurn(state, slot, () => 0.5);
      const hit = events.find(
        (event): event is Extract<BattleEvent, { type: 'used-move' }> =>
          event.type === 'used-move' && event.user === 'player',
      );
      return hit?.damage ?? 0;
    };
    expect(vineWhip('miracle-seed')).toBeGreaterThan(vineWhip(null));
  });
});

describe('a held berry', () => {
  /** A Pokemon holding exactly these moves; with none it cannot act at all. */
  const armed = (species: PokemonBase, level: number, ...moves: readonly MoveBase[]): Pokemon => {
    const pokemon = new Pokemon(species, level);
    pokemon.moves.splice(0, pokemon.moves.length, ...moves.map((move) => new Move(move)));
    return pokemon;
  };
  const find = <T extends BattleEvent['type']>(
    events: readonly BattleEvent[],
    type: T,
  ): Extract<BattleEvent, { type: T }> | undefined =>
    events.find((event): event is Extract<BattleEvent, { type: T }> => event.type === type);

  it('is medicine in the bag and something to hold, every one of the seven', () => {
    const berries = HOLDABLE_ITEM_DEFINITIONS.filter((item) => item.holdable);
    expect(berries.map((item) => item.id)).toEqual([
      'oran-berry',
      'sitrus-berry',
      'pecha-berry',
      'cheri-berry',
      'rawst-berry',
      'chesto-berry',
      'aspear-berry',
    ]);
    for (const berry of berries) {
      expect(berry.category).toBe(ItemCategory.Medicine);
      expect(isHeldItemId(berry.id)).toBe(true);
      expect(isHeldBerry(berry.id)).toBe(true);
      // What it does in a hand is read off what it does out of the bag.
      const held = heldItemEffect(berry.id);
      if (berry.effect.type === 'cure-status') {
        expect(held).toEqual({ type: 'berry-cure', status: berry.effect.status });
      } else {
        expect(berry.effect.type).toBe('heal');
        expect(held).toEqual({ type: 'berry-heal', amount: (berry.effect as { amount: number }).amount });
      }
      expect(berry.description).toMatch(/Held, it is eaten/);
    }
    // Gear is still gear, and nothing else is something to hold.
    expect(isHeldBerry('leftovers')).toBe(false);
    expect(HOLDABLE_ITEM_DEFINITIONS.filter((item) => item.category === ItemCategory.Held)).toEqual(
      HELD_ITEM_DEFINITIONS,
    );
  });

  it('cures its one status after a move or at the end of the turn, and only that one', () => {
    const chesto = holding('chesto-berry');
    expect(berryBite(chesto, 20, PrimaryStatus.Sleep, 'after-move')).toEqual({ kind: 'cure', status: 'sleep' });
    expect(berryBite(chesto, 20, PrimaryStatus.Sleep, 'end-of-turn')).toEqual({ kind: 'cure', status: 'sleep' });
    expect(berryBite(chesto, 20, PrimaryStatus.Paralysis, 'after-move')).toBeUndefined();
    expect(berryBite(chesto, 20, null, 'after-move')).toBeUndefined();
    // A fainted holder eats nothing.
    expect(berryBite(chesto, 0, PrimaryStatus.Sleep, 'after-move')).toBeUndefined();
  });

  it("restores its HP at the end of a turn that leaves the holder at half or less, FireRed's rule", () => {
    const oran = holding('oran-berry', 33);
    // `hp <= maxHP / 2`, in whole numbers: 16 of 33 is half, 17 is not.
    expect(berryBite(oran, 16, null, 'end-of-turn')).toEqual({ kind: 'heal', amount: 10 });
    expect(berryBite(oran, 17, null, 'end-of-turn')).toBeUndefined();
    // Never after a move: `ITEMEFFECT_MOVE_END` asks only the status berries.
    expect(berryBite(oran, 5, null, 'after-move')).toBeUndefined();
    // Never past the maximum.
    expect(berryBite(holding('sitrus-berry', 20), 10, null, 'end-of-turn')).toEqual({ kind: 'heal', amount: 10 });
  });

  it('wakes its holder the moment it falls asleep, so the turn it was put to sleep for is its own', () => {
    // The Oddish is made the faster, so its Sleep Powder lands first and the
    // berry is what lets the Bulbasaur's Tackle out that same turn.
    const sleeper = armed(BULBASAUR, 10, TACKLE);
    sleeper.giveHeldItem('chesto-berry');
    const oddish = armed(getSpeciesById('oddish')!, 10, SLEEP_POWDER);
    oddish.stats = { ...oddish.stats, speed: 999 };
    const result = resolveTurn(createBattleState(sleeper, oddish), 0, () => 0.1);

    const types = result.events.map((event) => event.type);
    expect(types.indexOf('status-applied')).toBeLessThan(types.indexOf('berry-cure'));
    const cured = find(result.events, 'berry-cure');
    expect(cured).toMatchObject({ user: 'player', item: 'CHESTO BERRY', status: 'sleep' });
    // And then it moves, that same turn, which is the whole of what it bought.
    const tackled = result.events.findIndex(
      (event, index) => index > types.indexOf('berry-cure') && event.type === 'used-move' && event.user === 'player',
    );
    expect(tackled).toBeGreaterThan(-1);
    expect(result.state.player.primaryStatus).toBeNull();
    expect(result.state.player.sleepTurns).toBe(0);
    // Eaten: the Pokemon's own hand is empty, and so carries nothing home.
    expect(sleeper.heldItemId).toBeNull();
  });

  it('is eaten once: the second Sleep Powder finds an empty hand', () => {
    const sleeper = armed(BULBASAUR, 10, TACKLE);
    sleeper.giveHeldItem('chesto-berry');
    const oddish = armed(getSpeciesById('oddish')!, 10, SLEEP_POWDER);
    const first = resolveTurn(createBattleState(sleeper, oddish), 0, () => 0.1);
    expect(find(first.events, 'berry-cure')).toBeDefined();
    const second = resolveTurn(first.state, 0, () => 0.1);
    expect(find(second.events, 'berry-cure')).toBeUndefined();
    expect(second.state.player.primaryStatus).toBe(PrimaryStatus.Sleep);
  });

  it('stays in the hand of a holder it has nothing to do for', () => {
    const holder = armed(BULBASAUR, 10, TACKLE);
    holder.giveHeldItem('cheri-berry');
    const oddish = armed(getSpeciesById('oddish')!, 10, SLEEP_POWDER);
    const result = resolveTurn(createBattleState(holder, oddish), 0, () => 0.1);
    expect(find(result.events, 'berry-cure')).toBeUndefined();
    expect(holder.heldItemId).toBe('cheri-berry');
  });

  it('restores HP at the end of the turn, after Leftovers would and before poison bites', () => {
    const holder = armed(BULBASAUR, 10, TACKLE);
    holder.giveHeldItem('oran-berry');
    holder.primaryStatus = PrimaryStatus.Poison;
    holder.currentHp = Math.floor(holder.maxHp / 2);
    const foe = armed(PIDGEY, 10);
    const result = resolveTurn(createBattleState(holder, foe), 0, () => 0.5);
    const types = result.events.map((event) => event.type);
    expect(types.indexOf('berry-heal')).toBeGreaterThan(-1);
    expect(types.indexOf('berry-heal')).toBeLessThan(types.indexOf('status-damage'));
    expect(find(result.events, 'berry-heal')).toMatchObject({ amount: 10, item: 'ORAN BERRY' });
  });

  it('works for the other side too, and a foe eats its own', () => {
    const attacker = armed(getSpeciesById('pikachu')!, 12, THUNDER_WAVE);
    const foe = armed(PIDGEY, 10);
    foe.giveHeldItem('cheri-berry');
    const result = resolveTurn(createBattleState(attacker, foe), 0, () => 0.1);
    expect(find(result.events, 'berry-cure')).toMatchObject({ user: 'enemy', status: 'paralysis' });
    expect(result.state.enemy.primaryStatus).toBeNull();
  });
});
