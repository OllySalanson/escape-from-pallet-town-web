import { escapeAttribute, pixelPortrait, pixelWindow } from './pixelUi';

/**
 * The moment a stone evolves a Pokemon outside a fight: the one it was
 * flickers into the one it became, as FireRed's evolution scene does, with
 * FireRed's own line under it.
 *
 * It used to be a status line on the list, spent by the next press, so a player
 * pressing ENTER through it saw nothing happen to the Pokemon they had just
 * spent a stone on (the characters bug hunt, 11 Nov 2026). The moment is a
 * screen of its own, held until it has been seen (`EVOLVE_MOMENT_ARMING_MS`)
 * and then ended by any key or its one button.
 */
export interface EvolveMomentView {
  readonly fromDexId: number;
  readonly fromName: string;
  readonly toDexId: number;
  readonly toName: string;
  readonly shiny: boolean;
  /** What is said: FireRed's congratulations, as `useFieldItem` words it. */
  readonly said: string;
}

/**
 * How long the moment ignores keys: the flicker runs for about a second and the
 * ENTER that used the stone is still coming up, so a press before this is the
 * player still pressing, not the player skipping.
 */
export const EVOLVE_MOMENT_ARMING_MS = 1_200;

/** The moment's body, for `pixelScreen`. `back` names where Carry on returns to. */
export function evolveMomentBody(view: EvolveMomentView, back: string): string {
  const stage = `<div class="evolve-moment" aria-hidden="true"><span class="evolve-moment-from">${pixelPortrait(view.fromDexId, view.fromName, view.shiny)}</span><span class="evolve-moment-to">${pixelPortrait(view.toDexId, view.toName, view.shiny)}</span></div>`;
  const words = `<p class="px-wrap evolve-moment-words"><strong class="px-name">${escapeAttribute(view.said)}</strong></p>`;
  const done = `<div class="px-grid-bar"><button class="px-window px-chip" data-moment-done data-help="${escapeAttribute(back)}">Carry on</button></div>`;
  return `<main class="px-body teach-moment-layout" data-evolve-moment>${pixelWindow(`${stage}${words}${done}`, {
    className: 'teach-moment-window px-tone-primary',
    heading: 'Evolution',
    note: 'Any key carries on',
  })}</main>`;
}
