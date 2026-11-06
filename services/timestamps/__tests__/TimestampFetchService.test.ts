// @ai-generated
import {timestampFetchService} from '../TimestampFetchService';
import {timestampDatabaseService} from '../TimestampDatabaseService';

jest.mock('@/config/branding', () => ({__esModule: true, default: {}}));
jest.mock('@/data/reciterData', () => ({
  RECITERS: [
    {
      id: 'reciter',
      rewayat: [
        {id: 'timed', has_timestamps: true},
        {id: 'partial', has_timestamps: true, timestamps_surah_list: [1]},
        {id: 'untimed', has_timestamps: false},
      ],
    },
  ],
}));
jest.mock('../TimestampDatabaseService', () => ({
  timestampDatabaseService: {writeTimestamps: jest.fn(async () => undefined)},
}));

const ENTRY = {
  surahNumber: 1,
  ayahNumber: 1,
  timestampFrom: 0,
  timestampTo: 1000,
  durationMs: 1000,
};

function response(status: number, body: unknown = [ENTRY]): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>();

beforeEach(() => {
  jest.useFakeTimers();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.mocked(timestampDatabaseService.writeTimestamps).mockClear();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function load(rewayat = 'timed', surah = 1) {
  const pending = timestampFetchService.fetchAndCache(rewayat, surah);
  await jest.runAllTimersAsync();
  return pending;
}

describe('TimestampFetchService.fetchAndCache', () => {
  it('returns and caches good timings', async () => {
    fetchMock.mockResolvedValue(response(200));
    expect(await load()).toEqual({status: 'ok', timestamps: [ENTRY]});
    expect(timestampDatabaseService.writeTimestamps).toHaveBeenCalledTimes(1);
  });

  it('does not touch the network for a surah the catalog does not cover', async () => {
    expect(await load('untimed')).toEqual({status: 'not-covered'});
    expect(await load('partial', 2)).toEqual({status: 'not-covered'});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats a missing file as not covered, without retrying', async () => {
    fetchMock.mockResolvedValue(response(404));
    expect(await load()).toEqual({status: 'not-covered'});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports a lost connection after one retry', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    expect(await load()).toEqual({status: 'failed', reason: 'offline'});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('recovers when the retry succeeds', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValue(response(200));
    expect(await load()).toEqual({status: 'ok', timestamps: [ENTRY]});
  });

  it('retries a server error, but not a refused request', async () => {
    fetchMock.mockResolvedValue(response(503));
    expect(await load()).toEqual({status: 'failed', reason: 'server'});
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockClear();
    fetchMock.mockResolvedValue(response(403));
    expect(await load()).toEqual({status: 'failed', reason: 'server'});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up on a stalled request', async () => {
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('Aborted')),
          );
        }),
    );
    expect(await load()).toEqual({status: 'failed', reason: 'offline'});
  });

  it('rejects an empty list and any malformed entry, and caches neither', async () => {
    fetchMock.mockResolvedValueOnce(response(200, []));
    expect(await load()).toEqual({status: 'failed', reason: 'bad-data'});

    fetchMock.mockResolvedValueOnce(
      response(200, [ENTRY, {...ENTRY, durationMs: undefined}]),
    );
    expect(await load()).toEqual({status: 'failed', reason: 'bad-data'});
    expect(timestampDatabaseService.writeTimestamps).not.toHaveBeenCalled();
  });

  it('reports a body that is not JSON as bad data', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    } as unknown as Response);
    expect(await load()).toEqual({status: 'failed', reason: 'bad-data'});
  });

  it('still returns the timings when caching them fails', async () => {
    fetchMock.mockResolvedValue(response(200));
    jest
      .mocked(timestampDatabaseService.writeTimestamps)
      .mockRejectedValueOnce(new Error('disk full'));
    expect(await load()).toEqual({status: 'ok', timestamps: [ENTRY]});
  });
});
