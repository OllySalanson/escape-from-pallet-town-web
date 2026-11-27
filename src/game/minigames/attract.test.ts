import { describe, expect, it } from 'vitest';
import { Pokemon } from '../pokemon/Pokemon';
import { getSpeciesById } from '../pokemon/species';
import { createStartingStash, Stash } from '../stash';
import {
  attractCommand,
  berryRoster,
  courseRoster,
  jumpRoster,
  jumpTeam,
  openingLineup,
  outdoorRoster,
  payTable,
  pressOnAttract,
  wonLines,
  type AttractGameId,
  type AttractPlayer,
  type AttractVault,
} from './attract';
import { headsOf } from './berryPicking';
import { derbyFit, THE_FRONT } from './derby';
import { digFit } from './dig';
import { biteChance } from './fishingDerby';
import { HOUSE_JUMPER, HOUSE_PICKER } from './houseLoans';
import { jumpTypeOf } from './pokemonJump';
import { traits } from './traits';

/** A vault holding these Pokémon, the first the partner, as a save would load it. */
function vault(...kept: readonly (readonly [id: string, species: string, level: number])[]): Stash {
  const stash = new Stash();
  for (const [id, species, level] of kept) {
    const found = getSpeciesById(species);
    if (!found) throw new Error(`no species ${species}`);
    stash.addPokemon(new Pokemon(found, level), id);
  }
  stash.adoptPartner(kept[0]?.[0] ?? null);
  return stash;
}

/**
 * The three saves the harbour audit of 27 Nov 2026 walked up to the cabinets
 * with: a new game, Sam just home from the first raid (a lone CHARMANDER), and
 * Jo ten raids in, whose BULBASAUR is an IVYSAUR now with a DIGLETT beside it.
 */
const SAVES: Readonly<Record<string, () => AttractVault>> = {
  'a fresh save': () => createStartingStash(),
  "Sam's save": () => vault(['charmander-1', 'charmander', 5]),
  "Jo's save": () => vault(['bulbasaur-1', 'ivysaur', 17], ['diglett-1', 'diglett', 3]),
};

/** Every game a harbour board, spot or cabinet opens, with who it offers. */
const GAMES: Readonly<Record<AttractGameId, (vault: AttractVault) => readonly AttractPlayer[]>> = {
  'pokemon-jump': jumpRoster,
  'berry-picking': berryRoster,
  'field-course': courseRoster,
  derby: (vault) => outdoorRoster(vault, (racer) => derbyFit(THE_FRONT, racer, false, traits('charmander'))),
  dig: (vault) => outdoorRoster(vault, digFit),
  'fishing-derby': (vault) => outdoorRoster(vault, biteChance),
};

/** Whether a kind can play a game at all. */
const canPlay: Readonly<Record<AttractGameId, (species: string) => boolean>> = {
  'pokemon-jump': (species) => jumpTypeOf(species) !== undefined,
  'berry-picking': (species) => headsOf(species) !== undefined,
  'field-course': () => true,
  derby: () => true,
  dig: () => true,
  'fishing-derby': () => true,
};

const SPACE = attractCommand({ key: ' ' });

describe('every harbour game is one press from its screen to play, with somebody playing', () => {
  for (const [save, open] of Object.entries(SAVES)) {
    for (const game of Object.keys(GAMES) as AttractGameId[]) {
      it(`${game}, on ${save}: SPACE plays with the partner, or the house's loan when the partner cannot play`, () => {
        const stash = open();
        const roster = GAMES[game](stash);
        const outcome = pressOnAttract(game, roster, openingLineup(game, roster), SPACE);
        expect(outcome.kind).toBe('play');
        if (outcome.kind !== 'play') return;
        const partner = stash.listPokemon().find((stored) => stored.id === stash.partnerId());
        const expected = partner && canPlay[game](partner.pokemon.base.id) ? partner.id : game === 'pokemon-jump' ? HOUSE_JUMPER.id : HOUSE_PICKER.id;
        expect(outcome.players[0]?.id).toBe(expected);
        expect(outcome.players.every((player) => canPlay[game](player.species))).toBe(true);
      });
    }
  }

  it("plays Jo's IVYSAUR nowhere it cannot play: the house jumps and picks for her", () => {
    const jo = SAVES["Jo's save"]();
    expect(jumpRoster(jo).map((player) => player.id)).toEqual([HOUSE_JUMPER.id]);
    expect(berryRoster(jo).map((player) => player.id)).toEqual([HOUSE_PICKER.id]);
    expect(courseRoster(jo)[0]?.species).toBe('ivysaur');
  });
});

