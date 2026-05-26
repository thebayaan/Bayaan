import {
  BayaanError,
  BayaanAudioError,
  BayaanMushafError,
  BayaanLifecycleError,
  BayaanNetworkError,
} from '../errors';

describe('BayaanError', () => {
  describe('construction', () => {
    it('captures code, recoverable, message, and frozen context', () => {
      const err = new BayaanError('AUDIO_LOAD_FAILED', 'load failed', {
        recoverable: true,
        context: {url: 'https://example.invalid/track.mp3'},
      });

      expect(err.code).toBe('AUDIO_LOAD_FAILED');
      expect(err.recoverable).toBe(true);
      expect(err.message).toBe('load failed');
      expect(err.context).toEqual({url: 'https://example.invalid/track.mp3'});
      expect(Object.isFrozen(err.context)).toBe(true);
    });

    it('defaults context to an empty frozen object when omitted', () => {
      const err = new BayaanError('PRECONDITION_VIOLATED', 'no player', {
        recoverable: false,
      });

      expect(err.context).toEqual({});
      expect(Object.isFrozen(err.context)).toBe(true);
    });

    it('preserves a cause via options.cause', () => {
      const cause = new TypeError('bad uri');
      const err = new BayaanError('AUDIO_SOURCE_INVALID', 'invalid source', {
        recoverable: false,
        cause,
      });

      expect(err.cause).toBe(cause);
    });

    it('does not retain a reference to the caller-provided context object', () => {
      const ctx = {surahId: 42} as Record<string, unknown>;
      const err = new BayaanError('AUDIO_PLAYBACK_FAILED', 'failed', {
        recoverable: true,
        context: ctx,
      });

      // Mutating the original object must not change the error's context.
      ctx.surahId = 99;
      expect(err.context).toEqual({surahId: 42});
    });
  });

  describe('Error inheritance', () => {
    it('is an instance of Error and BayaanError', () => {
      const err = new BayaanError('AUDIO_LOAD_FAILED', 'x', {
        recoverable: true,
      });
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(BayaanError);
    });

    it('preserves a stack trace', () => {
      const err = new BayaanError('AUDIO_LOAD_FAILED', 'x', {
        recoverable: true,
      });
      expect(typeof err.stack).toBe('string');
      expect(err.stack ?? '').toContain('Error');
    });
  });
});

describe('Domain subclasses', () => {
  it('all extend BayaanError and Error', () => {
    const audio = new BayaanAudioError('AUDIO_LOAD_FAILED', 'a', {
      recoverable: true,
    });
    const mushaf = new BayaanMushafError('MUSHAF_DB_NOT_FOUND', 'm', {
      recoverable: false,
    });
    const lifecycle = new BayaanLifecycleError('LIFECYCLE_AFTER_DESTROY', 'l', {
      recoverable: false,
    });
    const network = new BayaanNetworkError('NETWORK_TIMEOUT', 'n', {
      recoverable: true,
    });

    for (const err of [audio, mushaf, lifecycle, network]) {
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(BayaanError);
    }
  });

  it('have the right name property for each subclass', () => {
    expect(
      new BayaanAudioError('AUDIO_LOAD_FAILED', 'x', {recoverable: true}).name,
    ).toBe('BayaanAudioError');
    expect(
      new BayaanMushafError('MUSHAF_DB_NOT_FOUND', 'x', {recoverable: false})
        .name,
    ).toBe('BayaanMushafError');
    expect(
      new BayaanLifecycleError('LIFECYCLE_AFTER_DESTROY', 'x', {
        recoverable: false,
      }).name,
    ).toBe('BayaanLifecycleError');
    expect(
      new BayaanNetworkError('NETWORK_TIMEOUT', 'x', {recoverable: true}).name,
    ).toBe('BayaanNetworkError');
  });

  it('lets consumers branch on instanceof for each domain', () => {
    const errs = [
      new BayaanAudioError('AUDIO_LOAD_FAILED', 'a', {recoverable: true}),
      new BayaanMushafError('MUSHAF_DB_NOT_FOUND', 'm', {recoverable: false}),
      new BayaanLifecycleError('LIFECYCLE_AFTER_DESTROY', 'l', {
        recoverable: false,
      }),
      new BayaanNetworkError('NETWORK_TIMEOUT', 'n', {recoverable: true}),
    ] as const;

    expect(errs[0]).toBeInstanceOf(BayaanAudioError);
    expect(errs[0]).not.toBeInstanceOf(BayaanMushafError);

    expect(errs[1]).toBeInstanceOf(BayaanMushafError);
    expect(errs[1]).not.toBeInstanceOf(BayaanAudioError);

    expect(errs[2]).toBeInstanceOf(BayaanLifecycleError);
    expect(errs[2]).not.toBeInstanceOf(BayaanNetworkError);

    expect(errs[3]).toBeInstanceOf(BayaanNetworkError);
    expect(errs[3]).not.toBeInstanceOf(BayaanLifecycleError);
  });
});
