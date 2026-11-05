import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  POKEMON_JUMP_ARCS,
  POKEMON_JUMP_BONUSES,
  POKEMON_JUMP_MAX_SCORE,
  POKEMON_JUMP_MONS,
  POKEMON_JUMP_PEAK,
  POKEMON_JUMP_PRIZES,
  POKEMON_JUMP_VINE_DELAYS,
  POKEMON_JUMP_VINE_SPEEDS,
} from './generated/pokemonJump';
import {
  advancePokemonJump,
  berriesForScore,
  canJump,
  FRAME_MS,
  jumpFrames,
  JUMP_CROUCH_FRAMES,
  MAX_JUMPERS,
  startPokemonJump,
  stepFrame,
  VINE_UPSWING_LOWER,
  type PokemonJumpGame,
} from './pokemonJump';
import { modelJumpGame } from './jumpModel';
import { STARTER_SPECIES } from '../stash';
import { getSpeciesById } from '../pokemon/species';

/** The snapshot `scripts/fetch-frlg-minigames.mjs` read out of pret. */
const SNAPSHOT = JSON.parse(readFileSync(new URL('../../../tools/minigames/frlg-pokemon-jump.json', import.meta.url), 'utf8')) as {
  jumpPeak: number;
  maxScore: number;
  mons: { species: string; type: string }[];
  arcs: Record<string, number[]>;
  vineBaseSpeeds: number[];
  vineSpeedDelays: number[];
  scoreBonuses: number[];
  prizes: { score: number; quantity: number }[];
};

describe("FireRed's POKéMON JUMP, as read out of pret", () => {
  it('is the generated table, number for number', () => {
    expect(POKEMON_JUMP_PEAK).toBe(SNAPSHOT.jumpPeak);
    expect(POKEMON_JUMP_MAX_SCORE).toBe(SNAPSHOT.maxScore);
    expect(Object.entries(POKEMON_JUMP_MONS).map(([species, type]) => ({ species, type }))).toEqual(SNAPSHOT.mons);
    expect(POKEMON_JUMP_ARCS).toEqual(SNAPSHOT.arcs);
    expect([...POKEMON_JUMP_VINE_SPEEDS]).toEqual(SNAPSHOT.vineBaseSpeeds);
    expect([...POKEMON_JUMP_VINE_DELAYS]).toEqual(SNAPSHOT.vineSpeedDelays);
    expect([...POKEMON_JUMP_BONUSES]).toEqual(SNAPSHOT.scoreBonuses);
    expect(POKEMON_JUMP_PRIZES.map((line) => ({ ...line }))).toEqual(SNAPSHOT.prizes);
  });

  it("lets FireRed's 32 Kanto jumpers play - every one a kind this game has - and nobody else", () => {
    expect(Object.keys(POKEMON_JUMP_MONS)).toHaveLength(32);
    for (const species of Object.keys(POKEMON_JUMP_MONS)) {
      expect([species, getSpeciesById(species) !== undefined]).toEqual([species, true]);
    }
    for (const starter of STARTER_SPECIES) expect(canJump(starter.id)).toBe(true);
    for (const heavy of ['charizard', 'venusaur', 'blastoise', 'gyarados']) expect(canJump(heavy)).toBe(false);
  });

  it("hangs each kind in the air FireRed's time: 28, 33 and 38 frames", () => {
    expect(POKEMON_JUMP_ARCS.fast).toHaveLength(28);
    expect(POKEMON_JUMP_ARCS.normal).toHaveLength(33);
    expect(POKEMON_JUMP_ARCS.slow).toHaveLength(38);
    expect(jumpFrames('fast')).toBe(28 + JUMP_CROUCH_FRAMES);
  });
});

/** Frames until the vine is next under the jumpers' feet. */
function framesToHit(game: PokemonJumpGame): number {
  let probe = game;
  for (let frame = 1; frame < 400; frame += 1) {
    probe = stepFrame(probe, false);
    if (probe.vineState === VINE_UPSWING_LOWER) return frame;
  }
  throw new Error('the vine never came round');
}

