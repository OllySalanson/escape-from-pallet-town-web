import { describe, expect, it } from 'vitest';
import { MAX_VOICE_CLIPS, MAX_VOICE_MS, VOICE_BITS_PER_SECOND, VOICE_WARNING_MS, chooseVoiceFormat, meterLevel, tapeIsFull, tapeIsLow, tapeTime } from './voiceTape';

describe('the tape', () => {
  it('runs five minutes in all and turns red with thirty seconds left, as agreed on the plan board', () => {
    expect(MAX_VOICE_MS).toBe(300_000);
    expect(tapeIsLow(VOICE_WARNING_MS - 1)).toBe(false);
    expect(tapeIsLow(270_000)).toBe(true);
    expect(tapeIsFull(299_999)).toBe(false);
    expect(tapeIsFull(300_000)).toBe(true);
  });

  it('keeps five minutes under a megabyte, so a message stays small enough to send', () => {
    expect((VOICE_BITS_PER_SECOND / 8) * (MAX_VOICE_MS / 1000)).toBeLessThan(1_000_000);
  });

  it('holds no more clips than the lab takes', () => {
    expect(MAX_VOICE_CLIPS).toBe(20);
  });

  it('counts the way the raid clock does', () => {
    expect(tapeTime(0)).toBe('0:00');
    expect(tapeTime(12_400)).toBe('0:12');
    expect(tapeTime(299_999)).toBe('4:59');
    expect(tapeTime(-5)).toBe('0:00');
  });

  it('records Opus where the browser can, and the format it can where it cannot', () => {
    expect(chooseVoiceFormat(() => true)).toBe('audio/webm;codecs=opus');
    expect(chooseVoiceFormat((type) => type.startsWith('audio/mp4'))).toBe('audio/mp4;codecs=mp4a.40.2');
    expect(chooseVoiceFormat(() => false)).toBeNull();
  });

  it('meters a voice on a decibel scale, so soft speech still moves it', () => {
    expect(meterLevel(0)).toBe(0);
    expect(meterLevel(0.001)).toBe(0);
    // A soft voice after noise suppression: about a fortieth of full scale.
    expect(meterLevel(0.025)).toBeGreaterThan(0.4);
    expect(meterLevel(0.3)).toBe(1);
    expect(meterLevel(1)).toBe(1);
  });
});
