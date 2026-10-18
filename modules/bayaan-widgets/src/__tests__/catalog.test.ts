import catalog from '../__fixtures__/catalog.json';
import {isWidgetCatalog, WIDGET_CATALOG_VERSION} from '../catalog';

describe('isWidgetCatalog', () => {
  it('accepts the shared fixture', () => {
    expect(isWidgetCatalog(catalog)).toBe(true);
  });

  it('rejects a future version', () => {
    expect(
      isWidgetCatalog({...catalog, version: WIDGET_CATALOG_VERSION + 1}),
    ).toBe(false);
  });

  it('rejects malformed entries', () => {
    expect(isWidgetCatalog({...catalog, reciters: [{id: 1}]})).toBe(false);
    expect(
      isWidgetCatalog({...catalog, adhkar: [{id: '91', arabic: 'x'}]}),
    ).toBe(false);
    expect(isWidgetCatalog(null)).toBe(false);
  });
});
