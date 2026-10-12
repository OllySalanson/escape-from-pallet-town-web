/**
 * Sound effects, synthesised in the browser with Web Audio: square and
 * triangle voices and a little noise, the palette of a handheld's sound chip.
 * There are no audio files and no music.
 *
 * Browsers only let a page make sound after the player has done something, so
 * the audio context is created on the first key press (`unlock`). Until then,
 * and whenever Web Audio is missing, every call is a silent no-op.
 */
export type SoundName = 'move' | 'rotate' | 'softDrop' | 'hardDrop' | 'lock' | 'hold' | 'clear1' | 'clear2' | 'clear3' | 'clear4' | 'spin' | 'allClear' | 'levelUp' | 'gameOver' | 'menuMove' | 'menuSelect' | 'pause' | 'ready' | 'go' | 'type';
export declare class Sfx {
    muted: boolean;
    private context;
    private master;
    private noiseBuffer;
    constructor(muted?: boolean);
    /** Creates (or resumes) the audio context. Call from a user gesture. */
    unlock(): void;
    play(name: SoundName): void;
    close(): void;
    private tone;
    private noise;
}
