/**
 * Reading a disc to a Pokemon, as one screen that says what is about to happen.
 *
 * It used to be the bag's recipient list with a tag on the end of each row -
 * CAN LEARN ICE BEAM, four times across a strip one row deep over a screen of
 * empty backdrop - and pressing a row read the disc there and then. What the
 * move was, what each Pokemon already knew, whether anything would be forgotten
 * and whether the disc would be gone afterwards were all somewhere else or
 * nowhere (the captain, 2026-09-27: "a bit unclear").
 *
 * So it answers every one of those questions before anything is spent: the disc
 * and the move it teaches across the top; every party member as a card with its
 * portrait, its four moves and what reading the disc would do *to it* in words;
 * and a commit bar at the foot that names the Pokemon and the move and does
 * nothing until it is pressed. Choosing a card is not teaching it - the card is
 * marked and the bar asks - because a choice of who should be undone as easily
 * as it was made, and it is two presses from the keyboard (ENTER on the card,
 * ENTER on TEACH).
 *
 * Phaser-free, so the words and the verdicts are tested without a browser; the
 * screen that renders it and spends the disc is `BagScene`.
 */
import type { ItemDefinition } from '../items';
import { canLearnFromMachine, type MachineDefinition } from '../pokemon/machines';
import type { Pokemon } from '../pokemon';
import { conditionLine } from './condition';
import { itemIcon } from './icons';
import { moveFacts } from './moveChooser';
import {
  COLUMN_MEASURES,
  escapeAttribute,
  pixelColumns,
  pixelCommitBar,
  pixelPortrait,
  pixelTag,
  pixelTypeBadge,
  pixelWindow,
} from './pixelUi';

/** How many moves a Pokemon holds before a fifth has to replace one. */
const MOVE_SLOTS = 4;

/**
 * What reading this disc would do to this Pokemon: learn it in a free slot,
 * learn it in place of a move the player picks next, nothing because it is
 * already known, or nothing because FireRed does not let this species read it.
 */
export type PupilVerdict = 'learns' | 'replaces' | 'knows' | 'cannot';

export function pupilVerdict(machine: MachineDefinition, pokemon: Pokemon): PupilVerdict {
  if (pokemon.moves.some((known) => known.base === machine.move)) {
    return 'knows';
  }
  if (!canLearnFromMachine(pokemon.base.id, machine.move)) {
    return 'cannot';
  }
  return pokemon.moves.length < MOVE_SLOTS ? 'learns' : 'replaces';
}

/** Whether a card with this verdict may be chosen at all. */
export const canChoosePupil = (verdict: PupilVerdict): boolean =>
  verdict === 'learns' || verdict === 'replaces';

/** One sentence on the card: what reading the disc does to this Pokemon. */
export function pupilOutcome(machine: MachineDefinition, pokemon: Pokemon): string {
  const move = machine.move.name.toUpperCase();
  switch (pupilVerdict(machine, pokemon)) {
    case 'learns':
      return `Has a free slot: learns ${move} and forgets nothing.`;
    case 'replaces':
      return `Knows four moves: you pick which one ${move} replaces.`;
    case 'knows':
      return `Already knows ${move}.`;
    case 'cannot':
      return `Cannot learn ${move}.`;
  }
}

/** Whether the disc survives being read, said as plainly as the move itself. */
export const discFate = (machine: MachineDefinition): string =>
  machine.reusable
    ? `An HM is never used up: keep it for the next Pokémon.`
    : `A TM is used up once a Pokémon learns it.`;

export interface TeachView {
  readonly item: ItemDefinition;
  readonly machine: MachineDefinition;
  readonly party: readonly Pokemon[];
  /** How many of the disc the pack holds. */
  readonly carried: number;
  /** The party index of the Pokemon chosen to learn it, if one has been. */
  readonly chosen: number | null;
}

const VERDICT_TAG: Readonly<Record<PupilVerdict, string>> = {
  learns: pixelTag('Can learn', 'good'),
  replaces: pixelTag('Can learn', 'good'),
  knows: pixelTag('Knows it', 'plain', true),
  cannot: pixelTag('Cannot learn', 'risk'),
};

/** The move the disc teaches, and what becomes of the disc. */
function discWindow(view: TeachView): string {
  const move = view.machine.move;
  const body = `<div class="teach-disc">${itemIcon(view.item.id, view.item.displayName)}<div class="teach-disc-words"><span class="px-row-line"><strong class="px-name">${move.name}</strong>${pixelTypeBadge(move.type)}<small>${move.category.toUpperCase()} · ${moveFacts(move)}</small></span><p class="px-wrap">${view.item.description}</p><small class="px-wrap teach-disc-fate">${discFate(view.machine)}</small></div></div>`;
  return pixelWindow(body, {
    className: 'teach-disc-window px-tone-primary',
    heading: `${view.machine.number} ${move.name}`,
    note: `${view.carried} carried`,
  });
}

