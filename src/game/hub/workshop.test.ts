import { describe, expect, it } from 'vitest';
import { ITEM_DEFINITIONS, isMaterial } from '../items';
import { BULBASAUR, CHARMANDER, PIDGEY, Pokemon } from '../pokemon';
import { MINIMUM_SUPPLIES, Stash } from '../stash';
import { ICON_NAMES } from '../ui/icons';
import {
  beaconUnlockAtMs,
  checkPayment,
  hasBeacon,
  hasHunterIntel,
  LAST_FIT_REFUSAL,
  WORKSHOP_UPGRADES,
  workshopOffers,
  workshopSecureItemStacks,
  workshopSecurePokemon,
  PARTNER_REFUSAL,
  payablePokemonCount,
  paymentCandidates,
  recoveryPriceShare,
  spendableSupply,
  takePayment,
  wardTreatmentsPerRaid,
  type WorkshopVault,
} from './workshop';

const EVERY_UPGRADE = WORKSHOP_UPGRADES.map((upgrade) => upgrade.id);

/** A vault with a level-9 partner, plenty of spare supplies and these catches. */
function vaultWith(
  catches: readonly Pokemon[],
  items: Readonly<Record<string, number>> = {
    'poke-ball': 9,
    potion: 7,
    'super-potion': 4,
    'great-ball': 4,
    antidote: 4,
    'radio-valve': 4,
    'cable-coil': 4,
    'parts-crate': 6,
    'lamp-oil': 4,
    'mooring-rope': 4,
    'linen-roll': 6,
  },
): WorkshopVault {
  const stash = new Stash({ items });
  stash.addPokemon(new Pokemon(CHARMANDER, 9), 'partner');
  catches.forEach((pokemon, index) => stash.addPokemon(pokemon, `catch-${index + 1}`));
  return { stash, starterSpeciesId: 'charmander' };
}

function fainted(pokemon: Pokemon): Pokemon {
  pokemon.takeDamage(pokemon.maxHp);
  return pokemon;
}

describe('the workshop ladder', () => {
  it('names every upgrade once and gates each second rung behind a first that exists', () => {
    expect(new Set(EVERY_UPGRADE).size).toBe(WORKSHOP_UPGRADES.length);
    for (const upgrade of WORKSHOP_UPGRADES) {
      if (upgrade.requires !== undefined) {
        expect(EVERY_UPGRADE).toContain(upgrade.requires);
        expect(upgrade.requires).not.toBe(upgrade.id);
      }
    }
  });

  it('is a sink: every rung costs at least one Pokemon and some supply that exists', () => {
    const itemIds = ITEM_DEFINITIONS.map((item) => item.id);
    for (const upgrade of WORKSHOP_UPGRADES) {
      expect(upgrade.cost.pokemon).toBeGreaterThanOrEqual(1);
      expect(upgrade.cost.supplies.length).toBeGreaterThanOrEqual(1);
      for (const { itemId, quantity } of upgrade.cost.supplies) {
        expect(itemIds).toContain(itemId);
        expect(quantity).toBeGreaterThanOrEqual(1);
      }
    }
  });

  /**
   * One rung, one capability. The single exception is stated rather than
   * implied: a Pokemon takes four squares of the container, so a rung that
   * protects one more Pokemon has to bring the column to stand it in or it is
   * a promise the container cannot keep - and nothing else may pair up.
   */
  it('pays in capability or information, and every rung changes exactly one thing', () => {
    for (const upgrade of WORKSHOP_UPGRADES) {
      const effects = [
        upgrade.secureItemStack,
        upgrade.securePokemon,
        upgrade.recoveryPriceShare !== undefined,
        upgrade.wardTreatments !== undefined,
        upgrade.hunterIntel,
        upgrade.beacon,
      ].filter(Boolean);
      if (upgrade.securePokemon) {
        expect(effects).toEqual([true, true]);
        expect(upgrade.secureItemStack).toBe(true);
        continue;
      }
      expect(effects).toHaveLength(1);
    }
  });

  it('draws every rung with an icon the shared set actually holds', () => {
    for (const upgrade of WORKSHOP_UPGRADES) {
      expect(ICON_NAMES).toContain(upgrade.icon);
    }
  });

  it('costs the most for the second protected Pokemon and the least for information', () => {
    const byId = new Map(WORKSHOP_UPGRADES.map((upgrade) => [upgrade.id, upgrade]));
    const prices = WORKSHOP_UPGRADES.map((upgrade) => upgrade.cost.pokemon);
    expect(byId.get('radio-mast')!.cost.pokemon).toBe(Math.min(...prices));
    expect(byId.get('secure-locker-2')!.cost.pokemon).toBe(Math.max(...prices));
  });
});

