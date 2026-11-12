/**
 * THE POKéDEX: every one of Kanto's 151 in its own order, on X anywhere in the
 * harbour and on Oak's PC in his lab (`scenes/PokedexScene.ts`).
 *
 * It is drawn the way the menu overhaul draws a collection
 * (`docs/screens/menu-overhaul/`), and it is FireRed's Pokédex in what it
 * knows: a kind the save has **owned** is its party icon in colour, one it has
 * only **met** in a fight is that icon as a silhouette, and one it has never
 * met is an empty Poké Ball - so how far along the Pokédex is, is a shape seen
 * from across the room and not a figure read off a line. A kind a shiny of
 * which has been owned carries FireRed's shiny star, and a legend owned stands
 * on gold. Over the grid is the count, drawn large, and a rail of Professor
 * Oak's seven milestones with the next one's reward standing at its end as the
 * thing to reach (`hub/pokedex.ts`).
 *
 * ENTER opens a kind's page, which is FireRed's entry: the front sprite large,
 * its number and name, what it is a kind of, its types, its size and the
 * cartridge's own words (`pokemon/generated/pokedexEntries.ts`) - and under
 * them where it is found in *this* game, asked of the game's own data
 * (`hub/pokedexSources.ts`), so a page never names a place that is not there.
 * As in FireRed, a kind only met gives up its name, its cry and where it
 * lives; the rest of the page is filled in by owning one.
 *
 * Phaser-free and pure strings, so what a tile is, what a page says and where
 * the arrow keys go are tested without a browser.
 */
import {
  KANTO_POKEDEX_SIZE,
  POKEDEX_MILESTONES,
  dexStanding,
  dueMilestone,
  nextMilestone,
  type DexStanding,
  type Pokedex,
  type PokedexMilestone,
} from '../hub/pokedex';
import { sourceLines, sourcesOf, sourcesReady } from '../hub/pokedexSources';
import { getItemById } from '../items/items';
import { POKEDEX_ENTRIES } from '../pokemon/generated/pokedexEntries';
import { evolutionFamily } from '../pokemon/evolution';
import type { PokemonBase } from '../pokemon/PokemonBase';
import { ALL_SPECIES } from '../pokemon/species';
import { isLegendaryKind } from '../world/legends';
import { itemIcon } from './icons';
import { pixelMonIconForDex } from './monIcon';
import { escapeAttribute, pixelPortrait, pixelShinyStar, pixelTag, pixelTypeBadge, pixelWindow } from './pixelUi';

/** What the screen is drawn from: the save's Pokédex and the milestones Oak has paid. */
export interface PokedexViewState {
  readonly dex: Pokedex;
  /** `raidProgress.pokedexRewards`: the milestones already handed over. */
  readonly claimed: readonly number[];
}

/** The kind with this dex number. The roster is in dex order, 1 to 151. */
export function kindAt(dexId: number): PokemonBase | undefined {
  return ALL_SPECIES[dexId - 1];
}

/** "No. 025", as FireRed numbers a page. */
export function dexNumber(dexId: number): string {
  return `No. ${String(dexId).padStart(3, '0')}`;
}

const typesOf = (kind: PokemonBase): readonly string[] =>
  [kind.primaryType, kind.secondaryType].filter((type): type is NonNullable<typeof type> => Boolean(type));

/** What the help bar says of a tile: its number always, and its name once it has been met. */
export function dexTileHelp(dexId: number, standing: DexStanding, shiny = false): string {
  const kind = kindAt(dexId);
  if (!kind || standing === 'unknown') {
    return `${dexNumber(dexId)} · Not met yet.`;
  }
  const name = kind.name.toUpperCase();
  if (standing === 'seen') {
    return `${dexNumber(dexId)} ${name} · Met, not owned yet. ENTER opens its page.`;
  }
  return `${dexNumber(dexId)} ${name} · ${typesOf(kind).join(' / ').toUpperCase()}${shiny ? ' · Shiny owned' : ''}. ENTER opens its page.`;
}

/** What a screen reader and a driver are told a tile is. */
function tileLabel(dexId: number, standing: DexStanding, shiny: boolean): string {
  const kind = kindAt(dexId);
  const known = standing === 'unknown' || !kind ? 'not met' : `${kind.name}, ${standing === 'owned' ? 'owned' : 'met'}`;
  return `${dexNumber(dexId)}, ${known}${shiny ? ', shiny owned' : ''}`;
}

