/**
 * Whether the harbour's place labels say themselves as the player walks up to
 * them - "BROCK'S WORKSHOP / Brock wants a favour", "POKéMON CENTER / everyone
 * is fit" - or only while the look key is held (the captain: "on there you
 * should be able to turn tooltips off"). Turned on and off in SETTINGS
 * (`scenes/ControlsScene.ts`), read by the harbour each frame
 * (`BaseScene.containWorldLabels`).
 *
 * A per-browser convenience, kept as the mute is (`audio/AudioManager.ts`),
 * never part of the save: a browser that stores nothing has them on, as it
 * always did. Off, nothing a player needs goes missing - L still shows every
 * label, and the raid's labels (ways out, warnings, finds) are never quietened.
 */
export const MAP_TOOLTIPS_STORAGE_KEY = 'escape-from-pallet-town.map-tooltips';

export interface TooltipStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStore(): TooltipStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Whether the labels speak as the player walks up to them. On unless turned off. */
export function mapTooltipsOn(store: TooltipStore | null = browserStore()): boolean {
  try {
    return store?.getItem(MAP_TOOLTIPS_STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** Turns them on or off for this browser. Says whether the choice was kept. */
export function setMapTooltips(on: boolean, store: TooltipStore | null = browserStore()): boolean {
  try {
    if (!store) return false;
    store.setItem(MAP_TOOLTIPS_STORAGE_KEY, on ? 'on' : 'off');
    return true;
  } catch {
    return false;
  }
}