/** One party member as a card: who, what they know, and what the disc would do. */
function pupilCard(view: TeachView, pokemon: Pokemon, index: number): string {
  const verdict = pupilVerdict(view.machine, pokemon);
  const chosen = view.chosen === index;
  const choosable = canChoosePupil(verdict);
  const name = pokemon.base.name.toUpperCase();
  const move = view.machine.move.name.toUpperCase();
  const moves = [
    ...pokemon.moves.map(
      (known) =>
        `<li${known.base === view.machine.move ? ' class="is-known"' : ''}><span class="px-name">${known.base.name}</span>${pixelTypeBadge(known.base.type)}</li>`,
    ),
    ...Array.from(
      { length: Math.max(0, MOVE_SLOTS - pokemon.moves.length) },
      () => `<li class="is-free"><small>Free slot</small></li>`,
    ),
  ].join('');
  const help = choosable
    ? chosen
      ? `${name} is chosen. Press TEACH at the bottom to read the disc, or choose someone else.`
      : `Choose ${name} to learn ${move}. ${pupilOutcome(view.machine, pokemon)} Nothing happens until you press TEACH.`
    : `${name}: ${pupilOutcome(view.machine, pokemon)}`;
  const tag = chosen ? pixelTag('Chosen', 'good', true) : VERDICT_TAG[verdict];
  const classes = ['px-row', 'teach-pupil', `is-${verdict}`, ...(chosen ? ['is-selected'] : [])].join(' ');
  return `<button class="${classes}" data-pupil="${index}"${choosable ? '' : ' aria-disabled="true"'} data-help="${escapeAttribute(help)}">${pixelPortrait(pokemon.base.dexId, pokemon.base.name)}<span class="teach-pupil-words"><span class="px-row-line"><strong class="px-name">${name}</strong>${tag}</span><small class="teach-pupil-condition">${conditionLine(pokemon)}</small><ol class="teach-moves" aria-label="${escapeAttribute(`${name}'s moves`)}">${moves}</ol><span class="px-wrap teach-outcome">${pupilOutcome(view.machine, pokemon)}</span></span></button>`;
}

/** The foot of the screen: what pressing TEACH will do, or what to do first. */
function teachBar(view: TeachView): string {
  const move = view.machine.move.name.toUpperCase();
  const pupil = view.chosen === null ? undefined : view.party[view.chosen];
  const able = view.party.filter((pokemon) => canChoosePupil(pupilVerdict(view.machine, pokemon))).length;
  if (!pupil) {
    const line =
      able === 0
        ? `Nobody in the party can learn ${move}. The disc stays in the pack.`
        : `${able} of ${view.party.length} can learn it. Choose one above - nothing is used up until you press TEACH.`;
    return pixelCommitBar({
      title: `Who should learn ${move}?`,
      className: 'teach-bar',
      lines: [`<p class="px-wrap">${line}</p>`],
      // The way back is the title bar's own PACK and ESC; a second one here
      // would put two buttons beside a question only a card can answer.
      actions: `<button class="px-window px-button is-primary" data-teach aria-disabled="true" data-help="Choose a Pokémon above first.">Teach ${move}</button>`,
    });
  }
  const name = pupil.base.name.toUpperCase();
  const replaces = pupilVerdict(view.machine, pupil) === 'replaces';
  const line = replaces
    ? `${name} knows four moves: next, pick the one ${move} replaces. Nothing is forgotten until you confirm.`
    : `${name} learns ${move} in a free slot and forgets nothing.`;
  const confirmLabel = replaces ? 'Pick a move to forget' : `Teach ${move}`;
  const confirmHelp = replaces
    ? `See ${name}'s four moves and choose the one ${move} replaces.`
    : `${name} learns ${move}. ${discFate(view.machine)}`;
  return pixelCommitBar({
    title: `Teach ${move} to ${name}?`,
    className: 'teach-bar is-armed',
    lines: [`<p class="px-wrap">${line} ${view.machine.reusable ? 'The HM is not used up.' : 'The TM is used up.'}</p>`],
    actions: `<button class="px-window px-button" data-teach-cancel data-help="${escapeAttribute(`Do not teach ${name}. Choose someone else, or go back to the pack.`)}">Cancel</button><button class="px-window px-button is-primary" data-teach data-help="${escapeAttribute(confirmHelp)}">${confirmLabel}</button>`,
  });
}

/** The whole body of the teaching screen. */
export function teachBody(view: TeachView): string {
  const cards = view.party.map((pokemon, index) => pupilCard(view, pokemon, index)).join('');
  const able = view.party.filter((pokemon) => canChoosePupil(pupilVerdict(view.machine, pokemon))).length;
  const pupils = pixelWindow(
    `<div class="px-list px-scroll teach-pupils" ${pixelColumns(COLUMN_MEASURES.pupil)}>${
      cards || '<p class="px-empty">Nobody is deployed.</p>'
    }</div>`,
    {
      className: 'teach-pupils-window',
      heading: `Who learns ${view.machine.move.name}?`,
      note: `${able} of ${view.party.length} can`,
    },
  );
  return `<main class="px-body teach-layout">${discWindow(view)}${pupils}${teachBar(view)}</main>`;
}