describe('what the upgrade list derives', () => {
  it('gives a base with nothing built nothing at all', () => {
    expect(workshopSecureItemStacks([])).toBe(0);
    expect(workshopSecurePokemon([])).toBe(0);
    expect(recoveryPriceShare([])).toBe(1);
    expect(wardTreatmentsPerRaid([])).toBe(0);
    expect(hasHunterIntel([])).toBe(false);
    expect(hasBeacon([])).toBe(false);
  });

  it('derives each effect from its own rung and from nothing else', () => {
    expect(workshopSecureItemStacks(['secure-locker-1'])).toBe(1);
    expect(workshopSecurePokemon(['secure-locker-1'])).toBe(0);
    expect(workshopSecurePokemon(['secure-locker-1', 'secure-locker-2'])).toBe(1);
    expect(recoveryPriceShare(['recovery-bay-1'])).toBe(0.75);
    expect(recoveryPriceShare(['recovery-bay-1', 'recovery-bay-2'])).toBe(0.5);
    expect(wardTreatmentsPerRaid(['quarantine-ward'])).toBe(1);
    expect(hasHunterIntel(['radio-mast'])).toBe(true);
    expect(hasBeacon(['beacon'])).toBe(true);
  });

  it('cannot be inflated by a repeated or unknown id', () => {
    expect(workshopSecureItemStacks(['secure-locker-1', 'secure-locker-1'])).toBe(1);
    expect(wardTreatmentsPerRaid(['quarantine-ward', 'quarantine-ward', 'golden-ward'])).toBe(1);
  });

  it('opens the beacon halfway through whatever clock the raid deploys with', () => {
    expect(beaconUnlockAtMs(300_000)).toBe(150_000);
    expect(beaconUnlockAtMs(150_000)).toBe(75_000);
    expect(beaconUnlockAtMs(-5)).toBe(0);
  });
});

