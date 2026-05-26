import {
  BayaanAudioError,
  BayaanError,
  BayaanMushafError,
  BayaanNetworkError,
} from '@bayaan/types';
import {registerBayaanMatchers} from '../error-matchers';

beforeAll(() => {
  registerBayaanMatchers();
});

describe('toBeBayaanError', () => {
  describe('without a code argument', () => {
    it('passes for any BayaanError', () => {
      const err = new BayaanError('AUDIO_LOAD_FAILED', 'load failed', {
        recoverable: true,
      });
      expect(err).toBeBayaanError();
    });

    it('passes for any BayaanError subclass', () => {
      expect(
        new BayaanAudioError('AUDIO_LOAD_FAILED', 'a', {recoverable: true}),
      ).toBeBayaanError();
      expect(
        new BayaanMushafError('MUSHAF_DB_NOT_FOUND', 'm', {recoverable: false}),
      ).toBeBayaanError();
      expect(
        new BayaanNetworkError('NETWORK_TIMEOUT', 'n', {recoverable: true}),
      ).toBeBayaanError();
    });

    it('fails for plain Error', () => {
      const err = new Error('boom');
      expect(err).not.toBeBayaanError();
    });

    it('fails for non-Error values', () => {
      expect('AUDIO_LOAD_FAILED').not.toBeBayaanError();
      expect({code: 'AUDIO_LOAD_FAILED'}).not.toBeBayaanError();
      expect(undefined).not.toBeBayaanError();
      expect(null).not.toBeBayaanError();
    });
  });

  describe('with a code argument', () => {
    it('passes when the code matches', () => {
      const err = new BayaanAudioError('AUDIO_LOAD_FAILED', 'x', {
        recoverable: true,
      });
      expect(err).toBeBayaanError('AUDIO_LOAD_FAILED');
    });

    it('fails when the code does not match', () => {
      const err = new BayaanAudioError('AUDIO_LOAD_FAILED', 'x', {
        recoverable: true,
      });
      expect(err).not.toBeBayaanError('AUDIO_SEEK_FAILED');
    });

    it('fails when the value is not a BayaanError, regardless of code', () => {
      expect(new Error('boom')).not.toBeBayaanError('AUDIO_LOAD_FAILED');
    });
  });

  it('produces a useful failure message when the assertion fails', () => {
    const plain = new Error('boom');
    expect(() => expect(plain).toBeBayaanError()).toThrow(/BayaanError/);
  });

  it('produces a useful failure message when the code mismatches', () => {
    const err = new BayaanAudioError('AUDIO_LOAD_FAILED', 'x', {
      recoverable: true,
    });
    expect(() => expect(err).toBeBayaanError('AUDIO_SEEK_FAILED')).toThrow(
      /AUDIO_SEEK_FAILED/,
    );
  });
});
