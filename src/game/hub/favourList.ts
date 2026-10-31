import type { ItemId } from '../items';
import { BASE_DOORS } from '../base/doors';
import { HARBOUR_PEOPLE } from '../base/harbourLife';
import { harbourPlaceAt } from '../base/harbourPlaces';
import { iconMarkup, itemIcon, WORLD_ICONS } from '../ui/icons';
import { COLUMN_MEASURES, escapeAttribute, pixelColumns, pixelScreen, pixelWindow } from '../ui/pixelUi';
import {
  ERRANDS,
  errandBeat,
  errandOpen,
  errandRecord,
  errandSquares,
  errandThing,
  errandToSay,
  errandWhere,
  type Errand,
  type ErrandProgress,
} from './errands';

/**
 * Every favour in one notebook, a side panel opened with O anywhere at base -
 * the key the raid's field guide is on.
 *
 * A favour is asked face to face, a box a line (`BaseScene.speakToKeeper`), and
 * the detail that used to be laid over a keeper's screen is here instead, for
 * whoever wants to read it and not in anybody's way: what is in hand, where it
 * lies and what it pays; what is home waiting to be handed over; who has a
 * favour to ask and where they stand, without saying what it is - they say
 * that themselves; and what is done. Oak's board, the drop-in screen and the
 * field guide still name a favour where it matters to them.
 *
 * Phaser-free, so `favourList.test.ts` holds the words; the screen is
 * `ui/FavourListOverlay.ts`.
 */

/** Where a favour stands, in the order the screen lists them. */
export type FavourStanding = 'home' | 'in-hand' | 'ask' | 'ask-later' | 'done';

export interface FavourEntry {
  readonly errand: Errand;
  readonly standing: FavourStanding;
}

const ORDER: readonly FavourStanding[] = ['home', 'in-hand', 'ask', 'ask-later', 'done'];

/** Every favour that can be done from here, and where it stands. A favour on a map nobody can drop into is left out. */
export function favourEntries(
  progress: ErrandProgress,
  held: (itemId: ItemId) => number,
  raidsDeployed: number,
): readonly FavourEntry[] {
  const entries = ERRANDS.flatMap((errand): FavourEntry[] => {
    const status = errandRecord(progress.errands, errand.id)?.status;
    if (status === 'completed') {
      return [{ errand, standing: 'done' }];
    }
    if (status === 'started') {
      return [{ errand, standing: held(errand.itemId) > 0 ? 'home' : 'in-hand' }];
    }
    if (!errandOpen(errand, progress) || errandBeat(errand.giver, progress, held)?.kind !== 'ask') {
      return [];
    }
    // Turned down since the last raid: still theirs to ask, after the next one.
    const asking = errandToSay(errand.giver, progress, held, raidsDeployed)?.kind === 'ask';
    return [{ errand, standing: asking ? 'ask' : 'ask-later' }];
  });
  return [...entries].sort((a, b) => ORDER.indexOf(a.standing) - ORDER.indexOf(b.standing));
}

/** Where somebody who gives a favour is found: a keeper's building, or the part of the harbour they walk. */
export function favourGiverWhere(errand: Errand): string {
  if (errand.giver.startsWith('harbour:')) {
    const id = errand.giver.slice('harbour:'.length);
    const person = HARBOUR_PEOPLE.find((each) => each.id === id);
    return (person && harbourPlaceAt(person.position)?.name) ?? 'THE HARBOUR';
  }
  return BASE_DOORS.find((door) => door.screen === errand.giver)?.name ?? 'THE HARBOUR';
}

const HEADINGS: Readonly<Record<FavourStanding, string>> = {
  home: 'To hand over',
  'in-hand': 'In hand',
  ask: 'Somebody wants a word',
  'ask-later': 'Asked again after your next raid',
  done: 'Done',
};

