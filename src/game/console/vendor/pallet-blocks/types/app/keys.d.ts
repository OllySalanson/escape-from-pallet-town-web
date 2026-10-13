import type { GameAction } from '../core/game';
export declare function gameActionFor(code: string): GameAction | null;
export type MenuKey = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';
export declare function menuKeyFor(code: string): MenuKey | null;
/**
 * The menu key a press stands for on the GAME OVER results. Only keys that
 * do nothing in play can choose or leave there: Space, Z and X are the drop
 * and turn keys a player is most likely to still be hammering when the game
 * ends, and one stray press would skip the results.
 */
export declare function resultsKeyFor(code: string): MenuKey | null;
export declare const isPauseKey: (code: string) => boolean;
export declare const isMuteKey: (code: string) => boolean;
/** The modifier state of a key press. */
export interface KeyChord {
    readonly code: string;
    readonly ctrlKey: boolean;
    readonly metaKey: boolean;
    readonly altKey: boolean;
}
/**
 * Whether a key press belongs to the browser (Ctrl+R, Alt+Tab, ...) rather
 * than the game. During play Ctrl is itself a game key (turn anticlockwise),
 * so Ctrl still down when a game key goes down is a roll from one to the
 * other, and the game keeps it.
 */
export declare function isBrowserShortcut(chord: KeyChord, playing: boolean): boolean;
/**
 * The move and soft-drop keys that are down right now, so a key held while
 * the game cannot take it (through READY, or a pause) still counts when play
 * starts. The browser sends no fresh press for a key that is already down.
 */
export declare class HeldKeys {
    private readonly down;
    press(code: string): void;
    release(code: string): void;
    /** Forgets every key, for when the keyups can no longer be heard. */
    clear(): void;
    /** The held actions, oldest press first, so pressing them in turn leaves the newest in charge. */
    actions(): GameAction[];
}
/**
 * The keys pressed since the screen last changed. A key already down when a
 * menu opens (the soft drop held into a pause, say) goes on sending
 * auto-repeat presses, and a menu must not let those run its cursor away, nor
 * the name box let a turn key held as the game ends type itself over and over.
 */
export declare class FreshKeys {
    private readonly down;
    press(code: string, repeat: boolean): void;
    release(code: string): void;
    /** Forgets every key, for a new screen or when the keyups can no longer be heard. */
    clear(): void;
    /** Whether a press counts: a fresh one does, and so do the repeats of a key pressed on this screen. */
    counts(code: string, repeat: boolean): boolean;
}
