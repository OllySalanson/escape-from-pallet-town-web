import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Pokemon } from '../pokemon/Pokemon';
import { getSpeciesById } from '../pokemon/species';
import { createStartingStash, Stash } from '../stash/Stash';
import { headsOf } from './berryPicking';
import { jumpTypeOf } from './pokemonJump';
import { traitsOf } from './traits';
import { berryLineups, courseLineups, jumpLineups, outdoorLineups, type Lineup, type PlayerVault } from './whoPlays';

/**
 * The harbour audit of 27 Nov 2026, fault 3: SPACE at a GAME CORNER cabinet
 * opened a form - a search box, a list of who could not jump, a pay table -
 * and not a game. Now one press at a cabinet, a board, the dig spot or the
 * course gate is playing, with somebody sensible playing, on every save: a
 * brand-new one, Sam's just home from the first raid (a level-5 CHARMANDER,
 * nothing else), and Jo's ten raids in (an IVYSAUR partner, which has evolved
 * off FireRed's jumping list, and a DIGLETT, which never was on it).
 */

const species = (id: string) => {
  const found = getSpeciesById(id);
  if (!found) throw new Error(`no species ${id}`);
  return found;
};

function vault(pokemon: readonly (readonly [string, string, number])[], partner: string): Stash {
  const stash = new Stash();
  for (const [id, kind, level] of pokemon) stash.addPokemon(new Pokemon(species(kind), level), id);
  stash.adoptPartner(partner);
  return stash;
}

const SAM = vault([['charmander-1', 'charmander', 5]], 'charmander-1');
const JO = vault(
  [
    ['bulbasaur-1', 'ivysaur', 17],
    ['diglett-1', 'diglett', 3],
  ],
  'bulbasaur-1',
);

const SAVES: Readonly<Record<string, PlayerVault>> = {
  'a fresh save': createStartingStash(),
  "Sam's save (after the first raid)": SAM,
  "Jo's save (ten raids in)": JO,
};

/** Any kind the 151 holds can play an outdoor game: the scenes' own fits only order them. */
const ANYBODY = (entry: { readonly pokemon: Pokemon }): number | undefined => (traitsOf(entry.pokemon.base.id) ? 1 : undefined);

const GAMES: Readonly<Record<string, (save: PlayerVault) => Lineup[]>> = {
  'POKéMON JUMP': jumpLineups,
  'BERRY PICKING': berryLineups,
  'THE FIELD-MOVE COURSE': courseLineups,
  'THE DERBY, THE DIG and THE FISHING DERBY': (save) => outdoorLineups(save, ANYBODY),
};

const ids = (lineup: Lineup | undefined): string[] => (lineup ?? []).map((player) => player.id);

describe('a harbour minigame is one press from playing, with somebody playing', () => {
  for (const [save, stash] of Object.entries(SAVES)) {
    for (const [game, lineups] of Object.entries(GAMES)) {
      it(`${game}, on ${save}: has a first lineup, and offers nobody who cannot play`, () => {
        const offered = lineups(stash);
        expect(offered.length).toBeGreaterThan(0);
        expect(offered[0]?.length).toBeGreaterThan(0);
        for (const player of offered.flat()) {
          expect(player.name).not.toBe('');
          if (game === 'POKéMON JUMP') expect(jumpTypeOf(player.species)).toBeDefined();
          if (game === 'BERRY PICKING') expect(headsOf(player.species)).toBeDefined();
        }
      });
    }
  }

  it('plays the partner where the partner can play, and the house loan where nobody can', () => {
    const sam = SAM;
    const jo = JO;
    // A CHARMANDER is on FireRed's jumping list; the house PIKACHU is the other choice.
    expect(ids(jumpLineups(sam)[0])).toEqual(['charmander-1']);
    expect(jumpLineups(sam).map(ids)).toEqual([['charmander-1'], ['house:pikachu']]);
    // Neither an IVYSAUR nor a DIGLETT can jump, so the house PIKACHU does, and only it.
    expect(jumpLineups(jo).map(ids)).toEqual([['house:pikachu']]);
    // Nobody of either's own has a beak for BERRY PICKING.
    for (const stash of [sam, jo]) expect(berryLineups(stash).map(ids)).toEqual([['house:doduo']]);
    // The course: the partner leads the keeper's team.
    expect(ids(courseLineups(sam)[0])).toEqual(['charmander-1']);
    expect(ids(courseLineups(jo)[0])[0]).toBe('bulbasaur-1');
    // The outdoor games: the partner, and after it on the list the DIGLETT.
    expect(outdoorLineups(jo, ANYBODY).map(ids)).toEqual([['bulbasaur-1'], ['diglett-1']]);
  });

  it('never lists a Pokémon that cannot play: a DIGLETT is simply not among the jumpers', () => {
    const jo = JO;
    expect(jumpLineups(jo).flat().map((player) => player.species)).not.toContain('diglett');
    expect(jumpLineups(jo).flat().map((player) => player.species)).not.toContain('ivysaur');
  });
});

