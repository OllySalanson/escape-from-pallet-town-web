import type { GridPosition } from '../movement/gridMovement';
import type { PokemonBase } from '../pokemon';
import { STARTER_SPECIES, type StarterSpeciesId } from '../stash';
import { STARTER_NOTES } from '../ui/starterPicker';

/**
 * The three Poké Balls on Oak's table, which is where a new game chooses its
 * partner, as FireRed's does (`PalletTown_ProfessorOaksLab`): walk up to a ball,
 * press, see what is in it, and say yes.
 *
 * It used to be a screen of three cards, and the captain's word for the menu
 * screens was disengaging. Three rules came across from that screen, each paid
 * for by a playtest (47, and the new-game test of 31 Oct):
 *
 * - **Looking commits nothing.** Facing a ball, or resting the pointer on one,
 *   only shows what is in it, so a mouse crossing the table on its way somewhere
 *   changes nothing.
 * - **The press that asked is not the answer.** The question takes no click for a
 *   moment, because the second half of a double-click must not pick the partner. It
 *   opens on YES, as FireRed's does: on NOT NOW, somebody pressing on through it
 *   went round and round the same question.
 * - **Nothing is written until YES.** Until then the room stands on a game that is
 *   not in storage (`save/newGame.ts`), so walking away from the question, or
 *   closing the tab, leaves nothing behind.
 */

/** Where the table stands in the lab (`drawLab`): three tiles wide and two deep. */
export const LAB_TABLE = { x: 8, y: 4, width: 3, height: 2 } as const;

/** Where a new game stands: a step short of the table, facing it, with no ball faced yet. */
export const FIRST_STANDING: GridPosition = { x: 9, y: 7 };

/** Left to right along the table, the order Kanto numbers them and FireRed lays them. */
const BALL_COLUMNS: Readonly<Record<StarterSpeciesId, number>> = {
  bulbasaur: LAB_TABLE.x,
  charmander: LAB_TABLE.x + 1,
  squirtle: LAB_TABLE.x + 2,
};

/** The tile a ball is drawn on, on the table's top. */
export function ballTile(starter: StarterSpeciesId): GridPosition {
  return { x: BALL_COLUMNS[starter], y: LAB_TABLE.y };
}

/** The tiles a ball answers from: both rows of the table under it, so it is faced from in front. */
export function ballTiles(starter: StarterSpeciesId): readonly GridPosition[] {
  const { x, y } = ballTile(starter);
  return [
    { x, y },
    { x, y: y + 1 },
  ];
}

/** Which ball, if any, this tile of the table answers for. */
export function ballAt(tile: GridPosition): StarterSpeciesId | null {
  const under = STARTER_SPECIES.find(({ id }) => ballTiles(id).some((each) => each.x === tile.x && each.y === tile.y));
  return under?.id ?? null;
}

/** What is left on the table once a partner has been taken: every ball but that one. */
export function ballsLeftFor(partner: StarterSpeciesId | null): readonly StarterSpeciesId[] {
  return STARTER_SPECIES.map(({ id }) => id).filter((id) => id !== partner);
}

/** A species' types as a caption says them. */
export function typeWords(species: PokemonBase): string {
  return species.secondaryType ? `${species.primaryType} · ${species.secondaryType}` : species.primaryType;
}

/** What the preview says of a ball, under its picture: the three lines the card used to. */
export function ballPreviewLines(species: PokemonBase): readonly string[] {
  const moves = species.learnset
    .filter(({ level }) => level <= 5)
    .map(({ move }) => move.name)
    .join(', ');
  return [typeWords(species), STARTER_NOTES[species.id], `Lv 5: ${moves}`];
}

/** Oak, as the player comes in. FireRed's own speech, cut to the two boxes a raid game has time for. */
export function oakOpeningLines(playerName: string | null): readonly string[] {
  return [`There you are${playerName ? `, ${playerName}` : ''}! Take a partner off that table.`];
}

/** Oak, spoken to before anything has been chosen. */
export const OAK_GO_ON = 'Go on, choose! Walk up to a Poké Ball and press.';
/** FireRed's own line, for anybody who heads for the door first. */
export const OAK_DONT_GO = 'Hey! Don’t go away yet! Your partner is on the table.';
/** Anything else in the lab, before the one thing that matters. */
export const OAK_THAT_CAN_WAIT = 'That can wait. Choose your partner first!';

/**
 * The question, after FireRed's "BULBASAUR is your choice": it has to fit the
 * box's one line, or it lies over its own answers, and the preview beside it says
 * the rest.
 */
export function starterQuestion(species: PokemonBase): string {
  return `Is ${species.name.toUpperCase()} your choice?`;
}

/** Said as the ball is handed over, with the fanfare. */
export function receivedLine(playerName: string | null, species: PokemonBase): string {
  return `${playerName ?? 'You'} received ${species.name.toUpperCase()} from PROFESSOR OAK!`;
}

/** What a ball still on the table says, once a partner has been taken. */
export const BALL_LEFT_NOTE = 'One of Oak’s last Pokémon';
export const BALL_LEFT_LINE = 'That’s one of PROFESSOR OAK’s last Pokémon. It stays with him.';

/** The foot of the screen, while there is a partner to choose. */
export const CHOOSING_HINT = 'WALK UP TO A POKÉ BALL AND PRESS [SPACE]';
