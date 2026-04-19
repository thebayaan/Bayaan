import {chooseTranslationFit, TranslationFitResult} from '../fitCascade';

describe('chooseTranslationFit', () => {
  // Simulated measurer: height = textLength * fontSize / 20 (proportional to both)
  const fakeMeasure = (text: string, fontSize: number): number =>
    Math.ceil((text.length * fontSize) / 20);

  it('returns fit at default size when well under maxHeight', () => {
    const result = chooseTranslationFit({
      text: 'Indeed, with hardship comes ease.',
      fontSizes: [22, 20, 18, 16, 14],
      maxHeight: 1000,
      measure: fakeMeasure,
    });
    expect(result.status).toBe('fit');
    if (result.status === 'fit') expect(result.fontSize).toBe(22);
    expect(result.truncated).toBe(false);
  });

  it('shrinks font until text fits', () => {
    const result = chooseTranslationFit({
      text: 'a'.repeat(100),
      fontSizes: [22, 20, 18, 16, 14],
      maxHeight: 80, // forces shrink: 100*14/20 = 70 (fits), 100*16/20 = 80 (edge)
      measure: fakeMeasure,
    });
    expect(result.status).toBe('fit');
    if (result.status === 'fit') expect(result.fontSize).toBeLessThan(22);
    expect(result.truncated).toBe(false);
  });

  it('truncates with ellipsis when floor size still overflows', () => {
    const result = chooseTranslationFit({
      text: 'a'.repeat(1000),
      fontSizes: [22, 20, 18, 16, 14],
      maxHeight: 50,
      measure: fakeMeasure,
    });
    expect(result.status).toBe('truncated');
    if (result.status === 'truncated') {
      expect(result.fontSize).toBe(14); // floor
      expect(result.text.endsWith('…')).toBe(true);
      expect(fakeMeasure(result.text, 14)).toBeLessThanOrEqual(50);
    }
  });

  it('truncates at word boundary', () => {
    const result = chooseTranslationFit({
      text: 'one two three four five six seven eight nine ten',
      fontSizes: [14],
      maxHeight: 20,
      measure: fakeMeasure,
    });
    expect(result.status).toBe('truncated');
    if (result.status === 'truncated') {
      const withoutEllipsis = result.text.replace('…', '').trim();
      // Should end on a full word (no partial word before "…")
      expect(withoutEllipsis).toMatch(/\w$/);
    }
  });

  it('returns reject when even an empty string plus ellipsis wouldnt fit', () => {
    const result = chooseTranslationFit({
      text: 'hello world',
      fontSizes: [14],
      maxHeight: 0, // nothing fits
      measure: fakeMeasure,
    });
    expect(result.status).toBe('reject');
  });
});
