// @ai-generated
import {sortRecitersByName} from '../sortReciters';

const reciter = (id: string, name: string) => ({id, name});

describe('sortRecitersByName', () => {
  it('sorts in a single A–Z run', () => {
    const sorted = sortRecitersByName([
      reciter('1', 'Yasser Al-Dosari'),
      reciter('2', 'Mishary Alafasi'),
      reciter('3', 'Abdulbasit Abdulsamad'),
      reciter('4', 'Ibrahim Al-Dossari'),
      reciter('5', 'Zaki Daghistani'),
    ]);
    expect(sorted.map(r => r.name)).toEqual([
      'Abdulbasit Abdulsamad',
      'Ibrahim Al-Dossari',
      'Mishary Alafasi',
      'Yasser Al-Dosari',
      'Zaki Daghistani',
    ]);
  });

  it('ignores case, accents and punctuation', () => {
    const sorted = sortRecitersByName([
      reciter('1', 'mahmoud Khalil'),
      reciter('2', 'Ëmad Hafez'),
      reciter('3', 'Abd-Allah Kamel'),
      reciter('4', 'Abd Al Rahman'),
      reciter('5', 'Fares Abbad'),
    ]);
    expect(sorted.map(r => r.id)).toEqual(['4', '3', '2', '5', '1']);
  });

  it('breaks ties by id and leaves the input untouched', () => {
    const input = [reciter('b', 'Same Name'), reciter('a', 'same name')];
    expect(sortRecitersByName(input).map(r => r.id)).toEqual(['a', 'b']);
    expect(input.map(r => r.id)).toEqual(['b', 'a']);
  });
});

// @ai-start
describe('sortRecitersByName in Arabic', () => {
  it('sorts by the Arabic name that is shown, not by the English one', () => {
    jest.isolateModules(() => {
      jest.doMock('@/i18n/format', () => ({
        getReciterDisplayName: (r: {name: string; name_arabic?: string}) =>
          r.name_arabic ?? r.name,
      }));
      const {sortRecitersByName: sortShown} =
        require('../sortReciters') as typeof import('../sortReciters');
      const sorted = sortShown([
        {id: '1', name: 'Omar Al-Qazabri', name_arabic: 'عمر القزابري'},
        {id: '2', name: 'Ahmad Al-Ajmi', name_arabic: 'أحمد العجمي'},
        {id: '3', name: 'Ibrahim Al-Akhdar', name_arabic: 'إبراهيم الأخضر'},
        {id: '4', name: 'Abdulbasit', name_arabic: 'عبد الباسط'},
      ]);
      // أ and إ sort with ا, before ع; English order would be 4, 2, 3, 1.
      expect(sorted.map(r => r.id)).toEqual(['3', '2', '4', '1']);
    });
  });
});
// @ai-end
