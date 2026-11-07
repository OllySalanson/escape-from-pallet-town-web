import { Bag } from '../items';
import { Move, Pokemon } from '../pokemon';

/**
 * THE BATTLE ARENA's rules: a bout for sport, fair by construction (the
 * harbour arenas plan, section 2.3). Phaser-free.
 *
 * **Everybody fights at the same level.** A bout is a puzzle of species, moves,
 * abilities and held items, never of hours played, so every Pokémon that walks
 * onto the mat - the player's and the opponent's - is a fresh copy at
 * `DOJO_LEVEL`: its own species, its own four moves at full PP, its own held
 * item, nickname and colours, and the stats that level gives. A Lv 70 Charizard
 * and a Lv 12 Charmander are each just one of their kind. Raids keep the real
 * levels and the real risk.
 *
 * **Nothing a bout touches is yours.** The copies are new Pokémon built from
 * what the vault holds, never the vault's own, and the fight is the real battle
 * scene on a bout with no run session (`scenes/exhibitionBout.test.ts`), so
 * nothing in it can reach a save. No bag goes in (FireRed's tower rule), so no
 * raid supply is ever spent on one.
 *
 * **The Battle Tower's clauses**: no two of the same kind on a side, no two
 * holding the same item, and Mew and Mewtwo stay home (generation III's ban
 * list; the birds may come). As many a side as the player brings, up to three,
 * so a player with one Pokémon can still have a go - the opponent fields the
 * same number.
 */

/** The level every Pokémon in a bout fights at. */
export const DOJO_LEVEL = 30;

/** The most a side may bring: FireRed's Trainer Tower and Battle Tower are three-Pokémon formats. */
export const DOJO_TEAM_SIZE = 3;

/** Generation III's Battle Tower ban list, within the 151. */
export const DOJO_BANNED_SPECIES: readonly string[] = ['mewtwo', 'mew'];

/**
 * A Pokémon as it fights in the dojo: a new one of its kind at the bout's
 * level, knowing what the original knows, at full health and full PP, holding
 * what it holds and named and coloured as it is. The original is only read.
 */
export function flatLevelCopy(pokemon: Pokemon, level: number = DOJO_LEVEL): Pokemon {
  const copy = new Pokemon(pokemon.base, level);
  if (pokemon.moves.length > 0) {
    copy.moves = pokemon.moves.map((move) => new Move(move.base));
  }
  copy.heldItemId = pokemon.heldItemId;
  copy.nickname = pokemon.nickname;
  copy.shiny = pokemon.shiny;
  return copy;
}

/** Why a Pokémon may not join a side that already holds `team`, or null if it may. */
export function dojoRefusal(pokemon: Pokemon, team: readonly Pokemon[]): string | null {
  if (DOJO_BANNED_SPECIES.includes(pokemon.base.id)) {
    return `${pokemon.base.name.toUpperCase()} is too strong for the dojo: it stays home.`;
  }
  if (team.length >= DOJO_TEAM_SIZE) {
    return `Three a side at most. Leave one out first.`;
  }
  if (team.some((other) => other.base.id === pokemon.base.id)) {
    return `One of each kind: you already have a ${pokemon.base.name.toUpperCase()}.`;
  }
  if (pokemon.heldItemId !== null && team.some((other) => other.heldItemId === pokemon.heldItemId)) {
    return `No two may hold the same item.`;
  }
  return null;
}

/** Whether a whole side keeps the clauses: one to three, no two alike, no shared item, nobody banned. */
export function isDojoTeam(team: readonly Pokemon[]): boolean {
  if (team.length === 0 || team.length > DOJO_TEAM_SIZE) {
    return false;
  }
  return team.every((pokemon, index) => dojoRefusal(pokemon, team.slice(0, index)) === null);
}

/** The side that fights: flat-level copies, in the order chosen. */
export function dojoParty(team: readonly Pokemon[]): Pokemon[] {
  return team.map((pokemon) => flatLevelCopy(pokemon));
}

/** No bag goes onto the mat: an empty one nobody will see again. */
export function dojoBag(): Bag {
  return new Bag({}, null);
}
