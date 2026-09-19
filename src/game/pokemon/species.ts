import { PokemonBase } from './PokemonBase';
import { PokemonType } from './PokemonType';
import {
  BUBBLE,
  EMBER,
  FEATHER_DANCE,
  FLAMETHROWER,
  GROWL,
  GUST,
  HEAT_WAVE,
  HYDRO_PUMP,
  POISON_POWDER,
  RAZOR_LEAF,
  SCARY_FACE,
  SCRATCH,
  SING,
  SLASH,
  SLEEP_POWDER,
  SUPER_SONIC,
  TACKLE,
  TAIL_WHIP,
  THUNDER_SHOCK,
  THUNDER_WAVE,
  THUNDERBOLT,
  VINE_WHIP,
  WATER_GUN,
  WING_ATTACK,
} from './moves';

export const BULBASAUR = new PokemonBase({
  id: 'bulbasaur',
  dexId: 1,
  name: 'Bulbasaur',
  primaryType: PokemonType.Grass,
  secondaryType: PokemonType.Poison,
  baseStats: {
    hp: 45,
    attack: 49,
    defense: 49,
    spAttack: 65,
    spDefense: 65,
    speed: 45,
  },
  learnset: [
    { level: 1, move: TACKLE },
    { level: 1, move: SUPER_SONIC },
    { level: 4, move: GROWL },
    { level: 7, move: VINE_WHIP },
  ],
  frontSprite: 'sprites/pokemon/bulbasaur_front.png',
  backSprite: 'sprites/pokemon/bulbasaur_back.png',
});

export const CHARMANDER = new PokemonBase({
  id: 'charmander',
  dexId: 4,
  name: 'Charmander',
  primaryType: PokemonType.Fire,
  baseStats: {
    hp: 39,
    attack: 52,
    defense: 43,
    spAttack: 60,
    spDefense: 50,
    speed: 65,
  },
  learnset: [
    { level: 1, move: SCRATCH },
    { level: 4, move: GROWL },
    { level: 7, move: EMBER },
  ],
  frontSprite: 'sprites/pokemon/charmander_front.png',
  backSprite: 'sprites/pokemon/charmander_back.png',
});

export const SQUIRTLE = new PokemonBase({
  id: 'squirtle',
  dexId: 7,
  name: 'Squirtle',
  primaryType: PokemonType.Water,
  baseStats: {
    hp: 44,
    attack: 48,
    defense: 65,
    spAttack: 50,
    spDefense: 64,
    speed: 43,
  },
  // Bulbasaur has carried Super Sonic since Unity, so it alone had a level-5
  // line other than "attack". Tail Whip gives the bulkiest starter its own, and
  // one that suits it: it pays for itself in a long fight and loses tempo in a
  // short one.
  learnset: [
    { level: 1, move: TACKLE },
    { level: 1, move: TAIL_WHIP },
    { level: 4, move: GROWL },
    { level: 7, move: WATER_GUN },
  ],
  frontSprite: 'sprites/pokemon/squirtle_front.png',
  backSprite: 'sprites/pokemon/squirtle_back.png',
});

export const BUTTERFREE = new PokemonBase({
  id: 'butterfree',
  dexId: 12,
  name: 'Butterfree',
  primaryType: PokemonType.Bug,
  secondaryType: PokemonType.Flying,
  baseStats: {
    hp: 60,
    attack: 45,
    defense: 50,
    spAttack: 90,
    spDefense: 80,
    speed: 70,
  },
  learnset: [
    { level: 1, move: TACKLE },
    { level: 10, move: POISON_POWDER },
  ],
  frontSprite: 'sprites/pokemon/butterfree_front.png',
  backSprite: 'sprites/pokemon/butterfree_back.png',
});

export const PIKACHU = new PokemonBase({
  id: 'pikachu',
  dexId: 25,
  name: 'Pikachu',
  primaryType: PokemonType.Electric,
  baseStats: {
    hp: 35,
    attack: 55,
    defense: 40,
    spAttack: 50,
    spDefense: 50,
    speed: 90,
  },
  learnset: [
    { level: 1, move: TACKLE },
    { level: 1, move: GROWL },
    { level: 10, move: THUNDER_WAVE },
  ],
  frontSprite: 'sprites/pokemon/pikachu_front.png',
  backSprite: 'sprites/pokemon/pikachu_back.png',
});

