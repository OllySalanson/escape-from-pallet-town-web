/**
 * THE BATTLE ARENA counter's three ways in, as markup (`scenes/DojoCounterScene.ts`
 * draws it): the first page - CLASS BOUTS, this week's CUP, today's RENTALS,
 * each row saying where the player stands in it - and the cup's list of who
 * goes. The cup's and the rentals' own pages are `arenaBoldView.ts`.
 * Phaser-free, so the words and the order are tested without a browser. The
 * class bouts' pages are `dojoCounterView.ts`.
 */
import type { Pokemon } from '../pokemon';
import { RENTAL_RUN_COMPLETE_TICKETS, RENTAL_WIN_TICKETS } from '../minigames/tickets';
import { kindIfNicknamed, pickerFindField, pickerOrder, pickerRowAttributes, pickerRowNote, type PickerEntry } from '../ui/boxPicker';
import {
  COLUMN_MEASURES,
  escapeAttribute,
  pixelColumns,
  pixelCommitBar,
  pixelPokemonName,
  pixelTag,
  pixelWindow,
} from '../ui/pixelUi';
import { DOJO_LEVEL, DOJO_TEAM_SIZE } from './boutRules';
import { dojoClass, STREAK_TO_CHALLENGE, streakOf } from './classes';
import { CUP_RUN_BOUTS, cupCopy, cupRefusal, cupSideProblem, cupWeek, type Cup, type CupFoe } from './cups';
import { classOf, type DojoRecord } from './dojoRecord';
import { liveRentalRun, nextRunScored, teamWords, pairToday } from './rentals';
import { RUN_BOUTS } from './runRecords';

/** The first page: the three ways to fight, each saying where the player stands in it. */
export function modesBody(record: DojoRecord | undefined, cup: Cup, now: Date): string {
  const cls = dojoClass(classOf(record));
  const week = cupWeek(record?.cup, now);
  const live = liveRentalRun(record?.rental, now);
  const row = (mode: string, name: string, line: string, tag: string, help: string, first: boolean): string =>
    `<button class="px-row px-tall" data-mode="${mode}"${first ? ' data-cursor-start' : ''} data-help="${escapeAttribute(help)}"><span class="px-row-main"><span class="px-row-line"><strong class="px-name">${name}</strong></span><small>${escapeAttribute(line)}</small></span>${tag}</button>`;
  const classLine =
    classOf(record) === 'master-ball' && record?.topped
      ? `${cls.name} class, top of the ladder.`
      : `${cls.name} class · run ${Math.min(streakOf(record).length, STREAK_TO_CHALLENGE)} of ${STREAK_TO_CHALLENGE}`;
  const rentalLine = live
    ? `Run going: ${live.won} of ${RUN_BOUTS}${live.scored ? '' : ' (practice)'} · ${teamWords(live.team)}`
    : `Borrow three of today's six. ${nextRunScored(record?.rental, now) ? "Today's run pays." : 'Practice: today has paid.'}`;
  const rows = [
    row('class', 'CLASS BOUTS', classLine, pixelTag(cls.name, 'plain'), `Fight the regulars of your class, three in a row, then its Black Belt. ${DOJO_TEAM_SIZE} a side at Lv ${DOJO_LEVEL}.`, true),
    row(
      'cup',
      cup.name,
      `${cup.rule} Lv ${cup.level} · this week ${week.run > 0 ? `${week.run} in a row` : `best ${week.best} of ${CUP_RUN_BOUTS}`}`,
      pixelTag(`${week.best}/${CUP_RUN_BOUTS}`, week.best >= CUP_RUN_BOUTS ? 'good' : 'plain', week.best >= CUP_RUN_BOUTS),
      `This week's rule: ${cup.rule} ${cup.teaches} Seven bouts in a row with your own Pokémon. Three pays 50 tickets, five 100, seven 200.`,
      false,
    ),
    row(
      'rental',
      'RENTALS',
      rentalLine,
      pixelTag(live ? `${live.won}/${RUN_BOUTS}` : 'Today', live ? 'good' : 'plain', live !== undefined),
      `Borrow three Pokémon, fight seven in a row, swap one after each win. A win pays ${RENTAL_WIN_TICKETS} tickets, and all seven ${RENTAL_RUN_COMPLETE_TICKETS} more. Today's pair: ${pairToday(now).why}`,
      false,
    ),
  ].join('');
  return `<main class="px-body">${pixelWindow(`<div class="px-list px-scroll">${rows}</div>`, {
    heading: 'How will you fight?',
    note: 'Lv 30 · no bag',
  })}</main>`;
}

