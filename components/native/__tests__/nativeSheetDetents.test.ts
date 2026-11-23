// @ai-generated
import {
  getNativeSheetLevels,
  hideNativeSheet,
  notifyNativeSheetDismissed,
  presentNativeSheet,
  setNativeSheetDetents,
  setNativeSheetHostMounted,
} from '../nativeSheets';

function top() {
  const levels = getNativeSheetLevels();
  return levels[levels.length - 1];
}

beforeAll(() => setNativeSheetHostMounted(true));

afterEach(() => {
  for (const level of getNativeSheetLevels()) {
    hideNativeSheet(level.id);
    notifyNativeSheetDismissed(level.key);
  }
});

describe('setNativeSheetDetents', () => {
  it('grows a sheet with fixed detents and gives its detents back', () => {
    presentNativeSheet('mushaf-layout', null, false);
    const {key} = top();
    expect(top().detents).toEqual(['medium', 'large']);

    setNativeSheetDetents(key, ['large']);
    expect(top().detents).toEqual(['large']);
    expect(top().fit).toBe(false);

    setNativeSheetDetents(key, null);
    expect(top().detents).toEqual(['medium', 'large']);
    expect(top().fit).toBe(false);
  });

  it('still sizes a fitted sheet to its content after a fixed spell', () => {
    presentNativeSheet('verse-actions', null, false, 'fit');
    const {key} = top();
    setNativeSheetDetents(key, ['large']);
    expect(top()).toMatchObject({fit: false, detents: ['large']});
    setNativeSheetDetents(key, null);
    expect(top().fit).toBe(true);
  });

  it('ignores a level that is gone', () => {
    const before = getNativeSheetLevels();
    setNativeSheetDetents(999, ['large']);
    expect(getNativeSheetLevels()).toBe(before);
  });
});
