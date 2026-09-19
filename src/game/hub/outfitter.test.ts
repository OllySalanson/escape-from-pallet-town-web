import { describe, expect, it } from 'vitest';
import { ITEM_DEFINITIONS } from '../items';
import { contractRestockBonus, RAID_CONTRACTS } from '../objectives/contracts';
import { BULBASAUR, CHARMANDER, PIDGEY, Pokemon } from '../pokemon';
import { MINIMUM_SUPPLIES, minimumSupplies, Stash } from '../stash';
import { ICON_NAMES } from '../ui/icons';
import {
  beaconUnlockAtMs,
  checkPayment,
  hasBeacon,
  hasHunterIntel,
  LAST_FIT_REFUSAL,
  OUTFITTER_UPGRADES,
  outfitterOffers,
  outfitterSecureItemStacks,
  outfitterSecurePokemon,
  PARTNER_REFUSAL,
  payablePokemonCount,
  paymentCandidates,
  recoveryPriceShare,
  spendableSupply,
  takePayment,
  wardTreatmentsPerRaid,
  type OutfitterVault,
} from './outfitter';

const EVERY_UPGRADE = OUTFITTER_UPGRADES.map((upgrade) => upgrade.id);

/** A vault with a level-9 partner, plenty of spare supplies and these catches. */
function vaultWith(
  catches: readonly Pokemon[],
  items: Readonly<Record<string, number>> = {
    'poke-ball': 9,
    potion: 7,
    'super-potion': 4,
    'great-ball': 4,
    antidote: 4,
  },
): OutfitterVault {
  const stash = new Stash({ items });
  stash.addPokemon(new Pokemon(CHARMANDER, 9), 'partner');
  catches.forEach((pokemon, index) => stash.addPokemon(pokemon, `catch-${index + 1}`));
  return { stash, starterSpeciesId: 'charmander', protectedSupplies: MINIMUM_SUPPLIES };
}

function fainted(pokemon: Pokemon): Pokemon {
  pokemon.takeDamage(pokemon.maxHp);
  return pokemon;
}

