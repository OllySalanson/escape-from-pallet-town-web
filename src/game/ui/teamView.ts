/**
 * YOUR TEAM: who goes on the next raid, picked from every box anywhere in the
 * harbour on P (`scenes/TeamScene.ts`).
 *
 * Pokémon live in boxes (the overnight plan's second decision), and a box is
 * where a Pokémon is kept, never a reason to walk somewhere: so this shows the
 * team first - the bench the Raid Arena will open on - and then everybody in
 * every box, fit to fight first and highest level first, with a find over it.
 * The raid's P is the party; at home it is the same question asked before the
 * raid.
 *
 * It is drawn as FireRed draws a party and a PC box, not as a list (the menu
 * overhaul, `docs/screens/menu-overhaul/`): the team is six slots, two abreast
 * as HeartGold's touch screen has them, the lead's in gold and an empty one a
 * dim Poké Ball, so how many are going is seen rather than counted; the boxes
 * are a grid of FireRed's party icons, each flapping at its own health's pace
 * (`monIcon.ts`) over its level and a short health bar; and everything else
 * about the one under the cursor - its portrait, its types, its health in
 * figures, its box - is the one card at the foot, so the words are there for
 * one Pokémon at a time and never for thirty.
 *
 * Phaser-free, so the order and the words are tested without a browser.
 */
import { getHeldItem } from '../items';
import { MAX_RUN_PARTY, faintedRefusal } from '../hub/deploymentFlow';
import { ABLE_TO_FIGHT, pickerFindField, pickerOrder, pickerRowAttributes, type PickerEntry } from './boxPicker';
import { itemIcon } from './icons';
import { pixelEmptyPartySlot, pixelMonTile, pixelPartySlot } from './monIcon';
import {
  escapeAttribute,
  pixelHpBar,
  pixelPokemonName,
  pixelPortrait,
  pixelTag,
  pixelTypeBadge,
  pixelWindow,
} from './pixelUi';

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

/** Said when ENTER would leave the team empty: nobody is ever left with no team (playtest wave 3, finding 11). */
export const LAST_ONE_STAYS = 'Somebody has to go. Take another first.';

/** What the help bar says of a slot or a tile, and the status line after it is pressed: short, because the card says the rest. */
export function teamRowHelp(entry: PickerEntry, going: boolean, lead: boolean, size: number): string {
  const name = entry.pokemon.name;
  if (going && size === 1) {
    return `${name} is the whole team. Take another first.`;
  }
  if (going) {
    return `${name} ${lead ? 'leads' : 'is going'}. ENTER leaves it at home.`;
  }
  if (entry.pokemon.isFainted) {
    return faintedRefusal(name);
  }
  if (size >= MAX_RUN_PARTY) {
    return `The team is full (${MAX_RUN_PARTY}). Leave somebody at home first.`;
  }
  return `ENTER takes ${name} on the next raid.`;
}

/** The words a slot or a tile is read by, for a screen reader and a driver: who, how strong, where. */
function spokenName(entry: PickerEntry): string {
  return `${entry.pokemon.name}, level ${entry.pokemon.level}, ${entry.box}`;
}

/** The card at the foot for one Pokémon: the only place its words are. */
function teamCard(entry: PickerEntry, going: boolean, lead: boolean, partner: boolean): string {
  const { pokemon } = entry;
  const types = [pokemon.base.primaryType, pokemon.base.secondaryType].filter((type): type is NonNullable<typeof type> => Boolean(type));
  const held = getHeldItem(pokemon.heldItemId);
  const tag = going
    ? pixelTag(lead ? 'Lead' : 'Going', 'good', true)
    : pokemon.isFainted
      ? pixelTag('Fainted', 'risk')
      : '';
  const where = [entry.box, ...(partner ? ['partner'] : [])].join(' · ');
  return `<div class="px-detail team-card" data-shown-by="${escapeAttribute(entry.id)}" hidden>${pixelPortrait(pokemon.base.dexId ?? 0, pokemon.name, pokemon.shiny)}<div class="team-card-words"><span class="px-row-line">${pixelPokemonName(pokemon)}<span class="team-card-level">Lv ${pokemon.level}</span>${tag}</span><span class="px-row-line">${pixelHpBar(pokemon.currentHp, pokemon.maxHp)}<small>${pokemon.currentHp}/${pokemon.maxHp}</small></span><span class="px-row-line team-card-types">${types.map((type) => pixelTypeBadge(type)).join('')}</span><small class="team-card-where">${escapeAttribute(where)}${held ? ` · ${itemIcon(held.id, held.displayName)}${escapeAttribute(held.displayName)}` : ''}</small></div></div>`;
}

/** One of the six, as FireRed's party slot (`pixelPartySlot`). */
function teamSlot(entry: PickerEntry, lead: boolean, size: number, first: boolean): string {
  const attributes = `data-member="${escapeAttribute(entry.id)}" data-shows="${escapeAttribute(entry.id)}" data-box-name="${escapeAttribute(entry.box)}" aria-label="${escapeAttribute(spokenName(entry))}"${first ? ' data-cursor-start' : ''} data-help="${escapeAttribute(teamRowHelp(entry, true, lead, size))}"`;
  return pixelPartySlot(entry.pokemon, { lead, attributes });
}

/** One in a box: the icon over its level and a short bar, as FireRed's PC box with the two facts a team is picked by. */
function boxTile(entry: PickerEntry, size: number, first: boolean): string {
  const disabled = entry.pokemon.isFainted || size >= MAX_RUN_PARTY;
  return pixelMonTile(entry.pokemon, {
    attributes: `data-member="${escapeAttribute(entry.id)}" data-shows="${escapeAttribute(entry.id)}" ${pickerRowAttributes(entry)} aria-label="${escapeAttribute(spokenName(entry))}"${first ? ' data-cursor-start' : ''}${disabled ? ' aria-disabled="true"' : ''} data-help="${escapeAttribute(teamRowHelp(entry, false, false, size))}"`,
  });
}

/** The panel's body: the six slots, the boxes, and the card for the one under the cursor. */
export function teamBody(state: TeamViewState): string {
  const { team, boxes } = teamRows(state);
  const size = team.length;
  const slots = Array.from({ length: MAX_RUN_PARTY }, (_, index) => {
    const entry = team[index];
    return entry
      ? teamSlot(entry, index === 0, size, index === 0)
      : pixelEmptyPartySlot();
  }).join('');
  const tiles =
    boxes.length > 0
      ? boxes.map((entry, index) => boxTile(entry, size, team.length === 0 && index === 0)).join('')
      : '<p class="px-empty px-wrap">Everybody you have is going.</p>';
  const cards = [...team.map((entry, index) => teamCard(entry, true, index === 0, entry.id === state.partnerId)), ...boxes.map((entry) => teamCard(entry, false, false, entry.id === state.partnerId))].join('');
  const nextRaid = pixelWindow(`<div class="px-party-slots">${slots}</div>`, {
    heading: 'Next raid',
    note: `${size} of ${MAX_RUN_PARTY}`,
    className: 'team-window',
  });
  const inBoxes = pixelWindow(`${pickerFindField()}<div class="px-mon-tiles px-scroll">${tiles}</div>${cards}`, {
    heading: 'In your boxes',
    note: `${boxes.length}`,
    className: 'team-window team-boxes',
  });
  return `<main class="px-body team-layout">${nextRaid}${inBoxes}</main>`;
}
