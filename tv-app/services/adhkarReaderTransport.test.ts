import {
  adhkarReaderTransport,
  createReaderKeyHandler,
  readerTransport,
  setAdhkarReaderTransport,
  type ReaderControls,
} from './adhkarReaderTransport';
import {claimTransport, resetTransportGate} from './transportGate';

beforeEach(resetTransportGate);

function controls(): jest.Mocked<ReaderControls> {
  return {
    toggle: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    nextDhikr: jest.fn(),
    previousDhikr: jest.fn(),
    pageForward: jest.fn(),
    pageBack: jest.fn(),
  };
}

describe('the adhkar reader remote', () => {
  it('maps every transport key, wherever focus is', () => {
    const c = controls();
    const handle = createReaderKeyHandler(c, () => false);
    handle({eventType: 'playPause'});
    handle({eventType: 'play', eventKeyAction: 1});
    handle({eventType: 'pause', eventKeyAction: 1});
    handle({eventType: 'next', eventKeyAction: 1});
    handle({eventType: 'previous', eventKeyAction: 1});
    handle({eventType: 'fastForward', eventKeyAction: 1});
    handle({eventType: 'rewind', eventKeyAction: 1});
    expect(c.toggle).toHaveBeenCalledTimes(1);
    expect(c.play).toHaveBeenCalledTimes(1);
    expect(c.pause).toHaveBeenCalledTimes(1);
    expect(c.nextDhikr).toHaveBeenCalledTimes(1);
    expect(c.previousDhikr).toHaveBeenCalledTimes(1);
    expect(c.pageForward).toHaveBeenCalledTimes(1);
    expect(c.pageBack).toHaveBeenCalledTimes(1);
  });

  it('turns pages with arrows and swipes only while the stage has focus', () => {
    const c = controls();
    let stage = false;
    const handle = createReaderKeyHandler(c, () => stage);
    handle({eventType: 'right'});
    handle({eventType: 'swipeLeft'});
    expect(c.pageForward).not.toHaveBeenCalled();
    expect(c.pageBack).not.toHaveBeenCalled();
    stage = true;
    handle({eventType: 'right'});
    handle({eventType: 'swipeLeft'});
    expect(c.pageForward).toHaveBeenCalledTimes(1);
    expect(c.pageBack).toHaveBeenCalledTimes(1);
  });

  it('acts once per Vega down/up pair, and not after the system command', () => {
    const c = controls();
    const handle = createReaderKeyHandler(c, () => true);
    handle({eventType: 'skip_forward', eventKeyAction: 0});
    handle({eventType: 'skip_forward', eventKeyAction: 1});
    expect(c.pageForward).toHaveBeenCalledTimes(1);
    // The same press, delivered first as a media command.
    claimTransport('system', 'playPause');
    handle({eventType: 'playpause', eventKeyAction: 0});
    expect(c.toggle).not.toHaveBeenCalled();
  });

  it('gives the system commands the same controls', () => {
    const c = controls();
    const transport = readerTransport(c);
    transport.next();
    transport.previous();
    transport.seekBy(10);
    transport.seekBy(-10);
    transport.play();
    expect(c.nextDhikr).toHaveBeenCalled();
    expect(c.previousDhikr).toHaveBeenCalled();
    expect(c.pageForward).toHaveBeenCalledTimes(1);
    expect(c.pageBack).toHaveBeenCalledTimes(1);
    expect(c.play).toHaveBeenCalled();
  });

  it('registers the open reader only until it closes', () => {
    const first = readerTransport(controls());
    const second = readerTransport(controls());
    const removeFirst = setAdhkarReaderTransport(first);
    const removeSecond = setAdhkarReaderTransport(second);
    removeFirst();
    expect(adhkarReaderTransport()).toBe(second);
    removeSecond();
    expect(adhkarReaderTransport()).toBeNull();
  });
});
