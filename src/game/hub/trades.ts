import { Pokemon } from '../pokemon/Pokemon';
import type { PokemonBase } from '../pokemon/PokemonBase';
import { EVOLUTIONS } from '../pokemon/evolution';
import { getSpeciesById } from '../pokemon/species';
import { outOnRaidLine } from '../run/raidInFlight';
import type { Stash } from '../stash/Stash';

/**
 * THE TRADER on the lawn by the Pokémon Center: FireRed's in-game trades, and a
 * trade and back. Phaser-free, and the whole rule.
 *
 * **The trades are FireRed's own nine** (pret/pokefirered,
 * `src/data/ingame_trades.h`, FireRed's side of each): the kind asked for, the
 * kind given and the nickname it comes with, each made once a save, as each
 * of FireRed's is made once. What comes back is at the level of what went, as
 * FireRed's `CreateInGameTradePokemon` makes it. Two of them are the only way
 * a save comes to own their kind - MIMIEN the Mr. Mime, for an Abra, and MARC
 * the Lickitung, for a Golduck (the endgame bug hunt, 12 Nov 2026: neither
 * could be had anywhere).
 *
 * **A trade and back** is what FireRed's four trade evolutions were made for:
 * a Kadabra, Machoke, Graveler or Haunter sent across and sent straight back
 * evolves on the way, as it does in the Cable Club. Nobody here has a second
 * cartridge but the trader, so it is his to offer, as often as asked; it was
 * the only way to an Alakazam or a Gengar.
 *
 * The save keeps only the ids of the trades made (`RaidProgress.tradesMade`);
 * everything else is derived.
 */

export interface InGameTrade {
  readonly id: string;
  /** The kind he asks for. */
  readonly wants: string;
  /** The kind he gives for it, under its FireRed nickname. */
  readonly gives: string;
  readonly nickname: string;
  /** Where FireRed makes the trade, which is what he says he had it from. */
  readonly fireRedPlace: string;
}

export const IN_GAME_TRADES: readonly InGameTrade[] = [
  { id: 'mimien', wants: 'abra', gives: 'mr-mime', nickname: 'MIMIEN', fireRedPlace: 'ROUTE 2' },
  { id: 'zynx', wants: 'poliwhirl', gives: 'jynx', nickname: 'ZYNX', fireRedPlace: 'CERULEAN CITY' },
  { id: 'ms-nido', wants: 'nidoran-m', gives: 'nidoran-f', nickname: 'MS. NIDO', fireRedPlace: 'ROUTE 5' },
  { id: 'chding', wants: 'spearow', gives: 'farfetchd', nickname: "CH'DING", fireRedPlace: 'VERMILION CITY' },
  { id: 'nina', wants: 'nidorino', gives: 'nidorina', nickname: 'NINA', fireRedPlace: 'ROUTE 11' },
  { id: 'marc', wants: 'golduck', gives: 'lickitung', nickname: 'MARC', fireRedPlace: 'ROUTE 18' },
  { id: 'esphere', wants: 'raichu', gives: 'electrode', nickname: 'ESPHERE', fireRedPlace: 'CINNABAR ISLAND' },
  { id: 'tangeny', wants: 'venonat', gives: 'tangela', nickname: 'TANGENY', fireRedPlace: 'CINNABAR ISLAND' },
  { id: 'seelor', wants: 'ponyta', gives: 'seel', nickname: 'SEELOR', fireRedPlace: 'CINNABAR ISLAND' },
];

export const TRADER_NAME = 'TRADER';

/** The kind a trade and back turns this one into, if trading is what evolves it. */
export function tradeEvolution(speciesId: string): PokemonBase | undefined {
  const rule = EVOLUTIONS.find((candidate) => candidate.from === speciesId && candidate.trigger.kind === 'trade');
  return rule ? getSpeciesById(rule.to) : undefined;
}

/** What the trader would do with one Pokémon: a trade of his, or a trade and back. */
export type TradeDeal =
  | { readonly kind: 'swap'; readonly trade: InGameTrade; readonly gives: PokemonBase }
  | { readonly kind: 'and-back'; readonly into: PokemonBase };