describe('the Outfitter ladder', () => {
  it('names every upgrade once and gates each second rung behind a first that exists', () => {
    expect(new Set(EVERY_UPGRADE).size).toBe(OUTFITTER_UPGRADES.length);
    for (const upgrade of OUTFITTER_UPGRADES) {
      if (upgrade.requires !== undefined) {
        expect(EVERY_UPGRADE).toContain(upgrade.requires);
        expect(upgrade.requires).not.toBe(upgrade.id);
      }
    }
  });

  it('is a sink: every rung costs at least one Pokemon and some supply that exists', () => {
    const itemIds = ITEM_DEFINITIONS.map((item) => item.id);
    for (const upgrade of OUTFITTER_UPGRADES) {
      expect(upgrade.cost.pokemon).toBeGreaterThanOrEqual(1);
      expect(upgrade.cost.supplies.length).toBeGreaterThanOrEqual(1);
      for (const { itemId, quantity } of upgrade.cost.supplies) {
        expect(itemIds).toContain(itemId);
        expect(quantity).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('pays in capability or information, and every rung changes exactly one thing', () => {
    for (const upgrade of OUTFITTER_UPGRADES) {
      const effects = [
        upgrade.secureItemStack,
        upgrade.securePokemon,
        upgrade.recoveryPriceShare !== undefined,
        upgrade.wardTreatments !== undefined,
        upgrade.hunterIntel,
        upgrade.beacon,
      ].filter(Boolean);
      expect(effects).toHaveLength(1);
    }
  });

  it('draws every rung with an icon the shared set actually holds', () => {
    for (const upgrade of OUTFITTER_UPGRADES) {
      expect(ICON_NAMES).toContain(upgrade.icon);
    }
  });

  it('costs the most for the second protected Pokemon and the least for information', () => {
    const byId = new Map(OUTFITTER_UPGRADES.map((upgrade) => [upgrade.id, upgrade]));
    const prices = OUTFITTER_UPGRADES.map((upgrade) => upgrade.cost.pokemon);
    expect(byId.get('radio-mast')!.cost.pokemon).toBe(Math.min(...prices));
    expect(byId.get('secure-locker-2')!.cost.pokemon).toBe(Math.max(...prices));
  });
});

describe('what the upgrade list derives', () => {
  it('gives a base with nothing built nothing at all', () => {
    expect(outfitterSecureItemStacks([])).toBe(0);
    expect(outfitterSecurePokemon([])).toBe(0);
    expect(recoveryPriceShare([])).toBe(1);
    expect(wardTreatmentsPerRaid([])).toBe(0);
    expect(hasHunterIntel([])).toBe(false);
    expect(hasBeacon([])).toBe(false);
  });

  it('derives each effect from its own rung and from nothing else', () => {
    expect(outfitterSecureItemStacks(['secure-locker-1'])).toBe(1);
    expect(outfitterSecurePokemon(['secure-locker-1'])).toBe(0);
    expect(outfitterSecurePokemon(['secure-locker-1', 'secure-locker-2'])).toBe(1);
    expect(recoveryPriceShare(['recovery-bay-1'])).toBe(0.75);
    expect(recoveryPriceShare(['recovery-bay-1', 'recovery-bay-2'])).toBe(0.5);
    expect(wardTreatmentsPerRaid(['quarantine-ward'])).toBe(1);
    expect(hasHunterIntel(['radio-mast'])).toBe(true);
    expect(hasBeacon(['beacon'])).toBe(true);
  });

  it('cannot be inflated by a repeated or unknown id', () => {
    expect(outfitterSecureItemStacks(['secure-locker-1', 'secure-locker-1'])).toBe(1);
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
    expect(outfitterOffers(vault, []).some((offer) => offer.affordable)).toBe(false);
    expect(checkPayment(vault, [], 'radio-mast', ['partner'])).toMatchObject({
      ok: false,
      refusal: 'pokemon-not-spendable',
    });
  });

  it('never offers a lone Pokemon even when it is not the partner species', () => {
    const stash = new Stash({ items: { antidote: 5 } });
    stash.addPokemon(new Pokemon(PIDGEY, 4), 'only');
    const vault: OutfitterVault = {
      stash,
      starterSpeciesId: 'charmander',
      protectedSupplies: {},
    };
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
    const stash = new Stash({ items: { 'poke-ball': 9, potion: 9 } });
    stash.addPokemon(new Pokemon(PIDGEY, 4), 'fit-1');
    stash.addPokemon(new Pokemon(BULBASAUR, 4), 'fit-2');
    stash.addPokemon(fainted(new Pokemon(PIDGEY, 5)), 'down');
    const vault: OutfitterVault = { stash, starterSpeciesId: 'charmander', protectedSupplies: {} };

    // Three are spendable, but releasing both fit ones would leave only a faint.
    expect(payablePokemonCount(vault)).toBe(2);
    expect(checkPayment(vault, [], 'secure-locker-1', ['fit-1', 'fit-2'])).toMatchObject({
      ok: false,
      refusal: 'no-pokemon-left-fit',
    });
    expect(checkPayment(vault, [], 'secure-locker-1', ['fit-1', 'down'])).toMatchObject({ ok: true });
  });

  it('only ever takes supplies above the kit base restocks after a wipe', () => {
    // Otherwise a wipe would refund the payment and a base could be built for nothing.
    const floor = minimumSupplies(contractRestockBonus(RAID_CONTRACTS.map(({ id }) => id)));
    const vault: OutfitterVault = {
      ...vaultWith([new Pokemon(PIDGEY, 4), new Pokemon(PIDGEY, 5)], { ...floor }),
      protectedSupplies: floor,
    };
    expect(spendableSupply(vault, 'poke-ball')).toBe(0);
    expect(checkPayment(vault, [], 'secure-locker-1', ['catch-1', 'catch-2'])).toMatchObject({
      ok: false,
      refusal: 'supplies-short',
    });
    const offer = outfitterOffers(vault, []).find(({ upgrade }) => upgrade.id === 'secure-locker-1')!;
    expect(offer.pokemonShort).toBe(0);
    expect(offer.suppliesShort).toEqual([
      { itemId: 'poke-ball', quantity: 2 },
      { itemId: 'potion', quantity: 1 },
    ]);
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
    expect(vault.stash.itemCount('poke-ball')).toBe(7);
    expect(vault.stash.itemCount('potion')).toBe(6);
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

    const states = outfitterOffers(vault, ['secure-locker-1']).map(({ upgrade, state }) => [upgrade.id, state]);
    expect(states).toContainEqual(['secure-locker-1', 'built']);
    expect(states).toContainEqual(['secure-locker-2', 'open']);
    expect(states).toContainEqual(['recovery-bay-2', 'locked']);
  });
});
