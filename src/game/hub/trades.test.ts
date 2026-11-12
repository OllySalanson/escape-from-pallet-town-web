import { describe, expect, it } from 'vitest';
import { Bag } from '../items';
import { Pokemon, PokemonParty } from '../pokemon';
import { getSpeciesById } from '../pokemon/species';
import { SaveManager, type StorageLike } from '../save/SaveManager';
import { Stash } from '../stash/Stash';
import {
  clampTradesMade,
  IN_GAME_TRADES,
  tradeDealFor,
  tradedPokemon,
  tradeEvolution,
  traderLines,
  tradeRefusal,
} from './trades';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
  public removeItem(key: string): void {
    this.values.delete(key);
  }
}

const of = (id: string, level: number): Pokemon => new Pokemon(getSpeciesById(id)!, level);

/** A save on disk holding these Pokémon, the first of them the partner. */
function saveHolding(...pokemon: Pokemon[]): { saves: SaveManager; storage: MemoryStorage; ids: string[] } {
  const storage = new MemoryStorage();
  const stash = new Stash();
  const ids = pokemon.map((each) => stash.addPokemon(each));
  stash.adoptPartner(ids[0]);
  const saves = new SaveManager(storage);
  saves.save({ party: new PokemonParty(), mapId: 'greystone-vale', position: { x: 0, y: 0 }, bag: new Bag(), stash });
  return { saves, storage, ids };
}

describe('the TRADER', () => {
  it('makes FireRed’s own nine trades, each for a kind the game has and with FireRed’s nickname', () => {
    expect(IN_GAME_TRADES.map((trade) => `${trade.wants}>${trade.gives}`)).toEqual([
      'abra>mr-mime',
      'poliwhirl>jynx',
      'nidoran-m>nidoran-f',
      'spearow>farfetchd',
      'nidorino>nidorina',
      'golduck>lickitung',
      'raichu>electrode',
      'venonat>tangela',
      'ponyta>seel',
    ]);
    for (const trade of IN_GAME_TRADES) {
      expect(getSpeciesById(trade.wants), trade.wants).toBeDefined();
      expect(tradedPokemon(trade, 12).name).toBe(trade.nickname);
    }
  });

  it('hands back his Pokémon at the level of the one that went, as FireRed does', () => {
    const mimien = tradedPokemon(IN_GAME_TRADES[0], 9);
    expect(mimien.base.id).toBe('mr-mime');
    expect(mimien.level).toBe(9);
  });

  it('evolves the four that trading evolves, traded and back, as often as asked', () => {
    expect(['kadabra', 'machoke', 'graveler', 'haunter'].map((id) => tradeEvolution(id)?.id)).toEqual([
      'alakazam',
      'machamp',
      'golem',
      'gengar',
    ]);
    expect(tradeEvolution('pidgey')).toBeUndefined();
    expect(tradeDealFor('haunter', [])).toMatchObject({ kind: 'and-back', into: { id: 'gengar' } });
    expect(tradeDealFor('abra', [])).toMatchObject({ kind: 'swap', trade: { id: 'mimien' } });
    // Each trade of his is made once; a trade and back, any time.
    expect(tradeDealFor('abra', ['mimien'])).toBeUndefined();
    expect(tradeDealFor('haunter', ['mimien', 'marc'])?.kind).toBe('and-back');
  });

  it('says why he will not take one: no trade for it, made already, out on a raid, or the partner he would keep', () => {
    const { saves, ids } = saveHolding(of('abra', 9), of('pidgey', 5), of('golduck', 30), of('kadabra', 20));
    const stash = saves.load()!.stash;
    const none = new Set<string>();
    expect(tradeRefusal(stash, ids[1], none, [])).toBe('He has no trade for a PIDGEY.');
    expect(tradeRefusal(stash, ids[2], none, ['marc'])).toBe('He has had his GOLDUCK from you.');
    expect(tradeRefusal(stash, ids[2], new Set([ids[2]]), [])).toContain('out on a raid');
    expect(tradeRefusal(stash, ids[0], none, [])).toBe('ABRA is your partner, and stays with you.');
    expect(tradeRefusal(stash, ids[2], none, [])).toBeUndefined();
    expect(tradeRefusal(stash, ids[3], none, [])).toBeUndefined();
  });

  it('names what he is still after, and the trade and back', () => {
    expect(traderLines([])[0]).toContain('ABRA, POLIWHIRL');
    expect(traderLines(IN_GAME_TRADES.map((trade) => trade.id))[0]).toContain('every trade');
    expect(traderLines([]).join(' ')).toContain('KADABRA, MACHOKE, GRAVELER or HAUNTER');
  });

  it('keeps only trades it knows, once each', () => {
    expect(clampTradesMade(['marc', 'marc', 'nope', 3])).toEqual(['marc']);
    expect(clampTradesMade('marc')).toEqual([]);
  });
});

describe('a trade, written', () => {
  it('swaps the Pokémon for his in one write, puts its gear back in the vault and never makes it twice', () => {
    const golduck = of('golduck', 30);
    golduck.giveHeldItem('leftovers');
    const { saves, storage, ids } = saveHolding(of('pidgey', 5), golduck, of('golduck', 31));

    expect(saves.makeTrade(ids[1])?.lines).toEqual(['GOLDUCK went to the TRADER. MARC came back!', 'Hey, thanks! It went into your boxes.']);
    const after = new SaveManager(storage).load()!;
    const kinds = after.stash.listPokemon().map((stored) => stored.pokemon.base.id);
    expect(kinds).toEqual(['pidgey', 'golduck', 'lickitung']);
    const marc = after.stash.listPokemon().find((stored) => stored.pokemon.base.id === 'lickitung')!.pokemon;
    expect([marc.name, marc.level]).toEqual(['MARC', 30]);
    expect(after.stash.itemCount('leftovers')).toBe(1);
    expect(after.raidProgress.tradesMade).toEqual(['marc']);
    // The other Golduck is nothing to him now.
    expect(saves.makeTrade(ids[2])).toBeUndefined();
  });

  it('evolves a trade and back where it stands, keeping its gear and its place', () => {
    const haunter = of('haunter', 25);
    haunter.giveHeldItem('leftovers');
    const { saves, storage, ids } = saveHolding(haunter);

    expect(saves.makeTrade(ids[0])?.lines.at(-1)).toBe('Congratulations! Your HAUNTER evolved into GENGAR!');
    const after = new SaveManager(storage).load()!;
    const gengar = after.stash.listPokemon().find((stored) => stored.id === ids[0])!.pokemon;
    expect(gengar.base.id).toBe('gengar');
    expect(gengar.heldItemId).toBe('leftovers');
    // The partner comes back, so a trade and back is no reason to refuse one.
    expect(after.stash.partnerId()).toBe(ids[0]);
    expect(after.raidProgress.pokedexOwned).toContain(getSpeciesById('gengar')!.dexId);
  });
});
