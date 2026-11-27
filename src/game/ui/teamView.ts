/**
 * YOUR TEAM: who goes on the next raid, picked from THE CHEST anywhere in the
 * harbour on P (`scenes/TeamScene.ts`).
 *
 * Pokémon are kept in THE CHEST, and where a Pokémon is kept is never a
 * reason to walk somewhere: so this shows the team first - the bench the Raid
 * Arena will open on - and then everybody else, fit to fight first and highest
 * level first, with a find over it.
 * The raid's P is the party; at home it is the same question asked before the
 * raid.
 *
 * It is drawn as FireRed draws a party and a PC box, not as a list (the menu
 * overhaul, `docs/screens/menu-overhaul/`): the team is six slots, two abreast
 * as HeartGold's touch screen has them, the lead's in gold and an empty one a
 * dim Poké Ball, so how many are going is seen rather than counted; the rest
 * are a grid of FireRed's party icons, each flapping at its own health's pace
 * (`monIcon.ts`) over its level and a short health bar; and everything else
 * about the one under the cursor - its portrait, its types, its health in
 * figures, where it is - is the one card at the foot, so the words are there for
 * one Pokémon at a time and never for thirty.
 *
 * Phaser-free, so the order and the words are tested without a browser.
 */
import { getHeldItem } from '../items';
import { MAX_RUN_PARTY, faintedRefusal } from '../hub/deploymentFlow';
import { publicAssetUrl } from '../publicAssetUrl';
import { ABLE_TO_FIGHT, pickerFindField, pickerOrder, pickerRowAttributes, type PickerEntry } from './boxPicker';
import { itemIcon } from './icons';
import { pixelMonIcon, pixelMonTile } from './monIcon';
import { STAT_BAR_TOP, escapeAttribute, pixelHpBar, pixelPokemonName, pixelPortrait, pixelStatBar, pixelTypeBadge } from './pixelUi';
import { experienceProgress, formatExperience } from './pokemonSummary';