/** One kind in the grid: its icon in colour, its silhouette, or an empty ball. */
export function dexTile(dex: Pokedex, dexId: number, first = false): string {
  const kind = kindAt(dexId);
  const standing = dexStanding(dex, dexId);
  const shiny = standing === 'owned' && dex.shiny.includes(dexId);
  const legend = kind !== undefined && isLegendaryKind(kind.id);
  const classes = ['dex-tile', `is-${standing}`, ...(shiny ? ['is-shiny'] : []), ...(legend ? ['is-legend'] : [])].join(' ');
  const picture =
    standing === 'unknown' || !kind
      ? '<span class="dex-ball" aria-hidden="true"></span>'
      : pixelMonIconForDex(dexId, kind.name);
  return `<button type="button" class="${classes}" data-dex="${dexId}" aria-label="${escapeAttribute(tileLabel(dexId, standing, shiny))}"${first ? ' data-cursor-start' : ''} data-help="${escapeAttribute(dexTileHelp(dexId, standing, shiny))}">${picture}${shiny ? pixelShinyStar() : ''}</button>`;
}

/** How a milestone stands: handed over, reached and waiting on Oak, the next to reach, or further off. */
export type MilestoneStanding = 'paid' | 'due' | 'next' | 'ahead';

export function milestoneStanding(milestone: PokedexMilestone, owned: number, claimed: readonly number[]): MilestoneStanding {
  if (claimed.includes(milestone.kinds)) {
    return 'paid';
  }
  if (milestone.kinds <= owned) {
    return 'due';
  }
  return nextMilestone(owned)?.kinds === milestone.kinds ? 'next' : 'ahead';
}

/** A reward as the things themselves: each item's icon, counted when there is more than one. */
function rewardIcons(milestone: PokedexMilestone): string {
  return milestone.reward
    .map(({ itemId, quantity }) => {
      const name = getItemById(itemId)?.displayName ?? itemId;
      return `<span class="dex-reward">${itemIcon(itemId, name)}${quantity > 1 ? `<small>×${quantity}</small>` : ''}</span>`;
    })
    .join('');
}

/**
 * The thing to reach, at the end of the rail: what Oak is holding now if a
 * milestone is reached and unpaid, else the next one's reward and how many
 * kinds short of it the save is, else that the Pokédex is complete.
 */
export function dexGoal(state: PokedexViewState): string {
  const owned = state.dex.owned.length;
  const due = dueMilestone(owned, state.claimed);
  if (due) {
    return `<div class="dex-goal is-due"><span class="dex-goal-words">${pixelTag('Oak has a reward', 'secure')}<small>See him in his lab</small></span><span class="dex-rewards">${rewardIcons(due)}</span></div>`;
  }
  const next = nextMilestone(owned);
  if (!next) {
    return `<div class="dex-goal is-complete"><span class="dex-goal-words">${pixelTag('Complete', 'secure', true)}<small>All ${KANTO_POKEDEX_SIZE} owned</small></span></div>`;
  }
  const short = next.kinds - owned;
  return `<div class="dex-goal"><span class="dex-goal-words"><strong>At ${next.kinds}</strong><small>${short} to go</small></span><span class="dex-rewards">${rewardIcons(next)}</span></div>`;
}

/**
 * The band over the grid: the count drawn large, how many more have been met,
 * the rail of the seven milestones filled as far as the count has come, and
 * the thing to reach.
 */
export function dexBand(state: PokedexViewState): string {
  const owned = state.dex.owned.length;
  const seen = state.dex.seen.length;
  const pips = POKEDEX_MILESTONES.map(
    (milestone) =>
      `<i class="dex-pip is-${milestoneStanding(milestone, owned, state.claimed)}" style="--at:${milestone.kinds}" title="${milestone.kinds}"></i>`,
  ).join('');
  const rail = `<div class="dex-rail" role="img" aria-label="${escapeAttribute(`${owned} of ${KANTO_POKEDEX_SIZE} kinds owned`)}" style="--owned:${owned}"><span class="dex-rail-fill"></span>${pips}</div>`;
  const count = `<div class="dex-count"><span class="dex-count-big" data-dex-owned="${owned}" style="--digits:${String(owned).length}"><span>${owned}</span></span><span class="dex-count-words"><span>of ${KANTO_POKEDEX_SIZE} owned</span><small>${seen} met</small></span></div>`;
  return pixelWindow(`${count}${rail}${dexGoal(state)}`, { className: 'dex-band', tag: 'div' });
}

/** The entry's words run together: the cartridge breaks its lines for its own box, and this window wraps its own. */
function entryText(dexId: number): string {
  return (POKEDEX_ENTRIES[dexId - 1]?.text ?? '').replace(/\s*\n\s*/g, ' ');
}

/** "0.4 m", from decimetres. */
export const heightWords = (heightDm: number): string => `${(heightDm / 10).toFixed(1)} m`;
/** "6.0 kg", from hectograms. */
export const weightWords = (weightHg: number): string => `${(weightHg / 10).toFixed(1)} kg`;