describe('choosing somebody else', () => {
  const kept = vault(['pidgey-1', 'pidgey', 9], ['rattata-1', 'rattata', 4], ['oddish-1', 'oddish', 12], ['dodrio-1', 'dodrio', 33], ['doduo-1', 'doduo', 20]);

  it('never offers a Pokémon that cannot play, and puts the loan last', () => {
    const jumpers = jumpRoster(kept);
    expect(jumpers.map((player) => player.species)).not.toContain('pidgey');
    // The partner cannot jump, so the loan is the default; the player's own come after it, the fast first.
    expect(jumpers.map((player) => player.id)).toEqual([HOUSE_JUMPER.id, 'rattata-1', 'oddish-1']);
    // A partner who can jump is the default, and the loan comes last.
    const ownJumper = vault(['rattata-1', 'rattata', 4], ['pidgey-1', 'pidgey', 9]);
    expect(jumpRoster(ownJumper).map((player) => player.id)).toEqual(['rattata-1', HOUSE_JUMPER.id]);
  });

  it('BERRY PICKING offers its own birds, the most heads first, after the default', () => {
    const birds = berryRoster(kept);
    expect(birds.map((player) => player.id)).toEqual([HOUSE_PICKER.id, 'dodrio-1', 'doduo-1']);
  });

  it('is one press: RIGHT or TAB brings on the next, LEFT or SHIFT+TAB the one before, round and round', () => {
    const roster = jumpRoster(kept);
    let lineup = openingLineup('pokemon-jump', roster);
    const seen = [roster[lineup.lead]?.id];
    for (let press = 0; press < roster.length; press += 1) {
      const outcome = pressOnAttract('pokemon-jump', roster, lineup, attractCommand({ key: press % 2 ? 'Tab' : 'ArrowRight' }));
      expect(outcome.kind).toBe('lineup');
      if (outcome.kind === 'lineup') lineup = outcome.lineup;
      seen.push(roster[lineup.lead]?.id);
    }
    expect(seen.at(-1)).toBe(seen[0]);
    expect(new Set(seen).size).toBe(roster.length);
    const back = pressOnAttract('pokemon-jump', roster, lineup, attractCommand({ key: 'Tab', shiftKey: true }));
    expect(back.kind === 'lineup' && back.lineup.lead).toBe(roster.length - 1);
  });

  it('swaps nothing when nobody else can play', () => {
    const sam = SAVES["Sam's save"]();
    const roster = berryRoster(sam);
    expect(roster).toHaveLength(1);
    expect(pressOnAttract('berry-picking', roster, openingLineup('berry-picking', roster), 'next').kind).toBe('nothing');
  });

  it('jumps a team of one kind by default, and UP and DOWN put one more in or take one out', () => {
    const roster = jumpRoster(kept);
    const rattata = roster.findIndex((player) => player.species === 'rattata');
    const lineup = { lead: rattata, size: 1 };
    expect(jumpTeam(roster, lineup).map((player) => player.species)).toEqual(['rattata']);
    const more = pressOnAttract('pokemon-jump', roster, lineup, attractCommand({ key: 'ArrowUp' }));
    expect(more.kind).toBe('lineup');
    if (more.kind !== 'lineup') return;
    // The next in is the one who jumps most like the lead.
    expect(jumpTeam(roster, more.lineup).map((player) => player.species)).toEqual(['rattata', 'pikachu']);
    expect(pressOnAttract('pokemon-jump', roster, lineup, attractCommand({ key: 'ArrowDown' })).kind).toBe('nothing');
    const most = { lead: rattata, size: 3 };
    expect(pressOnAttract('pokemon-jump', roster, most, 'more').kind).toBe('nothing');
    expect(jumpTeam(roster, most)).toHaveLength(3);
  });
});

describe("an attract screen's keys", () => {
  it('reads SPACE and ENTER as play, the arrows and W A S D in either case, and ESC and BACKSPACE as back', () => {
    expect([' ', 'Enter'].map((key) => attractCommand({ key }))).toEqual(['play', 'play']);
    expect(['ArrowRight', 'd', 'D', 'ArrowLeft', 'a', 'A'].map((key) => attractCommand({ key }))).toEqual(['next', 'next', 'next', 'previous', 'previous', 'previous']);
    expect(['ArrowUp', 'W', 'ArrowDown', 's'].map((key) => attractCommand({ key }))).toEqual(['more', 'more', 'fewer', 'fewer']);
    expect(['Escape', 'Backspace'].map((key) => attractCommand({ key }))).toEqual(['leave', 'leave']);
  });

  it('leaves a key with CTRL, ALT or the system key to the browser', () => {
    expect(attractCommand({ key: 'Tab', ctrlKey: true })).toBeNull();
    expect(attractCommand({ key: ' ', altKey: true })).toBeNull();
    expect(attractCommand({ key: 'd', metaKey: true })).toBeNull();
  });
});

describe('the result card', () => {
  it("is the pay table, every row the result reached marked, and POKéMON JUMP's berry line under it", () => {
    const rows = payTable('pokemon-jump', 2600);
    expect(rows.map((row) => [row.asks, row.pays, row.reached])).toEqual([
      ['250', '10 TICKETS', true],
      ['2,500', '20 TICKETS', true],
      ['6,000', '30 TICKETS', false],
      ['5,000', 'A BERRY', false],
    ]);
  });

  it('reads a time round the course the right way up: the faster, the more rows', () => {
    expect(payTable('field-course', 17_000).map((row) => row.reached)).toEqual([true, true, false]);
    expect(payTable('field-course', 0).some((row) => row.reached)).toBe(false);
  });

  it("names THE DERBY's places, on the course's own tiers", () => {
    const rows = payTable('derby', 5, 2);
    expect(rows.map((row) => row.asks)).toEqual(['3RD', '2ND', '1ST']);
    expect(rows.map((row) => row.reached)).toEqual([true, true, false]);
    expect(rows[0]?.pays).not.toBe(payTable('derby', 5, 1)[0]?.pays);
  });

  it('says what was won, or why nothing was', () => {
    expect(wonLines({ tickets: 20, firstTier: null }, ['oran-berry', 'oran-berry', 'sand-ornament'])).toEqual(['+20 TICKETS', '2 ORAN BERRY', 'SAND ORNAMENT']);
    expect(wonLines({ tickets: 0, firstTier: 'A score of 250 pays 10 tickets.' }, [])).toEqual(['NO TICKETS']);
    expect(wonLines({ tickets: 0, firstTier: null }, [])).toEqual(['NOTHING MORE TODAY']);
  });
});
