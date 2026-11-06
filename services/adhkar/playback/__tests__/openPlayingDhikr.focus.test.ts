import {
  clearAdhkarFocus,
  getAdhkarFocus,
  setAdhkarFocus,
  type AdhkarFocus,
} from '../openPlayingDhikr';

beforeEach(() => setAdhkarFocus(null));

it('a late blur cleanup of the list keeps the reader focus', () => {
  const listA: AdhkarFocus = {kind: 'list', listId: 'a'};
  const readerA: AdhkarFocus = {kind: 'reader', listId: 'a'};
  setAdhkarFocus(listA);
  setAdhkarFocus(readerA);
  clearAdhkarFocus(listA);
  expect(getAdhkarFocus()).toBe(readerA);
  clearAdhkarFocus(readerA);
  expect(getAdhkarFocus()).toBeNull();
});

it('clearing an equal but different object leaves the focus alone', () => {
  const readerA: AdhkarFocus = {kind: 'reader', listId: 'a'};
  setAdhkarFocus(readerA);
  clearAdhkarFocus({kind: 'reader', listId: 'a'});
  expect(getAdhkarFocus()).toBe(readerA);
});