/** His trade for this kind, if he still has one to make. */
export function openTradeFor(speciesId: string, tradesMade: readonly string[]): InGameTrade | undefined {
  return IN_GAME_TRADES.find((trade) => trade.wants === speciesId && !tradesMade.includes(trade.id));
}

/** What the trader would do with a Pokémon of this kind, if anything. */
export function tradeDealFor(speciesId: string, tradesMade: readonly string[]): TradeDeal | undefined {
  const trade = openTradeFor(speciesId, tradesMade);
  const gives = trade ? getSpeciesById(trade.gives) : undefined;
  if (trade && gives) {
    return { kind: 'swap', trade, gives };
  }
  const into = tradeEvolution(speciesId);
  return into ? { kind: 'and-back', into } : undefined;
}

/**
 * Why the trader will not take this Pokémon now, or undefined when he will.
 * `away` is who the raid in flight has out (`awayOnRaid`).
 */
export function tradeRefusal(
  stash: Stash,
  pokemonId: string,
  away: ReadonlySet<string>,
  tradesMade: readonly string[],
): string | undefined {
  const stored = stash.listPokemon().find((entry) => entry.id === pokemonId);
  if (!stored) {
    return 'That Pokémon isn’t at base.';
  }
  if (away.has(pokemonId)) {
    return outOnRaidLine(stored.pokemon.name);
  }
  const deal = tradeDealFor(stored.pokemon.base.id, tradesMade);
  if (!deal) {
    const done = IN_GAME_TRADES.find((trade) => trade.wants === stored.pokemon.base.id);
    return done ? `He has had his ${stored.pokemon.base.name.toUpperCase()} from you.` : `He has no trade for a ${stored.pokemon.base.name.toUpperCase()}.`;
  }
  if (deal.kind === 'swap' && stash.partnerId() === pokemonId) {
    return `${stored.pokemon.name.toUpperCase()} is your partner, and stays with you.`;
  }
  return undefined;
}

/** What he says on the lawn before the list opens: FireRed's trade line for each kind he is after. */
export function traderLines(tradesMade: readonly string[]): readonly string[] {
  const open = IN_GAME_TRADES.filter((trade) => !tradesMade.includes(trade.id));
  const wanted = open.map((trade) => getSpeciesById(trade.wants)?.name.toUpperCase() ?? trade.wants);
  return [
    ...(open.length > 0
      ? [`I'm looking for the POKéMON ${listed(wanted)}! Wanna trade one for one of mine?`]
      : ['I have made every trade I came here to make. Thanks, you are a pal!']),
    'And a KADABRA, MACHOKE, GRAVELER or HAUNTER sent over to my game and straight back evolves on the way. Any time.',
  ];
}

/** Names in a line: "A, B or C". */
function listed(names: readonly string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

/** The Pokémon a trade of his hands back, at the level of the one that went: FireRed's own rule. */
export function tradedPokemon(trade: InGameTrade, level: number): Pokemon {
  const species = getSpeciesById(trade.gives);
  if (!species) {
    throw new Error(`The trader gives a species the game does not have: ${trade.gives}.`);
  }
  const pokemon = new Pokemon(species, level);
  pokemon.giveNickname(trade.nickname);
  return pokemon;
}

/** What is said back in the yard once a trade is made: FireRed's own lines. */
export function tradeMadeLines(given: string, deal: TradeDeal, received: string): readonly string[] {
  if (deal.kind === 'swap') {
    return [`${given} went to the TRADER. ${received} came back!`, 'Hey, thanks! It went into your boxes.'];
  }
  return [`${given} went over to the TRADER's game, and came straight back.`, `Congratulations! Your ${given} evolved into ${received}!`];
}

/** The trades made, as a save keeps them: known ids, once each. */
export function clampTradesMade(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((id): id is string => typeof id === 'string' && IN_GAME_TRADES.some((trade) => trade.id === id)))]
    : [];
}