describe('a game of POKéMON JUMP', () => {
  it('takes three jumpers at most, and only those that can jump', () => {
    const game = startPokemonJump(['rattata', 'charizard', 'mankey', 'growlithe', 'krabby'], 1);
    expect(game.jumpers.map((jumper) => jumper.species)).toEqual(['rattata', 'mankey', 'growlithe']);
    expect(game.jumpers).toHaveLength(MAX_JUMPERS);
    expect(startPokemonJump(['charizard'], 1).over).toBe(true);
  });

  it('ends when the vine passes under somebody standing on the ground', () => {
    let game = startPokemonJump(['rattata'], 7);
    while (!game.over) game = stepFrame(game, false);
    expect(game.jumpers[0].hit).toBe(true);
    expect(game.score).toBe(0);
  });

  it('clears the vine, ten points a swing, with a jump in time', () => {
    let game = startPokemonJump(['rattata'], 7);
    for (let swing = 0; swing < 3; swing += 1) {
      const wait = framesToHit(game) - 8;
      for (let frame = 0; frame < wait; frame += 1) game = stepFrame(game, false);
      game = stepFrame(game, true);
      for (let frame = 0; frame < 30; frame += 1) game = stepFrame(game, false);
      expect(game.over).toBe(false);
    }
    expect(game.score).toBe(30);
  });

  it('cannot jump a Pokémon that is still in the air: a key pressed mid-jump lifts nobody', () => {
    let game = startPokemonJump(['bulbasaur'], 3);
    game = stepFrame(game, true);
    const start = game.jumpers[0].jumpStart;
    game = stepFrame(stepFrame(game, false), true);
    expect(game.jumpers[0].jumpStart).toBe(start);
  });

  it('plays the same at ten frames a second as at sixty, and keeps a key pressed between frames', () => {
    let fast = startPokemonJump(['rattata', 'mankey'], 11);
    let slow = fast;
    for (let tick = 0; tick < 120; tick += 1) {
      const press = tick % 9 === 0;
      for (let frame = 0; frame < 6; frame += 1) fast = advancePokemonJump(fast, FRAME_MS, press && frame === 0);
      slow = advancePokemonJump(slow, FRAME_MS * 6, press);
    }
    expect({ frame: slow.frame, score: slow.score, over: slow.over }).toEqual({ frame: fast.frame, score: fast.score, over: fast.over });
  });

  it('pays FireRed berries by score', () => {
    expect(berriesForScore(4999)).toBe(0);
    expect(berriesForScore(5000)).toBe(1);
    expect(berriesForScore(20000)).toBe(5);
  });
});

/**
 * The arenas plan's rule for every mini-game: the team decides what a player
 * is good at, skill still counts, and no kind is best at everything. Played by
 * the model player (`jumpModel.ts`, `tools/minigames/measure.mts`).
 */
describe('who is good at POKéMON JUMP', () => {
  const median = (team: readonly string[], jitter: number): number => {
    const scores = Array.from({ length: 9 }, (_, seed) => modelJumpGame(team, seed + 1, jitter).score).sort((a, b) => a - b);
    return scores[4];
  };

  it('rewards a team of FAST jumpers over a team of SLOW ones', () => {
    expect(median(['rattata', 'mankey', 'growlithe'], 3)).toBeGreaterThan(2 * median(['bulbasaur', 'psyduck', 'poliwag'], 3));
  });

  it('jumps a Rattata better than a Bulbasaur', () => {
    expect(median(['rattata'], 3)).toBeGreaterThan(median(['bulbasaur'], 3));
  });

  it('still rewards skill: a steady hand beats a shaky one with the same team', () => {
    expect(median(['rattata', 'mankey', 'growlithe'], 1)).toBeGreaterThan(median(['rattata', 'mankey', 'growlithe'], 8));
  });
});
