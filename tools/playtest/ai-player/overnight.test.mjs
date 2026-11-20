// The overnight runner's two questions: when to stop, and whether the
// machine can take another session yet.
import { describe, expect, it } from 'vitest';
import { MIN_FREE_MB, deadlineFrom, machineReady, memoryFreeMb } from './overnight.mjs';

describe('overnight runner', () => {
  it('stops at the next ten o’clock, today or tomorrow', () => {
    const night = new Date(2026, 10, 20, 0, 30);
    expect(deadlineFrom('10:00', night)).toEqual(new Date(2026, 10, 20, 10, 0));
    const lateMorning = new Date(2026, 10, 20, 11, 0);
    expect(deadlineFrom('10:00', lateMorning)).toEqual(new Date(2026, 10, 21, 10, 0));
  });

  it('reads free memory as the kernel counts it', () => {
    expect(memoryFreeMb('MemTotal: 10000000 kB\nMemAvailable:    4096000 kB\n')).toBe(4000);
  });

  it('waits while memory is short or the processor is busy', () => {
    expect(machineReady({ freeMb: MIN_FREE_MB + 1, load: 1, cores: 8 })).toEqual({ ready: true, why: null });
    expect(machineReady({ freeMb: MIN_FREE_MB - 1, load: 1, cores: 8 }).why).toMatch(/memory/);
    expect(machineReady({ freeMb: MIN_FREE_MB + 1, load: 7.5, cores: 8 }).why).toMatch(/busy/);
  });
});