// --- the cup ----------------------------------------------------------------------

/** What a row of the cup's team list says when pointed at. */
function cupMemberHelp(entry: PickerEntry, inTeam: boolean, refusal: string | null, cup: Cup): string {
  if (inTeam) {
    const moves = cupCopy(entry.pokemon, cup).moves.map((move) => move.base.name.toUpperCase());
    return `${entry.pokemon.name} fights at Lv ${cup.level} with ${moves.join(', ')}. ENTER leaves it out.`;
  }
  return refusal ?? `${entry.pokemon.name} (from ${entry.box}) keeps the ${cup.name}'s rule. ENTER brings it.`;
}

/** The cup's page: the rule, who is next, and who to bring, the cup's refusals said on each row. */
export function cupBody(entries: readonly PickerEntry[], team: readonly string[], cup: Cup, foe: CupFoe, bout: number): string {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const chosen = team.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  const side = chosen.map((entry) => entry.pokemon);
  const going = new Set(chosen.map((entry) => entry.id));
  const others = pickerOrder(
    entries.filter((entry) => !going.has(entry.id)),
    (entry) => (cupRefusal(entry.pokemon, side, cup) === null ? 2 : 1),
  );
  const row = (entry: PickerEntry, inTeam: boolean, first: boolean): string => {
    const refusal = inTeam ? null : cupRefusal(entry.pokemon, side, cup);
    const tag = inTeam
      ? pixelTag(chosen[0]?.id === entry.id ? 'Lead' : 'In', 'good', true)
      : refusal
        ? side.length >= DOJO_TEAM_SIZE
          ? pixelTag('Full', 'plain')
          : pixelTag('No', 'risk')
        : pixelTag('Bring', 'plain');
    return `<button class="px-row${inTeam ? ' is-selected' : ''}" data-member="${escapeAttribute(entry.id)}" ${pickerRowAttributes(entry)}${
      first ? ' data-cursor-start' : ''
    }${refusal ? ' aria-disabled="true"' : ''} data-help="${escapeAttribute(cupMemberHelp(entry, inTeam, refusal, cup))}"><span class="px-row-main"><span class="px-row-line">${pixelPokemonName(
      entry.pokemon,
    )}</span><small>${pickerRowNote(entry, kindIfNicknamed(entry.pokemon))}</small></span>${tag}</button>`;
  };
  const yours =
    chosen.length > 0
      ? chosen.map((entry, index) => row(entry, true, index === 0)).join('')
      : '<p class="px-empty px-wrap">Nobody yet.</p>';
  const rest = others.map((entry, index) => row(entry, false, chosen.length === 0 && index === 0)).join('');
  const rule = `<p class="px-wrap dojo-cup-rule">${escapeAttribute(cup.rule)}</p>`;
  const next = `<p class="px-wrap">${escapeAttribute(`Bout ${bout} of ${CUP_RUN_BOUTS}: ${foe.name} brings ${teamWords(foe.team)}.`)}</p>`;
  const list = `${rule}${next}${pickerFindField()}<h3 class="px-subheading">Your side</h3>${yours}<h3 class="px-subheading">In your boxes</h3>${rest}`;
  const problem = cupSideProblem(side, cup);
  const fight = `<button class="px-window px-button is-primary" data-fight${problem ? ' aria-disabled="true"' : ''} data-help="${escapeAttribute(
    problem ?? `Fight ${foe.name} under the ${cup.name}: ${chosen.length} a side at Lv ${cup.level}, no bag. Nothing you bring can be hurt.`,
  )}">Fight</button>`;
  return `<main class="px-body dojo-team-layout">${pixelWindow(`<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.pokemon)}>${list}</div>`, {
    heading: cup.name,
    note: `Bout ${bout} of ${CUP_RUN_BOUTS}`,
  })}${pixelCommitBar({
    title: problem ?? `${chosen.length} vs ${chosen.length} · Lv ${cup.level}`,
    actions: fight,
  })}</main>`;
}

/** The team the cup's page opens on: whoever was brought before, keeping only those the cup allows. */
export function openingCupTeam(entries: readonly PickerEntry[], wanted: readonly string[], cup: Cup): readonly string[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const side: Pokemon[] = [];
  const ids: string[] = [];
  for (const id of wanted) {
    const entry = byId.get(id);
    if (entry && cupRefusal(entry.pokemon, side, cup) === null) {
      side.push(entry.pokemon);
      ids.push(id);
    }
  }
  return ids;
}