/** The row's own line: the one fact about it that matters most. */
function rowLine(entry: FavourEntry): string {
  const { errand } = entry;
  const squares = errandSquares(errand);
  switch (entry.standing) {
    case 'home':
      return `Home. Speak to ${errand.name} at ${favourGiverWhere(errand)}.`;
    case 'in-hand':
      return `In ${errandWhere(errand)}. ${squares} ${squares === 1 ? 'square' : 'squares'} of your pack.`;
    case 'ask':
      return `At ${favourGiverWhere(errand)}. Look for the !`;
    case 'ask-later':
      return `At ${favourGiverWhere(errand)}. You said not now.`;
    case 'done':
      return `Done. ${errand.reward.summary}.`;
  }
}

/** The pane under the list, for the row the cursor is on: the whole of it. */
function detail(entry: FavourEntry): string {
  const { errand } = entry;
  const thing = errandThing(errand);
  switch (entry.standing) {
    case 'home':
      return `${thing} is in your stash. Speak to ${errand.name} at ${favourGiverWhere(errand)} and it is handed over. Reward: ${errand.reward.summary}.`;
    case 'in-hand':
      return `${errand.name} asked you for ${thing}. It lies in ${errandWhere(errand)}, laid there every raid until it comes home. Walk out with it and speak to ${errand.name}. Reward: ${errand.reward.summary}. Lost with the pack if you wipe.`;
    case 'ask':
      return `${errand.name} has a favour to ask. Find them at ${favourGiverWhere(errand)} and speak to them: they say what it is, and you say yes or not now.`;
    case 'ask-later':
      return `${errand.name} will ask again after your next raid, at ${favourGiverWhere(errand)}.`;
    case 'done':
      return `You brought ${errand.name} ${thing}. Reward: ${errand.reward.summary}.`;
  }
}

function row(entry: FavourEntry, first: boolean): string {
  const { errand } = entry;
  const known = entry.standing !== 'ask' && entry.standing !== 'ask-later';
  // A favour not yet asked is said by its giver, never here: the row names them.
  const name = known ? errandThing(errand) : errand.name;
  const by = known ? `<small>for ${errand.name}</small>` : '';
  const icon = known ? itemIcon(errand.itemId, errandThing(errand)) : iconMarkup(WORLD_ICONS.favourAsk, 'Wants a word');
  return `<button class="px-row has-icon px-tall px-contract" data-shows="favour-${errand.id}"${
    first ? ' data-cursor-start' : ''
  } data-help="${escapeAttribute(rowLine(entry))}">${icon}<span class="px-row-main"><span class="px-row-line"><strong class="px-name">${name}</strong>${by}</span><span class="px-wrap">${rowLine(entry)}</span></span></button>`;
}

/** The screen: the favours grouped by where they stand, and the whole of the one the cursor is on. */
export function favourListMarkup(entries: readonly FavourEntry[]): string {
  const groups = ORDER.map((standing) => entries.filter((entry) => entry.standing === standing)).filter(
    (group) => group.length > 0,
  );
  const rows = groups
    .map(
      (group) =>
        `<h3 class="px-subheading">${HEADINGS[group[0].standing]}</h3>${group.map((entry) => row(entry, entry === entries[0])).join('')}`,
    )
    .join('');
  const details = entries
    .map(
      (entry, index) =>
        `<div class="px-detail" data-shown-by="favour-${entry.errand.id}"${index === 0 ? '' : ' hidden'}><span class="px-wrap">${detail(entry)}</span></div>`,
    )
    .join('');
  const inHand = entries.filter((entry) => entry.standing === 'in-hand' || entry.standing === 'home').length;
  const done = entries.filter((entry) => entry.standing === 'done').length;
  const pane =
    entries.length === 0
      ? '<p class="px-empty px-wrap">Nobody has a favour to ask yet.</p>'
      : `<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.brief)}>${rows}</div>${details}`;
  return pixelScreen({
    title: 'Favours',
    place: 'The harbour',
    back: { label: 'Back', attribute: 'data-favours-close' },
    body: `<main class="px-body favour-list">${pixelWindow(pane, { heading: 'Favours', note: `${inHand} in hand · ${done} done` })}</main>`,
    hints: 'ARROWS read · ESC or O back',
  });
}
