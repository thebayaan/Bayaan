// @ai-generated
import {getRecitationStyleTitle} from '../recitationStyle';

describe('getRecitationStyleTitle', () => {
  it('capitalizes the style in English', () => {
    expect(getRecitationStyleTitle('murattal')).toBe('Murattal');
    expect(getRecitationStyleTitle('MOJAWWAD')).toBe('Mojawwad');
  });
});