export const JIGGLYPUFF = new PokemonBase({
  id: 'jigglypuff',
  dexId: 39,
  name: 'Jigglypuff',
  primaryType: PokemonType.Normal,
  baseStats: {
    hp: 115,
    attack: 45,
    defense: 20,
    spAttack: 45,
    spDefense: 20,
    speed: 20,
  },
  learnset: [
    { level: 1, move: TACKLE },
    { level: 1, move: GROWL },
    { level: 10, move: SING },
  ],
  frontSprite: 'sprites/pokemon/jigglypuff_front.png',
  backSprite: 'sprites/pokemon/jigglypuff_back.png',
});

export const PIDGEY = new PokemonBase({
  id: 'pidgey',
  dexId: 16,
  name: 'Pidgey',
  primaryType: PokemonType.Normal,
  secondaryType: PokemonType.Flying,
  baseStats: {
    hp: 40,
    attack: 45,
    defense: 40,
    spAttack: 35,
    spDefense: 35,
    speed: 56,
  },
  learnset: [{ level: 1, move: TACKLE }],
  frontSprite: 'sprites/pokemon/pidgey_front.png',
  backSprite: 'sprites/pokemon/pidgey_back.png',
});


// ---------------------------------------------------------------------------
// The evolved forms
//
// **Generation III - FireRed/LeafGreen - for every number below.** That is the
// generation this game is: its damage formula, its flat 6.25% critical rate,
// its separate Sp. Atk and Sp. Def, its catch formula and its art are all Gen
// III, inherited through the tutorial the captain's Unity project was built
// from. So where a modern dex and Gen III disagree, Gen III wins here, and the
// three places they do are marked in line: Pidgeot's Speed, Raichu's Speed and
// Wigglytuff's Sp. Atk were all raised in generation VI.
//
// The seven species above are Unity's own, ported verbatim, and three of them
// are on modern numbers instead - Butterfree's Sp. Atk and Pikachu's Defence
// and Sp. Def - with Jigglypuff's Sp. Def on no generation's. They are left
// exactly as they are: changing a shipped species' stats is an early-balance
// change, and AGENTS.md is clear that those are measured rather than ported.
// The PR raising this file lists all four for the captain.
//
// Unity could not have supplied any of the species below in any case:
// `Assets/Scripts/Pokemons/PokemonBase.cs` in `OllySalanson/escapeFromPalletTown`
// has no evolution field at all, and its six `Pokemons/*.asset` files carry
// none of them.
//
// Learnsets are the FireRed/LeafGreen level-up learnset, at its own levels,
// restricted to the moves this engine can represent without inventing anything
// - see `moves.ts` for that rule and `evolution.ts` for which moves it leaves
// out and why. A pre-evolution's own moves are not repeated here: they come
// home with the Pokemon, and `evolutionFamily()` is what lets a save restore
// them onto the evolved form.
// ---------------------------------------------------------------------------

export const IVYSAUR = new PokemonBase({
  id: 'ivysaur',
  dexId: 2,
  name: 'Ivysaur',
  primaryType: PokemonType.Grass,
  secondaryType: PokemonType.Poison,
  baseStats: {
    hp: 60,
    attack: 62,
    defense: 63,
    spAttack: 80,
    spDefense: 80,
    speed: 60,
  },
  learnset: [
    { level: 1, move: TACKLE },
    { level: 1, move: GROWL },
    { level: 10, move: VINE_WHIP },
    { level: 15, move: POISON_POWDER },
    { level: 15, move: SLEEP_POWDER },
    { level: 22, move: RAZOR_LEAF },
  ],
  frontSprite: 'sprites/pokemon/ivysaur_front.png',
  backSprite: 'sprites/pokemon/ivysaur_back.png',
});

export const VENUSAUR = new PokemonBase({
  id: 'venusaur',
  dexId: 3,
  name: 'Venusaur',
  primaryType: PokemonType.Grass,
  secondaryType: PokemonType.Poison,
  baseStats: {
    hp: 80,
    attack: 82,
    defense: 83,
    spAttack: 100,
    spDefense: 100,
    speed: 80,
  },
  learnset: [
    { level: 1, move: TACKLE },
    { level: 1, move: GROWL },
    { level: 1, move: VINE_WHIP },
    { level: 15, move: POISON_POWDER },
    { level: 15, move: SLEEP_POWDER },
    { level: 22, move: RAZOR_LEAF },
  ],
  frontSprite: 'sprites/pokemon/venusaur_front.png',
  backSprite: 'sprites/pokemon/venusaur_back.png',
});