/**
 * The scenes, read as text: none of them opens on a form. Each game's list of
 * who plays is still there, behind P from its ready beat or its result card:
 * the menu redesign restyled those lists (#1016), and it takes precedence
 * (the captain, 27 Nov 2026), so they are drawn by the very markup it made.
 */
const source = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('nothing stands between the press and the game', () => {
  const SCENES = {
    'POKéMON JUMP': '../scenes/GameCornerScene.ts',
    'BERRY PICKING': '../scenes/BerryPickingScene.ts',
    'THE FIELD-MOVE COURSE': '../scenes/FieldCourseScene.ts',
    'the outdoor games': '../scenes/OutdoorGameScene.ts',
  } as const;

  for (const [game, path] of Object.entries(SCENES)) {
    it(`${game} opens on the game standing ready, its list of who plays only behind P`, () => {
      const text = source(path);
      const create = /public create\(\): void \{([\s\S]*?)\n {2}\}/.exec(text)?.[1] ?? '';
      expect(create).toContain('this.standReady()');
      expect(create).not.toMatch(/openPicker|showJumpList|wirePickerFind|TeamMarkup|PickMarkup/);
      // The list opens from one place: P, in the ready beat or on the result card, when it has another choice.
      expect(text.match(/this\.openPicker\(\)/g)).toHaveLength(1);
      expect(text).toMatch(/action\.kind === 'pick'\) \{\s*if \([^\n]*\) this\.openPicker\(\);/);
      // And it is the menu screens' own list, never one of the game's.
      expect(text).toMatch(/(jumpTeamMarkup|berryTeamMarkup|courseTeamMarkup|outdoorPickMarkup)\(\{/);
    });
  }

  it('draws the promenade games on their own canvas: only the shared list of who plays is a DOM screen', () => {
    for (const path of ['../scenes/DigScene.ts', '../scenes/DerbyScene.ts', '../scenes/FishingDerbyScene.ts']) {
      expect(source(path)).not.toContain('MenuOverlay');
    }
  });

  it('opens every game from the harbour on the press itself, with nothing said first', () => {
    const base = source('../scenes/BaseScene.ts');
    expect(base).toMatch(/opens === 'pokemon-jump'\) \{\s*this\.openGameCorner\('jump'\);/);
    expect(base).toMatch(/opens === 'berry-picking'\) \{\s*this\.openMinigame\('berry-picking'\);/);
    expect(base).toMatch(/OUTDOOR_GAME_LANDMARKS\.includes\(landmark\)\) \{\s*this\.openMinigame\(landmark\.id as OutdoorGameId\);/);
    // The course's gate and its keeper open it at once: he used to read three lines of rules and pay first.
    expect(base).toMatch(/COURSE_GATE_FRONT\.some\(\(tile\) => sameTile\(tile, target\)\)\) \{\s*this\.openMinigame\('field-course'\);/);
    expect(base).not.toMatch(/this\.say\([^;]*\(\) => this\.openMinigame\('field-course'\)\)/);
  });
});
