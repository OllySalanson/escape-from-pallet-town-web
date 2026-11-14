import type { GridPosition } from '../movement/gridMovement';
import { needsRecovery } from '../hub/recovery';
import type { RaidProgress, RestoredGame } from '../save/SaveManager';
import type { StashedPokemon } from '../stash/Stash';
import { isFigureSpecies } from '../world/pokemonFigures';
import { BASE_FIXTURES } from './fixtures';

/**
 * THE BOLTHOLE's garden: the lawn between the house and the Day-Care's fence,
 * where Pokémon the player is keeping at home walk about between raids.
 *
 * The overnight plan's decision: the boxes stay the store, and the player can
 * *see* who is in them. Up to six walk about here - chosen on a PC (MY PC
 * upstairs, or BILL'S PC at the Center), and by default the six highest level
 * that are not going on the next raid - drawn as the Day-Care pen draws its
 * Pokémon (FireRed's party icons, pottering a tile at a time), and facing one
 * says who it is and asks whether to take it on the next raid.
 *
 * Only `raidProgress.garden` is stored, and only once a PC has been used to
 * choose: absent, the garden is the default above, worked out from the save
 * every time. Who is going on the next raid (`lastBench`), the partner at the
 * player's heel and anybody waiting on NURSE JOY are never out here, whatever
 * was chosen: they are somewhere else, and a Pokémon is in one place.
 *
 * Phaser-free, so who is out and where they may stand are tested without a
 * browser; `homeGardenFigures.ts` draws them.
 */

/** As many as a party, so a garden full is a team's worth. */
export const GARDEN_SIZE = 6;

/**
 * The lawn the garden is: east of the house, west of the Day-Care's fence,
 * from the wood down to the path. The mast stands in the middle of it once
 * built (`fixtures.ts`), a tile clear of the house and of the fence, and the
 * Day-Care Man at its south-east corner, and the garden gives both the room: a
 * tile something solid stands on is never stood on. It runs up to the trees
 * since the Day-Care's pen backed onto them: the row along the wood is not a
 * way to anywhere, and a lawn that is nobody's is a corner a full garden
 * would wall off.
 */
export const GARDEN = { x: 41, y: 7, width: 5, height: 5 } as const;

/**
 * Where anything built is read from (`fixtures.ts`): the mast is faced from
 * the lawn in front of its foot, which is in the garden, and nothing may stand
 * there - a thing nobody can face is a thing nobody can read.
 */
const READ_FROM = new Set(BASE_FIXTURES.map(({ at }) => `${at.x},${at.y + 1}`));

/** Every tile of the garden a Pokémon may stand on, row by row. */
export function gardenTiles(): readonly GridPosition[] {
  return Array.from({ length: GARDEN.width * GARDEN.height }, (_tile, index) => ({
    x: GARDEN.x + (index % GARDEN.width),
    y: GARDEN.y + Math.floor(index / GARDEN.width),
  })).filter((tile) => !READ_FROM.has(`${tile.x},${tile.y}`));
}

export function inGarden(tile: GridPosition): boolean {
  return (
    tile.x >= GARDEN.x &&
    tile.y >= GARDEN.y &&
    tile.x < GARDEN.x + GARDEN.width &&
    tile.y < GARDEN.y + GARDEN.height &&
    !READ_FROM.has(`${tile.x},${tile.y}`)
  );
}

/** Why a Pokémon is not in the garden, whatever the PC says: it is somewhere else. */
export type AwayFromGarden = 'team' | 'partner' | 'hurt' | 'no-figure';

/**
 * Where a Pokémon is instead of the garden, or null when it may be out there.
 * The team is the next raid's (`lastBench`), the partner walks at the player's
 * heel, and a Pokémon waiting on JOY lies as a Poké Ball on her counter.
 */
export function awayFromGarden(stored: StashedPokemon, game: Pick<RestoredGame, 'stash' | 'raidProgress'>): AwayFromGarden | null {
  if (game.stash.partnerId() === stored.id) return 'partner';
  if ((game.raidProgress.lastBench ?? []).includes(stored.id)) return 'team';
  if (needsRecovery(stored.pokemon)) return 'hurt';
  if (!isFigureSpecies(stored.pokemon.base.id)) return 'no-figure';
  return null;
}

/** Who may be out in the garden at all, in the vault's own order. */
function couldBeOut(game: Pick<RestoredGame, 'stash' | 'raidProgress'>): readonly StashedPokemon[] {
  return game.stash.listPokemon().filter((stored) => awayFromGarden(stored, game) === null);
}