export const CHARMELEON = new PokemonBase({
  id: 'charmeleon',
  dexId: 5,
  name: 'Charmeleon',
  primaryType: PokemonType.Fire,
  baseStats: {
    hp: 58,
    attack: 64,
    defense: 58,
    spAttack: 80,
    spDefense: 65,
    speed: 80,
  },
  learnset: [
    { level: 1, move: SCRATCH },
    { level: 1, move: GROWL },
    { level: 1, move: EMBER },
    { level: 27, move: SCARY_FACE },
    { level: 34, move: FLAMETHROWER },
    { level: 41, move: SLASH },
  ],
  frontSprite: 'sprites/pokemon/charmeleon_front.png',
  backSprite: 'sprites/pokemon/charmeleon_back.png',
});

export const CHARIZARD = new PokemonBase({
  id: 'charizard',
  dexId: 6,
  name: 'Charizard',
  primaryType: PokemonType.Fire,
  secondaryType: PokemonType.Flying,
  baseStats: {
    hp: 78,
    attack: 84,
    defense: 78,
    spAttack: 109,
    spDefense: 85,
    speed: 100,
  },
  learnset: [
    { level: 1, move: SCRATCH },
    { level: 1, move: GROWL },
    { level: 1, move: EMBER },
    { level: 1, move: HEAT_WAVE },
    { level: 27, move: SCARY_FACE },
    { level: 34, move: FLAMETHROWER },
    { level: 36, move: WING_ATTACK },
    { level: 44, move: SLASH },
  ],
  frontSprite: 'sprites/pokemon/charizard_front.png',
  backSprite: 'sprites/pokemon/charizard_back.png',
});

export const WARTORTLE = new PokemonBase({
  id: 'wartortle',
  dexId: 8,
  name: 'Wartortle',
  primaryType: PokemonType.Water,
  baseStats: {
    hp: 59,
    attack: 63,
    defense: 80,
    spAttack: 65,
    spDefense: 80,
    speed: 58,
  },
  learnset: [
    { level: 1, move: TACKLE },
    { level: 1, move: TAIL_WHIP },
    { level: 1, move: BUBBLE },
    { level: 13, move: WATER_GUN },
    { level: 53, move: HYDRO_PUMP },
  ],
  frontSprite: 'sprites/pokemon/wartortle_front.png',
  backSprite: 'sprites/pokemon/wartortle_back.png',
});

export const BLASTOISE = new PokemonBase({
  id: 'blastoise',
  dexId: 9,
  name: 'Blastoise',
  primaryType: PokemonType.Water,
  baseStats: {
    hp: 79,
    attack: 83,
    defense: 100,
    spAttack: 85,
    spDefense: 105,
    speed: 78,
  },
  learnset: [
    { level: 1, move: TACKLE },
    { level: 1, move: TAIL_WHIP },
    { level: 1, move: BUBBLE },
    { level: 13, move: WATER_GUN },
    { level: 68, move: HYDRO_PUMP },
  ],
  frontSprite: 'sprites/pokemon/blastoise_front.png',
  backSprite: 'sprites/pokemon/blastoise_back.png',
});

export const PIDGEOTTO = new PokemonBase({
  id: 'pidgeotto',
  dexId: 17,
  name: 'Pidgeotto',
  primaryType: PokemonType.Normal,
  secondaryType: PokemonType.Flying,
  baseStats: {
    hp: 63,
    attack: 60,
    defense: 55,
    spAttack: 50,
    spDefense: 50,
    speed: 71,
  },
  learnset: [
    { level: 1, move: TACKLE },
    { level: 1, move: GUST },
    { level: 27, move: WING_ATTACK },
    { level: 34, move: FEATHER_DANCE },
  ],
  frontSprite: 'sprites/pokemon/pidgeotto_front.png',
  backSprite: 'sprites/pokemon/pidgeotto_back.png',
});

