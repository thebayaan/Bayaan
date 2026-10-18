// @ai-generated
import {swapKeyboardLayout} from '../keyboardLayout';
import {createSearchIndex} from '../createSearchIndex';

describe('swapKeyboardLayout', () => {
  it('maps English-layout keystrokes to Arabic', () => {
    expect(swapKeyboardLayout('hgthjpm')).toBe('الفاتحة');
    expect(swapKeyboardLayout('hgfrvm')).toBe('البقرة');
  });

  it('maps Arabic-layout keystrokes to English', () => {
    expect(swapKeyboardLayout('ةهساشقغ')).toBe('mishary');
  });

  it('returns null for short or mixed-script input', () => {
    expect(swapKeyboardLayout('hg')).toBeNull();
    expect(swapKeyboardLayout('abc الف')).toBeNull();
  });
});

describe('keyboard fallback in search', () => {
  const index = createSearchIndex(
    [
      {name: 'Al-Fatihah', arabic: 'الفاتحة'},
      {name: 'Mishary Alafasi', arabic: 'مشاري العفاسي'},
    ],
    {
      fields: [
        {get: item => item.name, weight: 1},
        {get: item => item.arabic, weight: 1},
      ],
    },
  );

  it('retries with the other layout only when nothing matched', () => {
    expect(index.search('hgthjpm')[0]?.item.name).toBe('Al-Fatihah');
    expect(index.search('ةهساشقغ')[0]?.item.name).toBe('Mishary Alafasi');
  });

  it('can be disabled', () => {
    const strict = createSearchIndex([{name: 'الفاتحة'}], {
      fields: [{get: item => item.name, weight: 1}],
      keyboardFallback: false,
    });
    expect(strict.search('hgthjpm')).toEqual([]);
  });
});
