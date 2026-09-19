import { describe, expect, it } from 'vitest';
import { TEST_MODE_LOOP, isTestModeRequested } from './testMode';

describe('test mode', () => {
  it('is asked for by name on a development build, and by nothing else', () => {
    expect(isTestModeRequested(true, '?testmode=1', undefined)).toBe(true);
    expect(isTestModeRequested(true, '?test-lab=1&testmode=1', undefined)).toBe(true);
    expect(isTestModeRequested(true, '', undefined)).toBe(false);
    expect(isTestModeRequested(true, '?testmode=0', undefined)).toBe(false);
    expect(isTestModeRequested(true, '?testmode', undefined)).toBe(false);
  });

  it('cannot be switched on from the URL of a production build', () => {
    expect(isTestModeRequested(false, '?testmode=1', undefined)).toBe(false);
  });

  it('is honoured in any build made with the environment flag, and only at 1', () => {
    expect(isTestModeRequested(false, '', '1')).toBe(true);
    expect(isTestModeRequested(true, '', '0')).toBe(false);
    expect(isTestModeRequested(true, '', '')).toBe(false);
  });

  it('runs the loop off a timer at ten frames a second', () => {
    expect(TEST_MODE_LOOP).toEqual({ target: 10, forceSetTimeOut: true });
  });
});
