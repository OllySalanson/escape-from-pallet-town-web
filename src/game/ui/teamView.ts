/**
 * YOUR TEAM: who goes on the next raid, picked from every box anywhere in the
 * harbour on P (`scenes/TeamScene.ts`).
 *
 * Pokémon live in boxes (the overnight plan's second decision), and a box is
 * where a Pokémon is kept, never a reason to walk somewhere: so this lists the
 * team first - the bench the Raid Arena will open on - and then everybody in
 * every box, fit to fight first and highest level first, each row saying which
 * box it is in, with a find over it. The raid's P is the party; at home it is
 * the same question asked before the raid.
 *
 * Phaser-free, so the order and the words are tested without a browser.
 */
import { MAX_RUN_PARTY, faintedRefusal } from '../hub/deploymentFlow';
import { healthLine } from './condition';
import { ABLE_TO_FIGHT, pickerFindField, pickerOrder, pickerRowAttributes, pickerRowNote, type PickerEntry } from './boxPicker';
import { COLUMN_MEASURES, escapeAttribute, pixelColumns, pixelHpBar, pixelPokemonName, pixelTag, pixelWindow } from './pixelUi';

export interface TeamViewState {
  /** Every Pokémon in every box (`pickerEntries`). */
  readonly entries: readonly PickerEntry[];
  /** Who is going, in the order they go: the first is the lead. */
  readonly team: readonly string[];
  /** The partner's stash id, which the row names. */
  readonly partnerId?: string;
}

/** Who is going, in team order, then everybody else, best fits first: the order the panel lists them. */
export function teamRows(state: TeamViewState): { readonly team: readonly PickerEntry[]; readonly boxes: readonly PickerEntry[] } {
  const byId = new Map(state.entries.map((entry) => [entry.id, entry]));
  const team = state.team.flatMap((id) => {
    const entry = byId.get(id);
    return entry ? [entry] : [];
  });
  const going = new Set(team.map((entry) => entry.id));
  return { team, boxes: pickerOrder(state.entries.filter((entry) => !going.has(entry.id)), ABLE_TO_FIGHT) };
}

/** What the help bar says of a row, and the status line after it is pressed. */
export function teamRowHelp(entry: PickerEntry, going: boolean, lead: boolean, size: number): string {
  const name = entry.pokemon.name;
  if (going) {
    return lead
      ? `${name} leads the next raid. ENTER leaves it at home in ${entry.box}.`
      : `${name} is going on the next raid (${size} of ${MAX_RUN_PARTY}). ENTER leaves it at home in ${entry.box}.`;
  }
  if (entry.pokemon.isFainted) {
    return faintedRefusal(name);
  }
  if (size >= MAX_RUN_PARTY) {
    return `The team is full (${MAX_RUN_PARTY}). Leave somebody at home first.`;
  }
  return `${name} is at home in ${entry.box}. ENTER takes it on the next raid.`;
}

/** The panel's body: the team, then every box, with a find over both. */
export function teamBody(state: TeamViewState): string {
  const { team, boxes } = teamRows(state);
  const size = team.length;
  const row = (entry: PickerEntry, going: boolean, index: number, first: boolean): string => {
    const { pokemon } = entry;
    const lead = going && index === 0;
    const fainted = pokemon.isFainted;
    const tag = going
      ? pixelTag(lead ? 'Lead' : 'Going', 'good', true)
      : fainted
        ? pixelTag('Fainted', 'risk')
        : pixelTag(size >= MAX_RUN_PARTY ? 'Full' : 'Take', 'plain');
    const partner = entry.id === state.partnerId ? 'partner' : '';
    const note = pickerRowNote(entry, [healthLine(pokemon), partner].filter(Boolean).join(' · '));
    const disabled = !going && (fainted || size >= MAX_RUN_PARTY);
    return `<button class="px-row${going ? ' is-selected' : ''}" data-member="${entry.id}" ${pickerRowAttributes(entry)}${first ? ' data-cursor-start' : ''}${disabled ? ' aria-disabled="true"' : ''} data-help="${escapeAttribute(teamRowHelp(entry, going, lead, size))}"><span class="px-row-main"><span class="px-row-line">${pixelPokemonName(pokemon)}${pixelHpBar(pokemon.currentHp, pokemon.maxHp)}</span><small>${note}</small></span>${tag}</button>`;
  };
  const going =
    team.length > 0
      ? team.map((entry, index) => row(entry, true, index, index === 0)).join('')
      : '<p class="px-empty px-wrap">Nobody yet. Choose up to six from your boxes below.</p>';
  const home =
    boxes.length > 0
      ? boxes.map((entry, index) => row(entry, false, index, team.length === 0 && index === 0)).join('')
      : '<p class="px-empty px-wrap">Everybody you have is going.</p>';
  const list = `${pickerFindField()}<h3 class="px-subheading">Next raid</h3>${going}<h3 class="px-subheading">In your boxes</h3>${home}`;
  // The raid party's layout: one list as tall as the panel and no taller, so
  // its foot scrolls inside the window rather than running under the help bar.
  return `<main class="px-body raid-party-layout">${pixelWindow(`<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.pokemon)}>${list}</div>`, {
    heading: 'Who is going?',
    note: `${size} of ${MAX_RUN_PARTY}`,
  })}</main>`;
}
