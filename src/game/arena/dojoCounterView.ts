/**
 * THE BATTLE ARENA's counter, as markup (`scenes/DojoCounterScene.ts` draws
 * it): first who to fight - today's regulars, each row saying the three they
 * bring, so nobody chooses a bout blind - then who to bring, from every box
 * (`ui/boxPicker.ts`), up to three, the clauses said on the row that breaks
 * them, and FIGHT at the foot. Phaser-free, so the words and the order are
 * tested without a browser.
 */
import type { Pokemon } from '../pokemon';
import { pickerFindField, pickerOrder, pickerRowAttributes, pickerRowNote, type PickerEntry } from '../ui/boxPicker';
import {
  COLUMN_MEASURES,
  escapeAttribute,
  pixelColumns,
  pixelCommitBar,
  pixelPokemonName,
  pixelTag,
  pixelWindow,
} from '../ui/pixelUi';
import { DOJO_LEVEL, DOJO_TEAM_SIZE, dojoRefusal } from './boutRules';
import { dojoClass, foeTeamLine, headRefusal, nextClass, STREAK_TO_CHALLENGE, streakOf, type DojoFoe } from './classes';
import { classOf, type DojoRecord } from './dojoRecord';

/** The note on the list's heading: how far along the run to the Black Belt, short enough for the side panel. */
export function classNote(record: DojoRecord | undefined): string {
  if (classOf(record) === 'master-ball' && record?.topped) {
    return 'Top class';
  }
  return `Run ${Math.min(streakOf(record).length, STREAK_TO_CHALLENGE)} of ${STREAK_TO_CHALLENGE}`;
}

/**
 * Who you can fight: the head of your class first - lit once a run of three
 * has earned him, and saying why not until then - then today's regulars at
 * your class's stage, each row saying the three they bring, so nobody chooses
 * a bout blind.
 */
export function opponentsBody(regulars: readonly DojoFoe[], head: DojoFoe, record: DojoRecord | undefined, chosen: string | null): string {
  const run = streakOf(record);
  const refusal = headRefusal(record);
  const cls = dojoClass(classOf(record));
  const headHelp =
    refusal ??
    (classOf(record) === 'master-ball' && record?.topped
      ? `${head.name} brings ${foeTeamLine(head)}. You have beaten him: this one is for sport.`
      : `${head.name} brings ${foeTeamLine(head)}. Beat him and ${nextClass(cls.id) ? `you are ${nextClass(cls.id)!.name} class` : 'nobody here is above you'}.`);
  const headRow = `<button class="px-row dojo-head" data-opponent="${escapeAttribute(head.id)}"${
    refusal ? ' aria-disabled="true"' : ''
  }${refusal === null && chosen === null ? ' data-cursor-start' : ''} data-help="${escapeAttribute(headHelp)}"><span class="px-row-main"><span class="px-row-line"><strong class="px-name">${
    head.name
  }</strong></span><small>${escapeAttribute(foeTeamLine(head))}</small></span>${
    refusal ? pixelTag(`${run.length} of ${STREAK_TO_CHALLENGE}`, 'risk') : pixelTag('Ready', 'good', true)
  }</button>`;
  const rows = regulars
    .map((foe, index) => {
      const inRun = run.includes(foe.id);
      const beaten = record?.beaten.includes(foe.id) === true;
      const help = inRun
        ? `${foe.name} is already in your run: beat somebody else to make it longer. ENTER to fight them anyway.`
        : `${foe.name} brings ${foeTeamLine(foe)}, all at Lv ${DOJO_LEVEL}. ENTER to fight them.`;
      return `<button class="px-row" data-opponent="${escapeAttribute(foe.id)}"${
        chosen === foe.id || (chosen === null && refusal !== null && index === 0) ? ' data-cursor-start' : ''
      } data-help="${escapeAttribute(help)}"><span class="px-row-main"><span class="px-row-line"><strong class="px-name">${
        foe.name
      }</strong></span><small>${escapeAttribute(foeTeamLine(foe))}</small></span>${
        inRun ? pixelTag('In run', 'good', true) : beaten ? pixelTag('Beaten', 'plain') : pixelTag('Fight', 'plain')
      }</button>`;
    })
    .join('');
  const list = `<h3 class="px-subheading">${escapeAttribute(cls.name)} class</h3>${headRow}<h3 class="px-subheading">In today · Lv ${DOJO_LEVEL}</h3>${rows}`;
  return `<main class="px-body">${pixelWindow(`<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.pokemon)}>${list}</div>`, {
    heading: 'Who will you fight?',
    note: classNote(record),
  })}</main>`;
}

