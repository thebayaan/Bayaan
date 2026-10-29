import {claimTransport, GATE_MS, resetTransportGate} from './transportGate';

describe('claimTransport', () => {
  beforeEach(resetTransportGate);

  it('passes key presses when nothing else claims them', () => {
    expect(claimTransport('key', 'playPause', 1000)).toBe(true);
    expect(claimTransport('key', 'playPause', 1100)).toBe(true);
  });

  it('drops the system command that echoes a key press', () => {
    expect(claimTransport('key', 'playPause', 1000)).toBe(true);
    expect(claimTransport('system', 'playPause', 1050)).toBe(false);
  });

  it('drops the key event that echoes a system command', () => {
    expect(claimTransport('system', 'playPause', 1000)).toBe(true);
    expect(claimTransport('key', 'playPause', 1000 + GATE_MS - 1)).toBe(false);
  });

  it('passes the other path once the window has passed', () => {
    expect(claimTransport('key', 'playPause', 1000)).toBe(true);
    expect(claimTransport('system', 'playPause', 1000 + GATE_MS)).toBe(true);
  });

  it('keeps the window anchored on the press that acted', () => {
    expect(claimTransport('key', 'playPause', 1000)).toBe(true);
    expect(claimTransport('system', 'playPause', 1100)).toBe(false);
    expect(claimTransport('system', 'playPause', 1200)).toBe(false);
    expect(claimTransport('key', 'playPause', 1300)).toBe(true);
  });

  it('gates seeks and surah changes the same way', () => {
    expect(claimTransport('key', 'seek', 1000)).toBe(true);
    expect(claimTransport('system', 'seek', 1050)).toBe(false);
    expect(claimTransport('system', 'track', 2000)).toBe(true);
    expect(claimTransport('key', 'track', 2050)).toBe(false);
  });

  it('never lets one channel block another', () => {
    expect(claimTransport('system', 'playPause', 1000)).toBe(true);
    expect(claimTransport('key', 'seek', 1010)).toBe(true);
    expect(claimTransport('key', 'track', 1020)).toBe(true);
  });

  it('defaults to the Play/Pause channel', () => {
    expect(claimTransport('system')).toBe(true);
    expect(claimTransport('key', 'playPause')).toBe(false);
  });
});