describe('what may be spent', () => {
  it('never offers the only Pokemon a player has', () => {
    const vault = vaultWith([]);
    expect(paymentCandidates(vault).map((candidate) => candidate.refusal)).toEqual([PARTNER_REFUSAL]);
    expect(payablePokemonCount(vault)).toBe(0);
    expect(workshopOffers(vault, []).some((offer) => offer.affordable)).toBe(false);
    expect(checkPayment(vault, [], 'radio-mast', ['partner'])).toMatchObject({
      ok: false,
      refusal: 'pokemon-not-spendable',
    });
  });

  it('never offers a lone Pokemon even when it is not the partner species', () => {
    const stash = new Stash({ items: { 'radio-valve': 2, 'mooring-rope': 1 } });
    stash.addPokemon(new Pokemon(PIDGEY, 4), 'only');
    const vault: WorkshopVault = { stash, starterSpeciesId: 'charmander' };
    expect(paymentCandidates(vault)[0].refusal).toBe(LAST_FIT_REFUSAL);
    expect(checkPayment(vault, [], 'radio-mast', ['only'])).toMatchObject({ ok: false });
    expect(stash.listPokemon()).toHaveLength(1);
  });

  it('refuses the partner species however many of it are banked', () => {
    const vault = vaultWith([new Pokemon(CHARMANDER, 4), new Pokemon(PIDGEY, 4)]);
    const refusals = paymentCandidates(vault).map((candidate) => candidate.refusal);
    expect(refusals).toEqual([PARTNER_REFUSAL, PARTNER_REFUSAL, undefined]);
  });

  it('always leaves somebody fit to raid, even when every fit Pokemon is spendable', () => {
    const stash = new Stash({ items: { 'poke-ball': 9, potion: 9, 'parts-crate': 2 } });
    stash.addPokemon(new Pokemon(PIDGEY, 4), 'fit-1');
    stash.addPokemon(new Pokemon(BULBASAUR, 4), 'fit-2');
    stash.addPokemon(fainted(new Pokemon(PIDGEY, 5)), 'down');
    const vault: WorkshopVault = { stash, starterSpeciesId: 'charmander' };

    // Three are spendable, but releasing both fit ones would leave only a faint.
    expect(payablePokemonCount(vault)).toBe(2);
    expect(checkPayment(vault, [], 'secure-locker-1', ['fit-1', 'fit-2'])).toMatchObject({
      ok: false,
      refusal: 'no-pokemon-left-fit',
    });
    expect(checkPayment(vault, [], 'secure-locker-1', ['fit-1', 'down'])).toMatchObject({ ok: true });
  });

  it('prices every rung in materials, never in the kit a wipe restocks', () => {
    for (const upgrade of WORKSHOP_UPGRADES) {
      expect(upgrade.cost.supplies.length, upgrade.id).toBeGreaterThan(0);
      for (const { itemId } of upgrade.cost.supplies) {
        expect(isMaterial(itemId), `${upgrade.id} costs ${itemId}`).toBe(true);
        expect(MINIMUM_SUPPLIES, `${upgrade.id} costs ${itemId}`).not.toHaveProperty(itemId);
      }
    }
  });

  it('is short of a material a kit-only vault does not hold, and never takes the kit', () => {
    const vault = vaultWith([new Pokemon(PIDGEY, 4), new Pokemon(PIDGEY, 5)], { ...MINIMUM_SUPPLIES });
    expect(spendableSupply(vault, 'parts-crate')).toBe(0);
    expect(checkPayment(vault, [], 'secure-locker-1', ['catch-1', 'catch-2'])).toMatchObject({
      ok: false,
      refusal: 'supplies-short',
    });
    const offer = workshopOffers(vault, []).find(({ upgrade }) => upgrade.id === 'secure-locker-1')!;
    expect(offer.pokemonShort).toBe(0);
    expect(offer.affordable).toBe(false);
    expect(offer.suppliesShort).toEqual([{ itemId: 'parts-crate', quantity: 2 }]);
  });

  it('spends materials in full and leaves the kit exactly as it was', () => {
    const vault = vaultWith([new Pokemon(PIDGEY, 4), new Pokemon(PIDGEY, 5)], {
      ...MINIMUM_SUPPLIES,
      'parts-crate': 2,
    });
    expect(spendableSupply(vault, 'parts-crate')).toBe(2);
    takePayment(vault, [], 'secure-locker-1', ['catch-1', 'catch-2']);
    expect(vault.stash.itemCount('parts-crate')).toBe(0);
    expect(vault.stash.supplyShortfall()).toEqual({});
    expect(vault.stash.itemCount('poke-ball')).toBe(MINIMUM_SUPPLIES['poke-ball']);
    // The restock never hands a material out: a wiped vault is refilled with the kit alone.
    vault.stash.restockMinimumSupplies();
    expect(vault.stash.itemCount('parts-crate')).toBe(0);
  });

  it('reads the kit as a capability, so a better ball or potion frees the plain one', () => {
    // Five throws and three heals are the kit, whatever tier holds them.
    const vault = vaultWith([new Pokemon(PIDGEY, 4), new Pokemon(PIDGEY, 5)], {
      'poke-ball': 5,
      'great-ball': 2,
      potion: 3,
      'super-potion': 1,
      antidote: 2,
      'parts-crate': 2,
      // A pack answers the kit's pack line, so the shortfall below is about
      // supplies alone rather than about a vault with nothing to carry in.
      'raid-pack': 1,
    });
    expect(spendableSupply(vault, 'poke-ball')).toBe(2);
    expect(spendableSupply(vault, 'potion')).toBe(1);
    // An Antidote heals nothing, so it is never part of the kit.
    expect(spendableSupply(vault, 'antidote')).toBe(2);
    expect(checkPayment(vault, [], 'secure-locker-1', ['catch-1', 'catch-2'])).toMatchObject({ ok: true });

    takePayment(vault, [], 'secure-locker-1', ['catch-1', 'catch-2']);
    expect(vault.stash.supplyShortfall()).toEqual({});
  });

  it('takes exactly the named Pokemon and the listed supplies, and nothing on a refusal', () => {
    const vault = vaultWith([new Pokemon(PIDGEY, 4), new Pokemon(PIDGEY, 5), new Pokemon(BULBASAUR, 6)]);
    const before = vault.stash.toJSON();

    expect(takePayment(vault, [], 'secure-locker-1', ['catch-1'])).toMatchObject({
      ok: false,
      refusal: 'wrong-pokemon-count',
    });
    expect(takePayment(vault, [], 'secure-locker-1', ['catch-1', 'catch-1'])).toMatchObject({ ok: false });
    expect(takePayment(vault, [], 'secure-locker-1', ['catch-1', 'nobody'])).toMatchObject({ ok: false });
    expect(vault.stash.toJSON()).toEqual(before);

    expect(takePayment(vault, [], 'secure-locker-1', ['catch-1', 'catch-3'])).toMatchObject({ ok: true });
    expect(vault.stash.listPokemon().map(({ id }) => id)).toEqual(['partner', 'catch-2']);
    expect(vault.stash.itemCount('parts-crate')).toBe(4);
    expect(vault.stash.itemCount('poke-ball')).toBe(9);
    expect(vault.stash.itemCount('potion')).toBe(7);
    expect(vault.stash.itemCount('antidote')).toBe(4);
  });

  it('builds a rung once, and a second rung only after its first', () => {
    const vault = vaultWith(Array.from({ length: 6 }, () => new Pokemon(PIDGEY, 4)));
    const four = ['catch-1', 'catch-2', 'catch-3', 'catch-4'];
    expect(checkPayment(vault, [], 'secure-locker-2', four)).toMatchObject({ ok: false, refusal: 'locked' });
    expect(checkPayment(vault, ['secure-locker-1'], 'secure-locker-2', four)).toMatchObject({ ok: true });
    expect(checkPayment(vault, ['secure-locker-1'], 'secure-locker-1', ['catch-1', 'catch-2']))
      .toMatchObject({ ok: false, refusal: 'already-built' });
    expect(checkPayment(vault, [], 'gear-tier-9', [])).toMatchObject({ ok: false, refusal: 'unknown-upgrade' });

    const states = workshopOffers(vault, ['secure-locker-1']).map(({ upgrade, state }) => [upgrade.id, state]);
    expect(states).toContainEqual(['secure-locker-1', 'built']);
    expect(states).toContainEqual(['secure-locker-2', 'open']);
    expect(states).toContainEqual(['recovery-bay-2', 'locked']);
  });
});
