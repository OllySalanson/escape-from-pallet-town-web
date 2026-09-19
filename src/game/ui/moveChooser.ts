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
  escapeAttribute,
  pixelCommitBar,
  pixelScreen,
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
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const moveFacts = (move: MoveBase, pp?: number): string =>
  `${move.category === 'Status' || move.power === 0 ? 'POW -' : `POW ${move.power}`} · ACC ${move.accuracy} · PP ${pp ?? move.pp}/${move.pp}`;

const moveRow = (move: MoveBase, facts: string, attributes: string): string =>
  `<button class="px-row" ${attributes}><span class="px-row-main"><span class="px-row-line"><strong class="px-name">${escapeHtml(move.name.toUpperCase())}</strong>${pixelTypeBadge(move.type)}<small>${facts}</small></span></span></button>`;

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

export function moveChooserMarkup(view: MoveChooserView): string {
  const name = view.pokemon.base.name.toUpperCase();
  const incoming = view.incoming;
  const declineHelp = `Keep all four moves. ${incoming.name.toUpperCase()} is not learned.`;
  const rows = view.pokemon.moves
    .map((move, index) =>
      moveRow(
        move.base,
        moveFacts(move.base, move.pp),
        `data-forget="${index}" data-help="${escapeAttribute(`Forget ${move.base.name.toUpperCase()} and learn ${incoming.name.toUpperCase()} in its place.`)}"`,
      ),
    )
    .join('');
  const later = view.canDefer
    ? `<button class="px-window px-button" data-later data-help="Ask again at base. Nothing changes until you choose.">Decide later</button>`
    : '';
  const body = `<main class="px-body move-chooser">${pixelWindow(
    `<div class="px-list">${moveRow(incoming, moveFacts(incoming), 'disabled aria-disabled="true"')}${
      incoming.description ? `<p class="px-wrap">${escapeHtml(incoming.description)}</p>` : ''
    }</div>`,
    {
      className: 'move-chooser-new px-tone-primary',
      heading: `${escapeHtml(name)} WANTS TO LEARN`,
      tag: 'div',
    },
  )}${pixelWindow(`<div class="px-list px-scroll">${rows}</div>`, {
    className: 'move-chooser-known',
    heading: 'FORGET WHICH MOVE?',
    note: 'pick one to replace',
    tag: 'div',
  })}${pixelCommitBar({
    title: 'NOTHING IS LOST UNTIL YOU CHOOSE',
    className: 'move-chooser-actions',
    actions: `${later}<button class="px-window px-button is-primary" data-decline data-help="${escapeAttribute(declineHelp)}">Do not learn ${escapeHtml(incoming.name.toUpperCase())}</button>`,
  })}</main>`;
  return pixelScreen({
    title: 'Learn a move',
    place: escapeHtml(name),
    body,
    hints: view.canDefer
      ? 'ARROWS choose · ENTER select · ESC decide later'
      : 'ARROWS choose · ENTER select · ESC do not learn it',
  });
}
