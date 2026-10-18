import {claimTransport, GATE_MS, resetTransportGate} from './transportGate';

describe('claimTransport', () => {
  beforeEach(resetTransportGate);

  it('passes key presses when nothing else claims them', () => {
    expect(claimTransport('key', 1000)).toBe(true);
    expect(claimTransport('key', 1100)).toBe(true);
  });

  it('drops the system command that echoes a key press', () => {
    expect(claimTransport('key', 1000)).toBe(true);
    expect(claimTransport('system', 1050)).toBe(false);
  });

  it('drops the key event that echoes a system command', () => {
    expect(claimTransport('system', 1000)).toBe(true);
    expect(claimTransport('key', 1000 + GATE_MS - 1)).toBe(false);
  });

  it('passes the other path once the window has passed', () => {
    expect(claimTransport('key', 1000)).toBe(true);
    expect(claimTransport('system', 1000 + GATE_MS)).toBe(true);
  });

  it('keeps the window anchored on the press that acted', () => {
    expect(claimTransport('key', 1000)).toBe(true);
    expect(claimTransport('system', 1100)).toBe(false);
    expect(claimTransport('system', 1200)).toBe(false);
    expect(claimTransport('key', 1300)).toBe(true);
  });
});
