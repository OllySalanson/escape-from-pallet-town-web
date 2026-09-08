import { describe, expect, it } from 'vitest';
import { Bag, ITEMS } from '../../items';
import { Pokemon } from '../Pokemon';
import { BULBASAUR, CHARMANDER, SQUIRTLE } from '../species';
import { createBattleState } from './battleEngine';
import { PrimaryStatus } from './status';
import {
  NO_REVIVE_IN_BATTLE_NOTE,
  applyBattleItem,
  battleItemCount,
  usableBattleItems,
} from './battleItems';

const battle = (player: Pokemon) => createBattleState(player, new Pokemon(BULBASAUR, 5));

describe('what the ITEM command offers', () => {
  it('lists the medicine the raid bag is carrying and nothing else', () => {
    const bag = new Bag({ potion: 2, antidote: 1, 'poke-ball': 5, 'great-ball': 1 });

    expect(usableBattleItems(bag).map((item) => item.id)).toEqual(['potion', 'antidote']);
    // Balls have their own command, so they are not counted here.
    expect(battleItemCount(bag)).toBe(3);
  });

  it('counts nothing when the player packed no medicine', () => {
    expect(battleItemCount(new Bag({ 'poke-ball': 3 }))).toBe(0);
  });
});

describe('using a medicine on the Pokemon that is out', () => {
  it('heals the combatant, not just the party entry behind it', () => {
    const charmander = new Pokemon(CHARMANDER, 5);
    // A level-5 starter has less HP than a Potion restores, so this heals to
    // full and reports only the HP that was actually missing.
    charmander.takeDamage(12);
    const state = battle(charmander);

    const use = applyBattleItem(state, ITEMS.potion, charmander);

    expect(use.used).toBe(true);
    expect(use.message).toBe('CHARMANDER recovered 12 HP!');
    // The battle reads HP off the combatant. Healing only the Pokemon would
    // have left the bar and every damage calculation on the old number.
    expect(use.state.player.currentHp).toBe(charmander.maxHp);
    expect(use.state.player.currentHp).toBeGreaterThan(state.player.currentHp);
  });

  it('cures a status the combatant is carrying', () => {
    const charmander = new Pokemon(CHARMANDER, 5);
    charmander.primaryStatus = PrimaryStatus.Poison;
    const state = battle(charmander);

    const use = applyBattleItem(state, ITEMS.antidote, charmander);

    expect(use.used).toBe(true);
    expect(use.message).toBe('CHARMANDER was cured of poison!');
    expect(use.state.player.primaryStatus).toBeNull();
  });

  it('heals from the damage the battle has done, not from a stale party number', () => {
    const charmander = new Pokemon(CHARMANDER, 5);
    const opened = battle(charmander);
    // The combatant has taken the fight's damage; the party entry has not yet
    // been written back. A Potion computed off the party entry would report a
    // heal that never happened.
    const state = { ...opened, player: { ...opened.player, currentHp: 1 } };

    const use = applyBattleItem(state, ITEMS.potion, charmander);

    expect(use.message).toBe(`CHARMANDER recovered ${charmander.maxHp - 1} HP!`);
    expect(use.state.player.currentHp).toBe(charmander.maxHp);
    expect(charmander.currentHp).toBe(use.state.player.currentHp);
  });
});

describe('using a medicine on a benched Pokemon', () => {
  it('heals it without disturbing the fight', () => {
    const charmander = new Pokemon(CHARMANDER, 5);
    const squirtle = new Pokemon(SQUIRTLE, 5);
    squirtle.takeDamage(9);
    const state = battle(charmander);

    const use = applyBattleItem(state, ITEMS.potion, squirtle);

    expect(use.used).toBe(true);
    expect(use.message).toBe(`SQUIRTLE recovered ${9} HP!`);
    expect(use.state).toBe(state);
    expect(squirtle.currentHp).toBe(squirtle.maxHp);
  });
});

describe('what a medicine refuses to do', () => {
  it('never revives, in battle any more than at base', () => {
    const charmander = new Pokemon(CHARMANDER, 5);
    const fainted = new Pokemon(SQUIRTLE, 5);
    fainted.takeDamage(fainted.maxHp);
    const state = battle(charmander);

    const use = applyBattleItem(state, ITEMS.potion, fainted);

    expect(use.used).toBe(false);
    expect(use.message).toBe(NO_REVIVE_IN_BATTLE_NOTE);
    expect(fainted.currentHp).toBe(0);
  });

  it('refuses a Potion at full HP, so the turn and the item are both kept', () => {
    const charmander = new Pokemon(CHARMANDER, 5);
    const state = battle(charmander);

    const use = applyBattleItem(state, ITEMS.potion, charmander);

    expect(use.used).toBe(false);
    expect(use.message).toBe('CHARMANDER is already at full HP!');
    expect(use.state).toBe(state);
  });

  it('refuses an Antidote against a condition it does not cure', () => {
    const charmander = new Pokemon(CHARMANDER, 5);
    charmander.primaryStatus = PrimaryStatus.Burn;
    const state = battle(charmander);

    const use = applyBattleItem(state, ITEMS.antidote, charmander);

    expect(use.used).toBe(false);
    expect(use.message).toBe('It would not have any effect on CHARMANDER.');
    expect(charmander.primaryStatus).toBe(PrimaryStatus.Burn);
  });
});
