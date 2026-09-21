import { describe, expect, it } from 'vitest';
import { HELD_ITEM_DEFINITIONS, ITEMS, ItemCategory, heldItemEffect, isHeldItemId } from '../../items';
import { BULBASAUR, CHARMANDER, PIDGEY } from '../species';
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
  it('is four pieces, each a different kind of answer and each its own sentence', () => {
    expect(HELD_ITEM_DEFINITIONS).toHaveLength(4);
    const kinds = HELD_ITEM_DEFINITIONS.map((item) => heldItemEffect(item.id)?.type);
    // Four items, four mechanisms: a percentage on everything is the failure
    // mode, and two items that do the same thing differently are one item.
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

  it('Quick Claw is a quarter of the time, and only for its holder', () => {
    expect(rollsFirstStrike(holding('quick-claw'), () => 0.24)).toBe(true);
    expect(rollsFirstStrike(holding('quick-claw'), () => 0.25)).toBe(false);
    expect(rollsFirstStrike(holding('life-orb'), () => 0)).toBe(false);
    expect(rollsFirstStrike(holding(null), () => 0)).toBe(false);
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
    const target = new Pokemon(PIDGEY, 5);
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
