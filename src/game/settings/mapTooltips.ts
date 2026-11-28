/**
 * Whether the map's labels say themselves - a place's name as the player walks
 * up to it ("BROCK'S WORKSHOP / Brock wants a favour"), a rare find in view, a
 * trainer's watch, a way out once the raid clock is red, and the names over
 * other players' heads - or only while the look key is held (the captain: "on
 * there you should be able to turn tooltips off"). Turned on and off in
 * SETTINGS (`scenes/ControlsScene.ts`), read by the harbour and the raid each
 * frame (`BaseScene.containWorldLabels`, `WorldScene.containWorldLabels`).
 *
 * **Off unless turned on** (the harbour audit, 27 Nov 2026: "the screen is
 * plastered with labels"): the overworld shows what FireRed's shows, and a
 * FireRed town writes nothing over its buildings or its people. Nothing a
 * player needs goes missing - L still shows every label, a sign or a landmark
 * is read by facing it and pressing SPACE, and O and M answer where the job is.
 *
 * A per-browser convenience, kept as the mute is (`audio/AudioManager.ts`),
 * never part of the save.
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

/** Whether the labels speak as the player walks up to them. Off unless turned on. */
export function mapTooltipsOn(store: TooltipStore | null = browserStore()): boolean {
  try {
    return store?.getItem(MAP_TOOLTIPS_STORAGE_KEY) === 'on';
  } catch {
    return false;
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
