// @ai-generated
import {wordAudioUrl} from '../wordAudio';

describe('wordAudioUrl', () => {
  it('names the qurancdn file by verse and word-by-word position', () => {
    expect(wordAudioUrl('2:255', 3)).toBe(
      'https://audio.qurancdn.com/wbw/002_255_003.mp3',
    );
    expect(wordAudioUrl('114:6', 3)).toBe(
      'https://audio.qurancdn.com/wbw/114_006_003.mp3',
    );
    expect(wordAudioUrl('2:282', 128)).toBe(
      'https://audio.qurancdn.com/wbw/002_282_128.mp3',
    );
  });

  it('is empty for a malformed key', () => {
    for (const key of ['', '2', '2:', ':3', 'a:b', '2:255:3', ' 2:255']) {
      expect(wordAudioUrl(key, 1)).toBe('');
    }
  });

  it('is empty for a verse outside the Quran', () => {
    expect(wordAudioUrl('0:1', 1)).toBe('');
    expect(wordAudioUrl('115:1', 1)).toBe('');
    expect(wordAudioUrl('2:0', 1)).toBe('');
  });

  it('is empty for a position that is not a word', () => {
    for (const position of [0, -1, 1.5, Number.NaN]) {
      expect(wordAudioUrl('2:255', position)).toBe('');
    }
  });
});
