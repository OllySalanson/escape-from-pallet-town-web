import { escapeAttribute } from './pixelUi';

/**
 * "How many?" - the one widget every quantity on a pixel-ui screen is asked
 * with: the loadout's pack, the secure container, Bill's shelf and his
 * table.
 *
 * It is the tutorial's `CountSelectorUI` (a +/- pair and a running total) made
 * to answer to this game's real limits. A quantity here is never just "at most
 * what is held": the pack is squares, the container is squares beside cargo,
 * and the shelf is a ration and a purse. So the caller works the ceiling out -
 * `DeploymentFlow.packLimit`, `secureLimit`, `traderStockLimit` - and hands it
 * over as `max`, and the widget is where that number is *said*: the plus stops
 * at it, a held key clamps to it, and the reason it is not higher is the
 * control's own help line. A player is never let to pick a number that is then
 * refused, and never left guessing why they cannot pick a bigger one.
 *
 * Keyboard first. Left and Right step by one while the cursor is on either end
 * of the control (they would otherwise only hop between the minus and the
 * plus), Shift or Page Up/Down steps by five, Home and End go to the ends. Up
 * and Down still move the cursor between rows, so a whole list can be filled
 * without the mouse. The markup is pure and so is the key rule; `HubScene`
 * wires the two, one `data-count` group at a time.
 */

/** How far Shift, Page Up and Page Down move a count. */
export const COUNT_BIG_STEP = 5;

export interface CountSelectorOptions {
  /** What is being counted, for the wiring: `item`, `secure`, `buy`, `barter`. */
  readonly kind: string;
  readonly id: string;
  /** What the player calls it, for the screen reader. */
  readonly label: string;
  readonly value: number;
  readonly min?: number;
  /** The most that can be chosen, already cut to every real limit. */
  readonly max: number;
  /** Said when the plus is inert: why `max` is not higher. */
  readonly limit: string;
  /** Said otherwise: what the control does. */
  readonly help: string;
}

export function clampCount(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(Math.max(min, max), Math.trunc(value)));
}

/**
 * Where a key sends a count, or undefined when it is not one of the selector's.
 * The result is clamped, so a key held down ends on the ceiling and stays.
 */
export function countKeyTarget(
  key: string,
  shiftKey: boolean,
  value: number,
  min: number,
  max: number,
): number | undefined {
  const big = shiftKey ? COUNT_BIG_STEP : 1;
  switch (key) {
    case 'ArrowLeft':
      return clampCount(value - big, min, max);
    case 'ArrowRight':
      return clampCount(value + big, min, max);
    case 'PageDown':
      return clampCount(value - COUNT_BIG_STEP, min, max);
    case 'PageUp':
      return clampCount(value + COUNT_BIG_STEP, min, max);
    case 'Home':
      return min;
    case 'End':
      return Math.max(min, max);
    default:
      return undefined;
  }
}

/**
 * The control. Two square buttons and the number between them, drawn by the
 * `.px-stepper` rules the loadout already had; `data-count-*` on the group is
 * everything a key or a click needs to find the new value.
 */
export function countSelector(options: CountSelectorOptions): string {
  const min = options.min ?? 0;
  const max = Math.max(min, options.max);
  const value = clampCount(options.value, min, max);
  const wiring = `data-count-kind="${options.kind}" data-count-id="${escapeAttribute(options.id)}"`;
  const label = escapeAttribute(options.label);
  const atCeiling = value >= max;
  const minus = `<button class="px-window px-step" ${wiring} data-count-dir="-1" data-help="${escapeAttribute(options.help)}" aria-label="Fewer ${label}"${value > min ? '' : ' disabled'}>−</button>`;
  // Inert at the ceiling but still reachable: a control the cursor cannot land
  // on can never say why it will not move.
  const plus = `<button class="px-window px-step" ${wiring} data-count-dir="1" data-help="${escapeAttribute(atCeiling ? options.limit : options.help)}" aria-label="More ${label}"${atCeiling ? ' aria-disabled="true"' : ''}>+</button>`;
  return `<span class="px-stepper px-count" role="group" aria-label="${label}" data-count="${options.kind}:${escapeAttribute(options.id)}" data-count-value="${value}" data-count-min="${min}" data-count-max="${max}">${minus}<b role="spinbutton" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${value}">${value}</b>${plus}</span>`;
}