/** The figure of a page: the sprite, and beside it the shiny one once a shiny has been owned. */
function entryFigure(kind: PokemonBase, standing: DexStanding, shiny: boolean): string {
  const plain = `<span class="dex-figure${standing === 'seen' ? ' is-silhouette' : ''}">${pixelPortrait(kind.dexId, kind.name)}</span>`;
  const other = shiny ? `<span class="dex-figure is-shiny">${pixelPortrait(kind.dexId, kind.name, true)}${pixelShinyStar()}</span>` : '';
  return `<div class="dex-figures">${plain}${other}</div>`;
}

/**
 * What a page says about a kind, as the two halves both the page and the card
 * beside the grid are built from: who it is, and its words.
 */
function entryParts(
  dex: Pokedex,
  dexId: number,
  /** False leaves the places out when they have not been worked out yet: the card never waits on them. */
  askWhere = true,
): { readonly head: string; readonly words: string; readonly where: readonly string[] } | undefined {
  const kind = kindAt(dexId);
  const standing = dexStanding(dex, dexId);
  const entry = POKEDEX_ENTRIES[dexId - 1];
  if (!kind || !entry || standing === 'unknown') {
    return undefined;
  }
  const owned = standing === 'owned';
  const shiny = owned && dex.shiny.includes(dexId);
  const name = `<span class="px-row-line"><small>${dexNumber(dexId)}</small><strong class="px-name">${escapeAttribute(kind.name)}</strong>${shiny ? pixelShinyStar() : ''}</span>`;
  const category = `<small class="dex-category">${owned ? escapeAttribute(entry.category) : '?????'} POKéMON</small>`;
  const types = owned
    ? `<span class="px-row-line dex-types">${typesOf(kind).map((type) => pixelTypeBadge(type)).join('')}</span>`
    : '';
  const size = `<span class="px-row-line dex-size"><small>HT</small><span>${owned ? heightWords(entry.heightDm) : '???'}</span><small>WT</small><span>${owned ? weightWords(entry.weightHg) : '???'}</span></span>`;
  const state = owned ? '' : pixelTag('Met, not owned', 'risk');
  return {
    head: `<div class="dex-entry-head">${name}${category}${types}${size}${state}</div>`,
    words: owned ? escapeAttribute(entryText(dexId)) : 'Own one, and its page fills in.',
    where: askWhere || sourcesReady() ? sourceLines(sourcesOf(kind.id)) : [],
  };
}

/**
 * The card beside the grid in a window wide enough for one (`data-room='wide'`):
 * the kind under the cursor, big, as FireRed's PC box shows the one pointed
 * at. Written into its pane as the cursor moves, never a redraw
 * (`PokedexScene.showCard`). An empty ball's card says only its number.
 */
export function dexCard(dex: Pokedex, dexId: number): string {
  const kind = kindAt(dexId);
  const parts = entryParts(dex, dexId, false);
  if (!kind || !parts) {
    return `<div class="dex-card-figure"><span class="dex-ball is-big" aria-hidden="true"></span></div><div class="dex-entry-head"><span class="px-row-line"><small>${dexNumber(dexId)}</small><strong class="px-name">?????</strong></span><small class="px-wrap">Not met yet. A fight with one puts its shape here.</small></div>`;
  }
  const standing = dexStanding(dex, dexId);
  const where = parts.where
    .slice(0, CARD_WHERE_LINES)
    .map((line) => `<small class="px-wrap">${escapeAttribute(line)}</small>`)
    .join('');
  return `<div class="dex-card-figure">${entryFigure(kind, standing, standing === 'owned' && dex.shiny.includes(dexId))}</div>${parts.head}<p class="px-wrap dex-card-words">${parts.words}</p>${where ? `<div class="dex-card-where">${where}</div>` : ''}`;
}

/** How many of a kind's places the card names; its page names them all. */
export const CARD_WHERE_LINES = 3;

/** A tile's side in game pixels: the 32-pixel icon and a pixel of frame all round. */
export const DEX_TILE = 34;
/** The most room a tile is ever given: past this the grid reads as scattered. */
export const DEX_TILE_MOST = 48;

/**
 * How big a tile is drawn in a pane this many game pixels across and down: the
 * most room each can have with all 151 still in view, so a big window is spent
 * on the grid and not on backdrop under it. In a pane too small to show them
 * all at `DEX_TILE` they stay that size, and the pane scrolls.
 */
export function dexPitch(paneWidth: number, paneHeight: number): number {
  for (let pitch = DEX_TILE_MOST; pitch > DEX_TILE; pitch -= 1) {
    const columns = Math.floor(paneWidth / pitch);
    if (columns > 0 && Math.ceil(KANTO_POKEDEX_SIZE / columns) * pitch <= paneHeight) {
      return pitch;
    }
  }
  return DEX_TILE;
}

