// @ai-generated
// A navigation request (a result tapped in Similar Verses) is carried out
// only by an open mushaf reader. The store says whether one is open, so the
// sheet can open the reader's route instead of leaving a request nobody
// reads.

import {isReaderOpen, useMushafNavigationStore} from '../mushafNavigationStore';

const store = () => useMushafNavigationStore.getState();

beforeEach(() => {
  useMushafNavigationStore.setState({
    targetPage: null,
    targetVerseKey: null,
    readerCount: 0,
  });
});

describe('whether a reader is open', () => {
  it('is not, until one mounts', () => {
    expect(isReaderOpen()).toBe(false);
    const closed = store().readerOpened();
    expect(isReaderOpen()).toBe(true);
    closed();
    expect(isReaderOpen()).toBe(false);
  });

  it('stays open while any reader is mounted (a second one pushed on top)', () => {
    const firstClosed = store().readerOpened();
    const secondClosed = store().readerOpened();
    secondClosed();
    expect(isReaderOpen()).toBe(true);
    firstClosed();
    expect(isReaderOpen()).toBe(false);
  });

  it('counts each reader closing once', () => {
    const firstClosed = store().readerOpened();
    const secondClosed = store().readerOpened();
    firstClosed();
    firstClosed();
    expect(isReaderOpen()).toBe(true);
    secondClosed();
    expect(isReaderOpen()).toBe(false);
  });
});

describe('a navigation request', () => {
  it('names the verse and its page, and gets a new id each time', () => {
    const before = store().requestId;
    store().navigateTo({page: 42, verseKey: '2:255'});
    expect(store()).toMatchObject({
      targetVerseKey: '2:255',
      targetPage: 42,
      requestId: before + 1,
    });
    store().navigateTo({page: 42, verseKey: '2:255'});
    expect(store().requestId).toBe(before + 2);
  });

  it('is cleared once carried out, keeping its id', () => {
    store().navigateTo({page: 42, verseKey: '2:255'});
    const id = store().requestId;
    store().clear();
    expect(store()).toMatchObject({
      targetVerseKey: null,
      targetPage: null,
      requestId: id,
    });
  });
});
