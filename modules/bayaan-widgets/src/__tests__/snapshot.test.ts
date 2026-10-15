import full from '../__fixtures__/snapshot.full.json';
import empty from '../__fixtures__/snapshot.empty.json';
import {isWidgetSnapshot, WIDGET_SNAPSHOT_VERSION} from '../snapshot';

describe('isWidgetSnapshot', () => {
  it('accepts the shared fixtures', () => {
    expect(isWidgetSnapshot(full)).toBe(true);
    expect(isWidgetSnapshot(empty)).toBe(true);
  });

  it('rejects a future version', () => {
    expect(
      isWidgetSnapshot({...full, version: WIDGET_SNAPSHOT_VERSION + 1}),
    ).toBe(false);
  });

  it('rejects a malformed track', () => {
    const bad = {...full, upNext: [{surahId: '18'}]};
    expect(isWidgetSnapshot(bad)).toBe(false);
  });

  it('rejects non objects', () => {
    expect(isWidgetSnapshot(null)).toBe(false);
    expect(isWidgetSnapshot('x')).toBe(false);
  });
});
