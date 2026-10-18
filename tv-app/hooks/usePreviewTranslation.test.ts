import {
  PREVIEW_FALLBACK,
  PREVIEW_OFFLINE,
  previewTranslationLine,
} from './usePreviewTranslation';

describe('previewTranslationLine', () => {
  it('shows the loaded translation of the chosen edition', () => {
    const state = {edition: 'fr.hamidullah', text: 'Béni soit', failed: false};
    expect(previewTranslationLine(state, 'fr.hamidullah')).toBe('Béni soit');
  });

  it('keeps the last translation on screen while another one loads', () => {
    const state = {edition: 'en.sahih', text: 'Blessed is He', failed: false};
    expect(previewTranslationLine(state, 'en.pickthall')).toBe('Blessed is He');
  });

  it('says a translation needs a connection when it cannot load', () => {
    const state = {edition: 'en.pickthall', text: null, failed: true};
    expect(previewTranslationLine(state, 'en.pickthall')).toBe(PREVIEW_OFFLINE);
  });

  it("falls back to Saheeh's bundled verse, loading or offline", () => {
    expect(
      previewTranslationLine(
        {edition: 'en.sahih', text: null, failed: true},
        'en.sahih',
      ),
    ).toBe(PREVIEW_FALLBACK);
    expect(
      previewTranslationLine(
        {edition: 'en.sahih', text: null, failed: false},
        'en.sahih',
      ),
    ).toBe(PREVIEW_FALLBACK);
  });

  it('shows nothing (not English) while a first other edition loads', () => {
    expect(
      previewTranslationLine(
        {edition: 'ur.jalandhry', text: null, failed: false},
        'ur.jalandhry',
      ),
    ).toBe('');
  });
});
