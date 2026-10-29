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