/**
 * Who walks about the garden: the PC's choice, kept to who could be out, or -
 * with nothing chosen yet - the six highest level that could be, the kept
 * order breaking a tie.
 */
export function gardenPokemon(game: Pick<RestoredGame, 'stash' | 'raidProgress'>): readonly StashedPokemon[] {
  const able = couldBeOut(game);
  const chosen = game.raidProgress.garden;
  if (chosen !== undefined) {
    return able.filter((stored) => chosen.includes(stored.id)).slice(0, GARDEN_SIZE);
  }
  return able
    .map((stored, order) => ({ stored, order }))
    .sort((a, b) => b.stored.pokemon.level - a.stored.pokemon.level || a.order - b.order)
    .slice(0, GARDEN_SIZE)
    .sort((a, b) => a.order - b.order)
    .map(({ stored }) => stored);
}

/** The garden the PC's chip writes: one Pokémon put out or brought in. */
export type GardenToggle =
  | { readonly garden: readonly string[]; readonly out: boolean }
  | { readonly refused: string };

export function toggleGarden(
  game: Pick<RestoredGame, 'stash' | 'raidProgress'>,
  pokemonId: string,
): GardenToggle {
  const stored = game.stash.listPokemon().find((one) => one.id === pokemonId);
  if (!stored) {
    return { refused: 'That Pokémon is not in storage.' };
  }
  const out = gardenPokemon(game).map((one) => one.id);
  if (out.includes(pokemonId)) {
    return { garden: out.filter((id) => id !== pokemonId), out: false };
  }
  const away = awayFromGarden(stored, game);
  if (away !== null) {
    return { refused: awayLine(stored.pokemon.name, away) };
  }
  if (out.length >= GARDEN_SIZE) {
    return { refused: `The garden has ${GARDEN_SIZE} out already. Bring one in first.` };
  }
  return { garden: [...out, pokemonId], out: true };
}

/** Why a Pokémon cannot go out, in a sentence. */
export function awayLine(name: string, away: AwayFromGarden): string {
  switch (away) {
    case 'partner':
      return `${name} walks at your heel, not in the garden.`;
    case 'team':
      return `${name} is on the next raid's team. Press P to change the team.`;
    case 'hurt':
      return `${name} needs NURSE JOY first, at the Pokémon Center.`;
    case 'no-figure':
      return `${name} has no picture to walk about in yet.`;
  }
}

/** The save with this garden written into it, for a PC to save. */
export function withGarden(raidProgress: RaidProgress, garden: readonly string[]): RaidProgress {
  return { ...raidProgress, garden: [...garden] };
}

/**
 * Where a garden Pokémon wanders next: one step to a neighbouring tile of the
 * garden that `free` allows, chosen by `roll` (0 to 1), or nowhere - some of
 * the time it stays, so it potters rather than paces, as the pen's does.
 */
export function nextGardenTile(from: GridPosition, roll: number, free: (tile: GridPosition) => boolean): GridPosition {
  const steps = [
    { x: from.x, y: from.y - 1 },
    { x: from.x, y: from.y + 1 },
    { x: from.x - 1, y: from.y },
    { x: from.x + 1, y: from.y },
  ].filter((tile) => inGarden(tile) && free(tile));
  const index = Math.floor(Math.max(0, Math.min(0.999999, roll)) * (steps.length + 2));
  return steps[index] ?? from;
}

/**
 * Where each Pokémon stands when the yard is drawn: spread over the garden a
 * tile apart where it can be, on tiles `free` allows, in the garden's own
 * order - so the same garden is laid out the same way every time.
 */
export function gardenStarts(count: number, free: (tile: GridPosition) => boolean): readonly GridPosition[] {
  const open = gardenTiles().filter(free);
  const apart = open.filter((tile) => (tile.x + tile.y) % 2 === 0);
  const rest = open.filter((tile) => (tile.x + tile.y) % 2 !== 0);
  return [...apart, ...rest].slice(0, count);
}

/** What facing one says before it is asked about: who it is and where it is kept. */
export function gardenLines(stored: StashedPokemon, boxName: string): readonly string[] {
  const name = stored.pokemon.name;
  const species = stored.pokemon.base.name;
  const who = name === species ? `${name}, Lv ${stored.pokemon.level}.` : `${name} the ${species}, Lv ${stored.pokemon.level}.`;
  return [`${who} It is kept in ${boxName}, and potters about out here between raids.`];
}

/** The question facing one ends on. */
export function gardenQuestion(name: string): string {
  return `Take ${name} on the next raid?`;
}
