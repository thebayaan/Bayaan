// @ai-generated
import {getLocalReciterImage, reciterImageKey} from '../reciterImageLookup';
import {reciterImages} from '../reciterImages';

describe('reciterImageKey', () => {
  it('builds keys the same way as the photo file names', () => {
    expect(reciterImageKey('Yasser Al-Dosari')).toBe('yasser-al-dosari');
    expect(reciterImageKey('Muamar (From Indonesia)')).toBe(
      'muamar-from-indonesia',
    );
    expect(reciterImageKey("  Abdul  Rahman - O'Neil. ")).toBe(
      'abdul-rahman-oneil',
    );
  });
});

describe('getLocalReciterImage', () => {
  it('finds a photo by name', () => {
    expect(getLocalReciterImage('Yasser Al-Dosari')).toBe(
      reciterImages['yasser-al-dosari'],
    );
  });

  it('finds a photo for a name with punctuation', () => {
    expect(getLocalReciterImage('Muamar (From Indonesia)')).toBe(
      reciterImages['muamar-from-indonesia'],
    );
    expect(reciterImages['muamar-from-indonesia']).toBeDefined();
  });

  it('finds a photo filed under an older spelling of the name', () => {
    expect(getLocalReciterImage('Mahmood AlSheimy')).toBe(
      reciterImages['mahmoud-el-sheimy'],
    );
    expect(reciterImages['mahmoud-el-sheimy']).toBeDefined();
  });

  it('returns undefined without a photo or a name', () => {
    expect(getLocalReciterImage('No Such Reciter')).toBeUndefined();
    expect(getLocalReciterImage('')).toBeUndefined();
    expect(getLocalReciterImage(undefined)).toBeUndefined();
  });
});
