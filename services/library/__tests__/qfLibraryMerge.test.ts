// @ai-generated
import {
  mergeDocument,
  mergeEntries,
  sameEntries,
} from '@/services/library/qfLibraryMerge';

describe('qfLibraryMerge', () => {
  it('takes the side that changed each item', () => {
    const base = {a: '1', b: '2', c: '3'};
    const local = {a: '1', b: '2', c: '3', d: '4'}; // added d
    const remote = {a: '1', c: '3', e: '5'}; // removed b, added e
    expect(mergeEntries(base, local, remote)).toEqual({
      a: '1',
      c: '3',
      d: '4',
      e: '5',
    });
  });

  it('lets this device win when both changed the same item', () => {
    expect(mergeEntries({a: '1'}, {a: '2'}, {a: '3'})).toEqual({a: '2'});
    expect(mergeEntries({a: '1'}, {}, {a: '3'})).toEqual({});
  });

  it('unions both sides on a first sync', () => {
    expect(mergeEntries({}, {a: '1'}, {b: '2'})).toEqual({a: '1', b: '2'});
  });

  it('deletes a document only when the other side left it unchanged', () => {
    const base = {name: 'A'};
    expect(mergeDocument(base, null, {name: 'A'})).toBeNull();
    expect(mergeDocument(base, {name: 'A'}, null)).toBeNull();
    // An edit wins over a delete.
    expect(mergeDocument(base, null, {name: 'B'})).toEqual({name: 'B'});
    expect(mergeDocument(base, {name: 'B'}, null)).toEqual({name: 'B'});
    // New on one side only.
    expect(mergeDocument(null, null, {name: 'R'})).toEqual({name: 'R'});
    expect(mergeDocument(null, {name: 'L'}, null)).toEqual({name: 'L'});
    expect(mergeDocument(null, null, null)).toBeNull();
  });

  it('compares entries by value', () => {
    expect(sameEntries({a: '1', b: '2'}, {b: '2', a: '1'})).toBe(true);
    expect(sameEntries({a: '1'}, {a: '1', b: '2'})).toBe(false);
  });
});
