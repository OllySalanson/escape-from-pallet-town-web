/**
 * Everything about one Pokemon, in the pane under the list it is named in.
 *
 * PR #149 deleted the summary *screen* by putting this under the stash's list:
 * a row is the two lines that tell one Pokemon from another, and the portrait,
 * condition, experience, stats, moves and whatever deeds the screen offers are
 * the pane the cursor fills as it walks. The raid's own party screen asks
 * exactly the same question of exactly the same object, so it is drawn by this
 * rather than by a second copy that can drift - which is what the in-raid
 * screens had done from the older rounded language: two shapes for one fact.
 *
 * Phaser-free and DOM-free, like every other module in here: it is a string, so
 * what it says is testable without a browser.
 *
 * Every control in the pane carries the pane's own `data-shows`, because the
 * cursor moving into it must not swap the pane out from under itself.
 */
import type { Pokemon } from '../pokemon';
import { conditionLine } from './condition';
import {
  escapeAttribute,
  pixelHpBar,
  pixelPortrait,
  pixelTypeBadge,
  pixelXpBar,
} from './pixelUi';
import {
  experienceBarFill,
  experienceLine,
  experienceProgress,
  formatExperience,
  moveSlotNote,
  moveSummary,
} from './pokemonSummary';

export interface DossierDeeds {
  /** The caps label over the chips: `Keeping` at base, `In the field` in a raid. */
  readonly label: string;
  /** The chips themselves, already marked up, each carrying `shows`. */
  readonly chips: (shows: string) => string;
}

export interface DossierView {
  readonly pokemon: Pokemon;
  /** What `data-shown-by` this pane answers to - the row's own `data-shows`. */
  readonly id: string;
  /** The first pane of a list is the one drawn before the cursor has moved. */
  readonly first: boolean;
  /** One line under the health bar. The stash says what the Pokemon Center would charge. */
  readonly condition?: string;
  /** What is carried, said in words. Defaults to the Pokemon's own held item. */
  readonly holding: string;
  readonly deeds: DossierDeeds;
}

/**
 * Five blocks laid across the pane - who, how, how far along, what it knows and
 * what can be done to it - which wrap and then scroll on a screen too narrow to
 * stand them side by side (`roomFor` in `columnLayout.ts`).
 */
export function pokemonDossier(view: DossierView): string {
  const { pokemon } = view;
  const progress = experienceProgress(pokemon);
  const shows = `data-shows="${escapeAttribute(view.id)}"`;
  const stats: readonly (readonly [string, number])[] = [
    ['Attack', pokemon.stats.attack],
    ['Defense', pokemon.stats.defense],
    ['Sp. Atk', pokemon.stats.spAttack],
    ['Sp. Def', pokemon.stats.spDefense],
    ['Speed', pokemon.stats.speed],
  ];
  const figure = `<div class="px-dossier-figure">${pixelPortrait(pokemon.base.dexId, pokemon.base.name)}<div class="summary-types">${pixelTypeBadge(pokemon.base.primaryType)}${pokemon.base.secondaryType ? pixelTypeBadge(pokemon.base.secondaryType) : ''}</div></div>`;
  const vitals = `<div class="px-dossier-vitals"><span class="px-row-line"><strong class="px-name">${pokemon.base.name}</strong><small>Lv ${pokemon.level}</small></span>${pixelHpBar(pokemon.currentHp, pokemon.maxHp)}<small class="px-wrap">${view.condition ?? conditionLine(pokemon)}</small><small class="px-wrap">${view.holding}</small></div>`;
  const growth = `<div class="px-dossier-growth"><small class="px-label">Experience</small>${pixelXpBar(experienceBarFill(progress), `Experience ${formatExperience(progress.intoLevel)} of ${formatExperience(progress.levelSpan)}`)}<small class="px-wrap">${experienceLine(progress)}</small><small class="px-label">Stats</small><dl class="summary-stats">${stats
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
    .join('')}</dl></div>`;
  // A move is a row the cursor rests on to be told what it does, and nothing
  // else: it explains itself in the help bar, where every row on these screens
  // does, rather than in a second detail pane inside a detail pane.
  const moves = pokemon.moves.length
    ? pokemon.moves
        .map((move) => {
          const summary = moveSummary(move);
          return `<button class="px-row" ${shows} aria-disabled="true" data-help="${escapeAttribute(`${summary.detail}. ${summary.description}`)}"><span class="px-row-main"><span class="px-row-line"><strong class="px-name">${summary.name}</strong>${pixelTypeBadge(summary.type)}</span></span><span class="px-tag">${summary.pp}/${summary.maxPp}</span></button>`;
        })
        .join('')
    : '<p class="px-empty">No moves known.</p>';
  const moveList = `<div class="px-dossier-moves"><small class="px-label">Moves · ${moveSlotNote(pokemon.moves.length)}</small><div class="px-list">${moves}</div></div>`;
  return `<div class="px-detail px-scroll px-dossier" data-shown-by="${escapeAttribute(view.id)}"${view.first ? '' : ' hidden'}><div class="px-dossier-body">${figure}${vitals}${growth}${moveList}<div class="px-dossier-deeds"><small class="px-label">${view.deeds.label}</small><div class="care-options">${view.deeds.chips(shows)}</div></div></div></div>`;
}