export const PIDGEOT = new PokemonBase({
  id: 'pidgeot',
  dexId: 18,
  name: 'Pidgeot',
  primaryType: PokemonType.Normal,
  secondaryType: PokemonType.Flying,
  baseStats: {
    hp: 83,
    attack: 80,
    defense: 75,
    spAttack: 70,
    spDefense: 70,
    // 91, not the 101 a modern dex gives: generation VI raised it.
    speed: 91,
  },
  learnset: [
    { level: 1, move: TACKLE },
    { level: 1, move: GUST },
    { level: 27, move: WING_ATTACK },
    { level: 34, move: FEATHER_DANCE },
  ],
  frontSprite: 'sprites/pokemon/pidgeot_front.png',
  backSprite: 'sprites/pokemon/pidgeot_back.png',
});

export const RAICHU = new PokemonBase({
  id: 'raichu',
  dexId: 26,
  name: 'Raichu',
  primaryType: PokemonType.Electric,
  baseStats: {
    hp: 60,
    attack: 90,
    defense: 55,
    spAttack: 90,
    spDefense: 80,
    // 100, not the 110 a modern dex gives: generation VI raised it.
    speed: 100,
  },
  // Raichu learns nothing at all by levelling in FireRed/LeafGreen: everything
  // it knows, it knows on the turn the stone is used. That is what makes the
  // stone a decision rather than a formality - a Pikachu kept unevolved keeps
  // learning, and this does not.
  learnset: [
    { level: 1, move: TAIL_WHIP },
    { level: 1, move: THUNDER_SHOCK },
    { level: 1, move: THUNDERBOLT },
  ],
  frontSprite: 'sprites/pokemon/raichu_front.png',
  backSprite: 'sprites/pokemon/raichu_back.png',
});

export const WIGGLYTUFF = new PokemonBase({
  id: 'wigglytuff',
  dexId: 40,
  name: 'Wigglytuff',
  primaryType: PokemonType.Normal,
  // Fairy is a generation VI type and this game has fifteen types, so
  // Wigglytuff is Normal here exactly as Jigglypuff already is - which is also
  // what both of them were in FireRed/LeafGreen.
  baseStats: {
    hp: 140,
    attack: 70,
    defense: 45,
    // 75, not the 85 a modern dex gives: generation VI raised it.
    spAttack: 75,
    // Jigglypuff ships with 20 here. Canon is 25, in every generation, so that
    // is Unity data entry rather than a design choice - left alone above
    // because changing a shipped species' stats is a balance change, and not
    // copied down here because the way to be consistent with a slip is not to
    // repeat it.
    spDefense: 50,
    speed: 45,
  },
  // Like Raichu, Wigglytuff learns nothing by levelling in FireRed/LeafGreen,
  // and of the four moves it knows on evolving only Sing is representable here:
  // Defense Curl raises the user's own stat and every boost in this engine is
  // applied to the target, Disable has no machinery, and Double Slap hits two
  // to five times.
  learnset: [{ level: 1, move: SING }],
  frontSprite: 'sprites/pokemon/wigglytuff_front.png',
  backSprite: 'sprites/pokemon/wigglytuff_back.png',
});

export const SPECIES_BY_ID: Readonly<Record<string, PokemonBase>> = {
  [BLASTOISE.id]: BLASTOISE,
  [BULBASAUR.id]: BULBASAUR,
  [BUTTERFREE.id]: BUTTERFREE,
  [CHARIZARD.id]: CHARIZARD,
  [CHARMANDER.id]: CHARMANDER,
  [CHARMELEON.id]: CHARMELEON,
  [IVYSAUR.id]: IVYSAUR,
  [JIGGLYPUFF.id]: JIGGLYPUFF,
  [PIDGEOT.id]: PIDGEOT,
  [PIDGEOTTO.id]: PIDGEOTTO,
  [PIDGEY.id]: PIDGEY,
  [PIKACHU.id]: PIKACHU,
  [RAICHU.id]: RAICHU,
  [SQUIRTLE.id]: SQUIRTLE,
  [VENUSAUR.id]: VENUSAUR,
  [WARTORTLE.id]: WARTORTLE,
  [WIGGLYTUFF.id]: WIGGLYTUFF,
};

export const getSpeciesById = (speciesId: string): PokemonBase | undefined =>
  SPECIES_BY_ID[speciesId];