export interface TeamViewState {
  /** Every Pokémon kept (`pickerEntries`). */
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

/** The keys the panel answers, on its hint bar: L is the lead (`TeamScene.lead`). */
export const TEAM_HINTS = 'ARROWS move · ENTER take or leave · L lead · FIND a name · ESC back';
/**
 * The same line where L would do nothing - the cursor on the lead already, or
 * on no Pokémon - so it is not taught there: the touch pad offers a screen's
 * letter keys as its help line names them, and LEAD stood on the pad doing
 * nothing (the mobile lane, 25 Nov 2026).
 */
export const TEAM_HINTS_NO_LEAD = 'ARROWS move · ENTER take or leave · FIND a name · P close';

/** Said once a Pokémon is put in front. */
export function leadLine(name: string): string {
  return `${name} leads now: out first in every fight.`;
}

/** Said when ENTER would leave the team empty: nobody is ever left with no team (playtest wave 3, finding 11). */
// Not "Take another first": said to a player whose only Pokémon it is, there
// is no other to take (the harbour critic tour, 26 Nov 2026).
export const LAST_ONE_STAYS = 'Somebody has to go, so it stays.';

/** What the help bar says of a slot or a tile, and the status line after it is pressed: short, because the card says the rest. */
export function teamRowHelp(entry: PickerEntry, going: boolean, lead: boolean, size: number): string {
  const name = entry.pokemon.name;
  if (going && size === 1) {
    return `${name} is the whole team, so it always goes.`;
  }
  if (going) {
    return lead ? `${name} leads. ENTER leaves it at home.` : `${name} is going. ENTER leaves it at home, L puts it in front.`;
  }
  if (entry.pokemon.isFainted) {
    return faintedRefusal(name);
  }
  if (size >= MAX_RUN_PARTY) {
    return `The team is full (${MAX_RUN_PARTY}). Leave somebody at home first.`;
  }
  return `ENTER takes ${name} on the next raid.`;
}

/** The words a slot or a tile is read by, for a screen reader and a driver: who, and how strong. */
function spokenName(entry: PickerEntry): string {
  return `${entry.pokemon.name}, level ${entry.pokemon.level}`;
}

/** The green rosette the partner wears: the one Pokémon a wipe can never take. */
export function partnerRosette(): string {
  return '<span class="px-rosette" role="img" aria-label="Partner" title="Partner"></span>';
}

/**
 * The card for the one under the cursor: its name and types on the strip, its
 * health, its five stats and how far to its next level as bars, its moves as
 * type chips, and what ENTER and L do to it. The only place its words are.
 */
/**
 * A Pokémon's figures, as a card shows them: its health, its five stats and
 * how far to its next level as bars, and its moves as type chips. YOUR TEAM's
 * card and THE CHEST's both stand on it, so the two never drift.
 */
export function pokemonCardFigures(pokemon: PickerEntry['pokemon']): string {
  const { stats } = pokemon;
  const top = Math.max(STAT_BAR_TOP, stats.attack, stats.defense, stats.spAttack, stats.spDefense, stats.speed);
  const progress = experienceProgress(pokemon);
  const next = progress.atTopOfCurve
    ? '<span class="px-stat"><span>NEXT LV</span><span class="px-stat-n">TOP</span></span>'
    : pixelStatBar('NEXT LV', progress.intoLevel, progress.levelSpan, 'is-xp').replace(
        `<span class="px-stat-n">${progress.intoLevel}</span>`,
        `<span class="px-stat-n">${formatExperience(progress.intoLevel)}/${formatExperience(progress.levelSpan)}</span>`,
      );
  const moves = pokemon.moves
    .map((move) => `<span class="px-type px-type-${move.base.type.toLowerCase()} team-move">${escapeAttribute(move.base.name)}</span>`)
    .join('');
  const tone = pokemon.currentHp / Math.max(1, pokemon.maxHp) > 0.5 ? 'is-hp' : pokemon.currentHp / Math.max(1, pokemon.maxHp) > 0.2 ? 'is-hp-low' : 'is-hp-red';
  return pixelStatBar('HP', pokemon.currentHp, pokemon.maxHp, tone).replace(
    `<span class="px-stat-n">${pokemon.currentHp}</span>`,
    `<span class="px-stat-n">${pokemon.currentHp}/${pokemon.maxHp}</span>`,
  )
    + pixelStatBar('ATTACK', stats.attack, top)
    + pixelStatBar('DEFENCE', stats.defense, top)
    + pixelStatBar('SP. ATK', stats.spAttack, top)
    + pixelStatBar('SP. DEF', stats.spDefense, top)
    + pixelStatBar('SPEED', stats.speed, top)
    + next
    + `<div class="team-moves">${moves}</div>`;
}

/** A Pokémon's types, as the badges a card's strip carries. */
export function pokemonTypeBadges(pokemon: PickerEntry['pokemon']): string {
  return [pokemon.base.primaryType, pokemon.base.secondaryType]
    .filter((type): type is NonNullable<typeof type> => Boolean(type))
    .map((type) => pixelTypeBadge(type))
    .join('');
}

function teamCard(entry: PickerEntry, going: boolean, partner: boolean, size: number): string {
  const { pokemon } = entry;
  const held = getHeldItem(pokemon.heldItemId);
  // Why it cannot go, when it cannot. What ENTER and L do to it is on the help
  // line under the screen (`teamRowHelp`), and was said here as well, in keys
  // too wide for the card: two of them made it wider than its frame and
  // taller than the stage.
  const deeds = going ? [] : pokemon.isFainted ? ['<span class="team-key is-off">Fainted</span>'] : size >= MAX_RUN_PARTY ? ['<span class="team-key is-off">Team full</span>'] : [];
  // Where it is and what it holds, apart: a small window shows only what it holds, beside its speed.
  const where = `<span class="team-card-place">${going ? 'Next raid' : 'In the chest'}</span>${held ? `<span class="team-card-held">${itemIcon(held.id, held.displayName)}${escapeAttribute(held.displayName)}</span>` : ''}`;
  return `<section class="px-window team-card" data-shown-by="${escapeAttribute(entry.id)}" hidden>`
    + `<header class="px-heading"><span>${partner ? partnerRosette() : ''}${pixelPokemonName(pokemon)}<span class="team-card-level">LV${pokemon.level}</span></span><small>${pokemonTypeBadges(pokemon)}</small></header>`
    + pokemonCardFigures(pokemon)
    + `<footer class="team-card-foot"><small class="team-card-where">${where}</small><span class="team-keys">${deeds.join('')}</span></footer>`
    + '</section>';
}

/**
 * One of the team, standing big on the battle field's own grass, as it stands
 * in a fight: its front sprite on a platform, its plate under it - name, level
 * and health - and the partner's rosette. The lead stands first.
 */
function teamStand(entry: PickerEntry, index: number, size: number, partner: boolean): string {
  const { pokemon } = entry;
  const lead = index === 0;
  const attributes = `data-member="${escapeAttribute(entry.id)}" data-shows="${escapeAttribute(entry.id)}" aria-label="${escapeAttribute(spokenName(entry))}"${lead ? ' data-cursor-start' : ''} data-help="${escapeAttribute(teamRowHelp(entry, true, lead, size))}"`;
  return `<button class="team-stand${pokemon.isFainted ? ' is-fainted' : ''}${index % 2 === 1 && size > 3 ? ' is-back' : ''}" ${attributes}>`
    + `<img class="team-platform" src="${publicAssetUrl('assets/battle/platform.png')}" alt="" aria-hidden="true" />`
    + pixelPortrait(pokemon.base.dexId ?? 0, pokemon.name, pokemon.shiny)
    + `<span class="team-plate">${partner ? partnerRosette() : ''}${lead && size > 1 ? '<span class="team-plate-lead">Lead</span>' : ''}<span class="team-plate-name">${pixelPokemonName(pokemon)}</span><span class="team-plate-level">LV${pokemon.level}</span>${pixelHpBar(pokemon.currentHp, pokemon.maxHp, 24)}</span>`
    + '</button>';
}

/** One in a box: the icon at its pace, its name and level, as the PC box stands them. */
function boxTile(entry: PickerEntry, size: number, first: boolean, partner: boolean): string {
  const disabled = entry.pokemon.isFainted || size >= MAX_RUN_PARTY;
  return pixelMonTile(entry.pokemon, {
    classes: ['team-box-tile'],
    attributes: `data-member="${escapeAttribute(entry.id)}" data-shows="${escapeAttribute(entry.id)}" ${pickerRowAttributes(entry)} aria-label="${escapeAttribute(spokenName(entry))}"${first ? ' data-cursor-start' : ''}${disabled ? ' aria-disabled="true"' : ''} data-help="${escapeAttribute(teamRowHelp(entry, false, false, size))}"`,
    line: `${partner ? partnerRosette() : ''}<span class="team-box-name">${escapeAttribute(entry.pokemon.name)}</span><span class="team-box-level">LV${entry.pokemon.level}</span>`,
  });
}

/** The title strip's pill: who is going, as their icons, and how many of six. */
export function teamPill(state: TeamViewState): string {
  const { team } = teamRows(state);
  return `${team.map((entry) => pixelMonIcon(entry.pokemon)).join('')}<span>${team.length} OF ${MAX_RUN_PARTY}</span>`;
}

/** The screen's body: the team on the stage, the card for the one under the cursor, and the boxes along the bottom. */
export function teamBody(state: TeamViewState): string {
  const { team, boxes } = teamRows(state);
  const size = team.length;
  const stands = team.map((entry, index) => teamStand(entry, index, size, entry.id === state.partnerId)).join('');
  const tiles =
    boxes.length > 0
      ? boxes.map((entry, index) => boxTile(entry, size, team.length === 0 && index === 0, entry.id === state.partnerId)).join('')
      : '<p class="px-empty px-wrap">Everybody you have is going.</p>';
  const cards = [
    ...team.map((entry) => teamCard(entry, true, entry.id === state.partnerId, size)),
    ...boxes.map((entry) => teamCard(entry, false, entry.id === state.partnerId, size)),
  ].join('');
  const stage = `<div class="team-stage"><div class="team-line" style="--stands:${Math.max(1, size)}">${stands}</div><div class="team-cards">${cards}</div></div>`;
  const inBoxes = `<section class="px-window team-boxes"><header class="px-heading"><span>In the chest</span><small>${boxes.length}</small></header>${pickerFindField()}<div class="px-mon-tiles px-scroll">${tiles}</div></section>`;
  return `<main class="px-body team-layout">${stage}${inBoxes}</main>`;
}
