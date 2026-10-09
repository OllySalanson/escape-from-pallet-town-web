/**
 * The choice a full moveset forces: forget one of four to learn a fifth, or do
 * not learn it. Phaser-free, so wording and structure are testable; the DOM
 * half is `MoveChooserOverlay`.
 *
 * It is written against a Pokemon and a move rather than against a level-up, so
 * anything that offers a move (a TM, a tutor) asks the same question with the
 * same screen. `Pokemon.resolvePendingMove` is the rule it ends in.
 */
import type { MoveBase, Pokemon } from '../pokemon';
import {
  COLUMN_MEASURES,
  escapeAttribute,
  pixelColumns,
  pixelCommitBar,
  pixelPortrait,
  pixelScreen,
  pixelTag,
  pixelTypeBadge,
  pixelWindow,
} from './pixelUi';

export type MoveChoice =
  | { readonly kind: 'forget'; readonly index: number }
  | { readonly kind: 'decline' }
  /** Leave it queued on the Pokemon and ask again. Only offered where nobody is mid-fight. */
  | { readonly kind: 'later' };

export interface MoveChooserView {
  readonly pokemon: Pokemon;
  readonly incoming: MoveBase;
  /** Whether "decide later" is on offer; it is not in a battle, which asks now. */
  readonly canDefer: boolean;
  /** What is teaching the move, when it is not a level: `TM13 Ice Beam`. */
  readonly source?: string;
  /** Whether that source is used up once the move is learned - a TM is, an HM is not. */
  readonly spendsSource?: boolean;
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const moveFacts = (move: MoveBase, pp?: number): string =>
  `${move.category === 'Status' || move.power === 0 ? 'POW -' : `POW ${move.power}`} · ACC ${move.accuracy} · PP ${pp ?? move.pp}/${move.pp}`;

/**
 * One move as a card: its name and type on the first line, what kind of move
 * it is and its numbers on the second, and its own sentence under them - so
 * the move being learned and the four it could replace are compared on the
 * same terms, side by side, rather than as a line of numbers each.
 */
const moveCard = (move: MoveBase, facts: string, attributes: string, tag = '', marked = false): string =>
  `<button class="px-row move-card${marked ? ' is-forgetting' : ''}" ${attributes}><span class="px-row-main"><span class="px-row-line"><strong class="px-name">${escapeHtml(move.name.toUpperCase())}</strong>${pixelTypeBadge(move.type)}${tag}</span><small>${move.category.toUpperCase()} · ${facts}</small>${
    move.description ? `<small class="px-wrap move-card-words">${escapeHtml(move.description)}</small>` : ''
  }</span></button>`;

/** What the battle says after the choice, so the loss is never silent. */
export function moveChoiceMessage(
  pokemonName: string,
  incoming: MoveBase,
  forgotten: MoveBase | null,
): string {
  const who = pokemonName.toUpperCase();
  return forgotten
    ? `${who} forgot ${forgotten.name.toUpperCase()} and learned ${incoming.name.toUpperCase()}!`
    : `${who} did not learn ${incoming.name.toUpperCase()}.`;
}

/** Whether the source is spent, said once, where the commit is. */
const sourceLine = (view: MoveChooserView): string =>
  view.source === undefined
    ? ''
    : view.spendsSource
      ? ` ${escapeHtml(view.source)} is used up once it is learned.`
      : ` ${escapeHtml(view.source)} is not used up.`;

/**
 * The whole chooser. `chosen` is the move the player has picked to forget and
 * not yet confirmed: picking one marks it and asks, and only the bar's own
 * FORGET button forgets anything - the question FireRed asks too, and the one
 * that makes a pointer resting on the wrong row cost nothing.
 */
export function moveChooserMarkup(view: MoveChooserView, chosen: number | null = null): string {
  const pokemon = view.pokemon;
  const name = pokemon.base.name.toUpperCase();
  const incoming = view.incoming;
  const learning = incoming.name.toUpperCase();
  const forgetting = chosen === null ? undefined : pokemon.moves[chosen];
  const declineHelp = `Keep all four moves. ${learning} is not learned.`;
  const rows = pokemon.moves
    .map((move, index) => {
      const picked = index === chosen;
      const help = picked
        ? `${move.base.name.toUpperCase()} is marked to forget. Confirm with the button at the bottom, or pick another move.`
        : `Mark ${move.base.name.toUpperCase()} to forget. ${move.base.description || 'No description on record.'}`;
      return moveCard(
        move.base,
        moveFacts(move.base, move.pp),
        `data-forget="${index}"${picked ? ' aria-pressed="true"' : ''} data-help="${escapeAttribute(help)}"`,
        picked ? pixelTag('Forget', 'risk') : '',
        picked,
      );
    })
    .join('');
  const who = `<span class="px-row-line"><strong class="px-name">${escapeHtml(name)}</strong><small>Lv ${pokemon.level} · ${pokemon.moves.length} of 4 moves known</small></span>`;
  const newMove = moveCard(incoming, moveFacts(incoming), 'aria-disabled="true" data-help="The move being learned."', pixelTag('New', 'good'));
  const later = view.canDefer
    ? `<button class="px-window px-button" data-later data-help="Ask again after your next raid. Nothing changes until you choose.">Decide later</button>`
    : '';
  const decline = `<button class="px-window px-button${forgetting ? '' : ' is-primary'}" data-decline data-help="${escapeAttribute(declineHelp)}">Do not learn ${escapeHtml(learning)}</button>`;
  const bar = forgetting
    ? pixelCommitBar({
        title: `Forget ${escapeHtml(forgetting.base.name.toUpperCase())} and learn ${escapeHtml(learning)}?`,
        className: 'move-chooser-actions is-armed',
        lines: [
          `<p class="px-wrap">${escapeHtml(name)} forgets ${escapeHtml(forgetting.base.name.toUpperCase())} for good.${sourceLine(view)}</p>`,
        ],
        actions: `${later}${decline}<button class="px-window px-button is-primary" data-forget-confirm data-help="${escapeAttribute(
          `Forget ${forgetting.base.name.toUpperCase()} and learn ${learning} in its place.`,
        )}">Forget ${escapeHtml(forgetting.base.name.toUpperCase())}</button>`,
      })
    : pixelCommitBar({
        title: 'Nothing is lost until you confirm',
        className: 'move-chooser-actions',
        lines: [
          `<p class="px-wrap">Pick the move ${escapeHtml(learning)} should replace, or keep all four.${sourceLine(view)}</p>`,
        ],
        actions: `${later}${decline}`,
      });
  const body = `<main class="px-body move-chooser">${pixelWindow(
    `<div class="move-chooser-new-body">${pixelPortrait(pokemon.base.dexId, pokemon.base.name)}<div class="move-chooser-learning">${who}<div class="px-list">${newMove}</div></div></div>`,
    {
      className: 'move-chooser-new px-tone-primary',
      heading: `${escapeHtml(name)} wants to learn ${escapeHtml(learning)}`,
      note: view.source ? `from ${escapeHtml(view.source)}` : undefined,
      tag: 'div',
    },
  )}${pixelWindow(`<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.move, { maximum: 4 })}>${rows}</div>`, {
    className: 'move-chooser-known',
    heading: `Forget which move?`,
    note: 'pick one, then confirm',
    tag: 'div',
  })}${bar}</main>`;
  return pixelScreen({
    title: 'Learn a move',
    place: escapeHtml(name),
    body,
    hints: forgetting
      ? 'ENTER forget it · ESC pick again'
      : view.canDefer
        ? 'ARROWS choose · ENTER mark it · ESC decide later'
        : 'ARROWS choose · ENTER mark it · ESC do not learn it',
  });
}