/** The grid's screen: the band, every tile, and the card's pane. */
export function dexListBody(state: PokedexViewState, cursor: number): string {
  const tiles = Array.from({ length: KANTO_POKEDEX_SIZE }, (_, index) => dexTile(state.dex, index + 1, index + 1 === cursor)).join('');
  const grid = pixelWindow(`<div class="dex-tiles px-scroll" data-describe-group>${tiles}</div>`, {
    className: 'dex-window',
    tag: 'section',
  });
  const card = pixelWindow(`<div class="dex-card-body" data-dex-card>${dexCard(state.dex, cursor)}</div>`, {
    className: 'dex-card',
    tag: 'section',
  });
  return `<main class="px-body dex-layout">${dexBand(state)}<div class="dex-main" data-dex-main>${grid}${card}</div></main>`;
}

/**
 * The next kind with a page from here, the way an arrow points: a page is
 * turned to the next kind the save has met, and past either end it stays.
 */
export function neighbourPage(dex: Pokedex, dexId: number, step: 1 | -1): number {
  for (let at = dexId + step; at >= 1 && at <= KANTO_POKEDEX_SIZE; at += step) {
    if (dexStanding(dex, at) !== 'unknown') {
      return at;
    }
  }
  return dexId;
}

/**
 * A kind's line, in dex order, as the grid draws each of them: its own place
 * lit, what it comes from and grows into in colour, as a shape or as an empty
 * ball by how well the save knows them. Nothing for a kind with no line.
 */
export function dexFamily(dex: Pokedex, kind: PokemonBase): string {
  const family = [...evolutionFamily(kind.id)].sort((a, b) => a.dexId - b.dexId);
  if (family.length < 2) {
    return '';
  }
  return `<div class="dex-family">${family
    .map((member) => {
      const standing = dexStanding(dex, member.dexId);
      const picture =
        standing === 'unknown'
          ? '<span class="dex-ball" aria-hidden="true"></span>'
          : pixelMonIconForDex(member.dexId, member.name);
      const label = standing === 'unknown' ? `${dexNumber(member.dexId)}, not met` : `${member.name}, ${standing === 'owned' ? 'owned' : 'met'}`;
      return `<span class="dex-kin is-${standing}${member.dexId === kind.dexId ? ' is-here' : ''}" role="img" aria-label="${escapeAttribute(label)}">${picture}</span>`;
    })
    .join('')}</div>`;
}

/** What the page's help bar says. */
export const ENTRY_HINTS = 'LEFT and RIGHT turn the page · ENTER hears its cry · ESC back to the list';

/** A kind's own page. Undefined for one never met: an empty ball has no page. */
export function dexEntryBody(dex: Pokedex, dexId: number): string | undefined {
  const kind = kindAt(dexId);
  const parts = entryParts(dex, dexId);
  if (!kind || !parts) {
    return undefined;
  }
  const standing = dexStanding(dex, dexId);
  const shiny = standing === 'owned' && dex.shiny.includes(dexId);
  const legend = isLegendaryKind(kind.id);
  const figure = pixelWindow(`${entryFigure(kind, standing, shiny)}${parts.head}`, {
    className: `dex-entry-figure${legend ? ' is-legend' : ''}`,
    tag: 'section',
  });
  const where =
    parts.where.length > 0
      ? parts.where.map((line) => `<p class="px-wrap">${escapeAttribute(line)}</p>`).join('')
      : '<p class="px-wrap">Nowhere it is known to live.</p>';
  const family = dexFamily(dex, kind);
  const windows = [
    pixelWindow(`<p class="px-wrap dex-entry-text">${parts.words}</p>`, { heading: 'Entry', className: 'dex-entry-words' }),
    ...(family ? [pixelWindow(family, { heading: 'Family', className: 'dex-entry-family' })] : []),
    pixelWindow(`<div class="dex-where px-scroll">${where}</div>`, { heading: 'Where to find one', className: 'dex-entry-where' }),
  ].join('');
  const before = neighbourPage(dex, dexId, -1);
  const after = neighbourPage(dex, dexId, 1);
  const turn = (to: number, label: string): string =>
    `<button type="button" class="px-window px-button" data-dex-turn="${to}"${to === dexId ? ' aria-disabled="true"' : ''} data-help="${escapeAttribute(to === dexId ? 'No page that way yet.' : `${dexNumber(to)} ${kindAt(to)?.name.toUpperCase() ?? ''}`)}">${label}</button>`;
  const actions = `${turn(before, 'Back a page')}<button type="button" class="px-window px-button is-primary" data-dex-cry="${dexId}" data-cursor-start data-help="${escapeAttribute(`Hear ${kind.name.toUpperCase()}'s cry.`)}">Cry</button>${turn(after, 'On a page')}`;
  return `<main class="px-body dex-entry" data-dex-page="${dexId}">${figure}<div class="dex-entry-side">${windows}<div class="dex-entry-actions">${actions}</div></div></main>`;
}
