import { describe, expect, it } from 'vitest';
import { BULBASAUR, Pokemon, SQUIRTLE } from '../pokemon';
import { MACHINES, canLearnFromMachine } from '../pokemon/machines';
import { SPECIES_BY_ID } from '../pokemon/species';
import { MAP_DISTRICTS } from './districts';
import {
  FIELD_MOVES,
  FIELD_MOVE_IDS,
  fieldMoveLines,
  fieldMoveOpenedLine,
  fieldMoveUser,
  partyHasFieldMove,
} from './fieldMoves';
import { EXTRACTION_POINTS } from './extractionPoints';
import { WORLD_GATES, fieldMoveGateAt, gatesForMap } from './gates';
import { stepDistances } from './mapStructure';
import { RUN_INSERTIONS } from '../run/runGeneration';
import { getWorldMap } from '../worldMap';

const learning = (base: typeof BULBASAUR, level: number, id: 'cut' | 'surf'): Pokemon => {
  const pokemon = new Pokemon(base, level);
  pokemon.learnMove(FIELD_MOVES[id].move);
  return pokemon;
};

describe('a move that is also a route', () => {
  it('is carried by whoever knows it, whatever state they are in', () => {
    const cutter = learning(BULBASAUR, 4, 'cut');
    const bystander = new Pokemon(SQUIRTLE, 5);

    expect(fieldMoveUser([bystander, cutter], 'cut')).toBe(cutter);
    expect(fieldMoveUser([bystander], 'cut')).toBeUndefined();
    expect(partyHasFieldMove([bystander, cutter], 'cut')).toBe(true);
    expect(partyHasFieldMove([bystander, cutter], 'surf')).toBe(false);

    // A fainted Pokemon still holds the key. Opening a door is not something
    // it has to be standing up for, and refusing would make a door that shuts
    // when a raid goes badly.
    cutter.takeDamage(cutter.maxHp);
    expect(cutter.isFainted).toBe(true);
    expect(fieldMoveUser([cutter], 'cut')).toBe(cutter);
  });

  it('says what is in the way either way, and names the move when nobody can', () => {
    const cutter = learning(BULBASAUR, 4, 'cut');

    expect(fieldMoveLines('cut', undefined)).toEqual([
      'Growth has closed the ride. Thick, old and shoulder high.',
      'Nothing in the party can cut it. Something that reads HM01 could.',
    ]);
    expect(fieldMoveLines('cut', cutter)).toEqual([
      'Growth has closed the ride. Thick, old and shoulder high.',
      'BULBASAUR cut the growth away.',
    ]);
    // The same promise a boss's gate makes, because it is the same door.
    expect(fieldMoveOpenedLine('COPPICE RIDE')).toBe(
      'COPPICE RIDE is open - and stays open on every raid from now on.',
    );
  });

  it('is taught by a disc, and by nothing else', () => {
    for (const id of FIELD_MOVE_IDS) {
      const { move } = FIELD_MOVES[id];
      const machine = Object.values(MACHINES).find((candidate) => candidate.move === move);
      expect(machine, `${id} has no disc`).toBeDefined();
      // Reusable, and that is not decoration: the door it opens is permanent,
      // so a disc that could run out would be a capability a player could lose.
      expect(machine!.reusable).toBe(true);
      // And nothing levels into it, so the disc is the only way to the key.
      for (const species of Object.values(SPECIES_BY_ID)) {
        expect(
          species.learnset.some((entry) => entry.move === move),
          `${species.id} levels into ${move.name}`,
        ).toBe(false);
      }
    }
  });

  /**
   * The rule that decides whether a field move is content or a starter lottery.
   * Cut is read by the Grass and Fire starter lines and not the Water one;
   * Surf by the Water line and neither of the others. If a disc could only ever
   * reach the starter, two thirds of players would be locked out of half the
   * doors by a choice they made before they had seen either.
   *
   * What makes it fair is the rest of the roster: both moves are read by
   * species a raid can catch on the maps the doors are on, and the places those
   * species live are named here so a redrawn table cannot quietly take the last
   * one away.
   */
  it('is reachable by every starter, because the key is something you can go and catch', () => {
    const wild = new Set(
      MAP_DISTRICTS.flatMap((district) =>
        (district.encounters?.entries ?? []).map((entry) => entry.speciesId),
      ),
    );
    expect(wild.size).toBeGreaterThan(0);

    for (const id of FIELD_MOVE_IDS) {
      const { move } = FIELD_MOVES[id];
      const catchable = [...wild].filter((species) => canLearnFromMachine(species, move)).sort();
      expect(catchable.length, `${id} has no catchable learner`).toBeGreaterThan(0);
      if (id === 'cut') {
        expect(catchable).toEqual([
          'beedrill',
          'bellsprout',
          'bulbasaur',
          'charmander',
          'diglett',
          // The shoal's own, and the one catchable species that reads both
          // discs - the place a Surf opens is where the next Cut is standing.
          'krabby',
          'meowth',
          // Pallet's hay closes, which is where a Nidoran would be.
          'nidoran-f',
          'oddish',
          // The forest's east and south, the kilns' heath and the levels'
          // fen: four maps grew, and these two came with the ground.
          'paras',
          'rattata',
          'sandshrew',
        ]);
      } else {
        // Shellder is Pallet's tide line: the shore is the one place a Surf
        // learner turns up that is not fresh water.
        expect(catchable).toEqual(['krabby', 'poliwag', 'psyduck', 'shellder', 'squirtle']);
      }
    }
  });

  /**
   * The constraint a five-minute raid puts on a move that opens terrain: it
   * must not make a route so much shorter that the clock stops mattering.
   *
   * Both doors keep it by construction rather than by tuning, and this is the
   * proof: every walk between two named places on the map is exactly as long
   * with the door open as it was with it shut. What a field move opens here is
   * a dead end - a coppice and a shoal, each with one way in and out - so there
   * is no route it can shorten at all.
   *
   * That is a decision and not an accident. Both maps were measured for the
   * short cut a field move *could* have been: on Viridian Forest, which is
   * two-connected throughout, the best single cut anywhere in the wood is worth
   * four steps and the best straight run of four is worth eight; on the
   * Floodplain the best straight crossing of the river is worth twenty-two,
   * which is about three seconds of a three-hundred-second raid. A door worth
   * three seconds is a door nobody would carry a disc for, so what these open
   * is ground instead.
   */
  it('shortens no route the map already had, because what it opens is a dead end', () => {
    const doors = WORLD_GATES.filter((gate) => gate.fieldMove !== undefined);
    for (const door of doors) {
      const shut = getWorldMap(door.mapId);
      const open = getWorldMap(door.mapId, [door.id]);
      const places = [
        ...Object.values(RUN_INSERTIONS)
          .filter((insertion) => insertion.mapId === door.mapId)
          .map((insertion) => ({ what: insertion.id, position: insertion.position })),
        ...EXTRACTION_POINTS.filter((point) => point.mapId === door.mapId).map((point) => ({
          what: point.label,
          position: point.position,
        })),
        ...shut.pois.map((poi) => ({ what: poi.label, position: poi.position })),
      ];

      for (const from of places) {
        const before = stepDistances(shut.collision, from.position);
        const after = stepDistances(open.collision, from.position);
        for (const to of places) {
          // Anything sealed off while the door is shut has no walk to compare.
          if ((before[to.position.y]?.[to.position.x] ?? -1) < 0) {
            continue;
          }
          expect(
            `${door.label}: ${from.what} -> ${to.what} is ${after[to.position.y][to.position.x]} steps`,
          ).toBe(`${door.label}: ${from.what} -> ${to.what} is ${before[to.position.y][to.position.x]} steps`);
        }
      }
    }
  });

  it('answers only for the tiles of its own door', () => {
    const doors = WORLD_GATES.filter((gate) => gate.fieldMove !== undefined);
    expect(doors.length).toBeGreaterThan(0);

    for (const door of doors) {
      const onTheMap = gatesForMap(door.mapId);
      for (const tile of door.tiles) {
        expect(fieldMoveGateAt(onTheMap, tile)).toBe(door);
      }
      // One tile off it is not a door, which is what stops the interact key
      // opening a gate the player is not standing at.
      const beside = { x: door.tiles[0].x, y: door.tiles[0].y - 2 };
      expect(fieldMoveGateAt(onTheMap, beside)).toBeUndefined();
    }
    // And a boss's gate is never one of these: the two are one type, and the
    // key is what tells them apart.
    for (const boss of WORLD_GATES.filter((gate) => gate.bossId !== undefined)) {
      expect(fieldMoveGateAt(gatesForMap(boss.mapId), boss.tiles[0])).toBeUndefined();
    }
  });
});
