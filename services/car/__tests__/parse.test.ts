import {parseCarPlayRequest, parseCarTransport} from '../parse';

describe('parse', () => {
  it('parses a surah request', () => {
    expect(
      parseCarPlayRequest(
        '{"kind":"surah","reciterId":"r","rewayatId":"w","surahId":18}',
      ),
    ).toEqual({
      kind: 'surah',
      reciterId: 'r',
      rewayatId: 'w',
      surahId: 18,
      startAt: undefined,
    });
  });
  it('rejects malformed json and unknown kinds', () => {
    expect(parseCarPlayRequest('{')).toBeNull();
    expect(parseCarPlayRequest('{"kind":"x"}')).toBeNull();
    expect(parseCarPlayRequest('{"kind":"surah","reciterId":"r"}')).toBeNull();
  });
  it('parses uploads and resume requests', () => {
    expect(parseCarPlayRequest('{"kind":"uploads","startIndex":2}')).toEqual({
      kind: 'uploads',
      startIndex: 2,
    });
    expect(parseCarPlayRequest('{"kind":"uploads","startIndex":1.5}')).toEqual({
      kind: 'uploads',
      startIndex: undefined,
    });
    expect(parseCarPlayRequest('{"kind":"uploads","startIndex":"1"}')).toEqual({
      kind: 'uploads',
      startIndex: undefined,
    });
    expect(parseCarPlayRequest('{"kind":"resume"}')).toEqual({kind: 'resume'});
    expect(parseCarPlayRequest('{"kind":"random"}')).toEqual({kind: 'random'});
    expect(
      parseCarPlayRequest('{"kind":"resume","recitationId":"u1"}'),
    ).toEqual({kind: 'resume', recitationId: 'u1'});
    expect(parseCarPlayRequest('{"kind":"resume","recitationId":7}')).toEqual({
      kind: 'resume',
    });
  });
  it('parses transports', () => {
    expect(parseCarTransport('{"kind":"next"}')).toEqual({kind: 'next'});
    expect(parseCarTransport('{"kind":"seek","position":12}')).toEqual({
      kind: 'seek',
      position: 12,
    });
    expect(parseCarTransport('{"kind":"seek"}')).toBeNull();
  });
  it('requires non-negative integer indices', () => {
    expect(parseCarTransport('{"kind":"jumpTo","index":1.5}')).toBeNull();
    expect(parseCarTransport('{"kind":"jumpTo","index":-1}')).toBeNull();
    expect(parseCarTransport('{"kind":"jumpTo","index":2}')).toEqual({
      kind: 'jumpTo',
      index: 2,
    });
    expect(
      parseCarPlayRequest('{"kind":"loved","startIndex":-1}'),
    ).toMatchObject({kind: 'loved', startIndex: undefined});
    expect(
      parseCarPlayRequest('{"kind":"downloads","startIndex":0.5}'),
    ).toMatchObject({kind: 'downloads', startIndex: undefined});
    expect(parseCarPlayRequest('{"kind":"downloads","startIndex":3}')).toEqual({
      kind: 'downloads',
      startIndex: 3,
    });
  });
});