/** Why a row may not join the side as it stands, or null: the clauses, and nothing else. */
export function joinRefusal(entry: PickerEntry, team: readonly Pokemon[]): string | null {
  return dojoRefusal(entry.pokemon, team);
}

/** What a row of the team list says when pointed at. */
export function memberHelp(entry: PickerEntry, inTeam: boolean, refusal: string | null): string {
  if (inTeam) {
    return `${entry.pokemon.name} fights at Lv ${DOJO_LEVEL} with its own moves. ENTER leaves it out.`;
  }
  return refusal ?? `${entry.pokemon.name} (from ${entry.box}) would fight at Lv ${DOJO_LEVEL}. ENTER brings it.`;
}

/**
 * The team list: who is chosen, in the order they go out, then everybody else
 * in every box - those who may join first - and the bar that starts the bout.
 */
export function teamBody(
  entries: readonly PickerEntry[],
  team: readonly string[],
  opponent: DojoFoe,
): string {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const chosen = team.flatMap((id) => {
    const entry = byId.get(id);
    return entry ? [entry] : [];
  });
  const side = chosen.map((entry) => entry.pokemon);
  const going = new Set(chosen.map((entry) => entry.id));
  const others = pickerOrder(
    entries.filter((entry) => !going.has(entry.id)),
    (entry) => (joinRefusal(entry, side) === null ? 2 : 1),
  );
  const row = (entry: PickerEntry, inTeam: boolean, first: boolean): string => {
    const refusal = inTeam ? null : joinRefusal(entry, side);
    const tag = inTeam
      ? pixelTag(chosen[0]?.id === entry.id ? 'Lead' : 'In', 'good', true)
      : refusal
        ? pixelTag(side.length >= DOJO_TEAM_SIZE ? 'Full' : 'No', 'risk')
        : pixelTag('Bring', 'plain');
    return `<button class="px-row${inTeam ? ' is-selected' : ''}" data-member="${escapeAttribute(entry.id)}" ${pickerRowAttributes(entry)}${
      first ? ' data-cursor-start' : ''
    }${refusal ? ' aria-disabled="true"' : ''} data-help="${escapeAttribute(memberHelp(entry, inTeam, refusal))}"><span class="px-row-main"><span class="px-row-line">${pixelPokemonName(
      entry.pokemon,
    )}</span><small>${pickerRowNote(entry, entry.pokemon.base.name.toUpperCase())}</small></span>${tag}</button>`;
  };
  const yours =
    chosen.length > 0
      ? chosen.map((entry, index) => row(entry, true, index === 0)).join('')
      : '<p class="px-empty px-wrap">Nobody yet. Bring up to three, one of each kind.</p>';
  const rest = others.map((entry, index) => row(entry, false, chosen.length === 0 && index === 0)).join('');
  const list = `${pickerFindField()}<h3 class="px-subheading">Your side</h3>${yours}<h3 class="px-subheading">In your boxes</h3>${rest}`;
  const ready = chosen.length > 0;
  const fight = `<button class="px-window px-button is-primary" data-fight${ready ? '' : ' aria-disabled="true"'} data-help="${escapeAttribute(
    ready
      ? `Fight ${opponent.name}: ${chosen.length} a side at Lv ${DOJO_LEVEL}, no bag. Nothing you bring can be hurt.`
      : 'Bring at least one first.',
  )}">Fight</button>`;
  return `<main class="px-body dojo-team-layout">${pixelWindow(`<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.pokemon)}>${list}</div>`, {
    heading: `Against ${opponent.name}`,
    note: `${chosen.length} of ${DOJO_TEAM_SIZE}`,
  })}${pixelCommitBar({
    title: `${chosen.length || 'None'} vs ${Math.max(1, chosen.length)} · Lv ${DOJO_LEVEL}`,
    actions: fight,
  })}</main>`;
}

/**
 * The team the counter opens on: whoever the player brought last time, else
 * the next raid's bench, keeping only those the clauses allow, up to three.
 */
export function openingTeam(entries: readonly PickerEntry[], wanted: readonly string[]): readonly string[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const team: Pokemon[] = [];
  const ids: string[] = [];
  for (const id of wanted) {
    const entry = byId.get(id);
    if (entry && dojoRefusal(entry.pokemon, team) === null) {
      team.push(entry.pokemon);
      ids.push(id);
    }
  }
  return ids;
}
