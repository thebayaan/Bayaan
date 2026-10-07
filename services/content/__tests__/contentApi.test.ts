import {createContentApi, isManifest} from '../contentApi';

const manifest = {
  format: 1,
  generated_at: '2026-10-06T00:00:00Z',
  paused: false,
  resources: [
    {
      key: 'qf:tafsirs:169',
      kind: 'tafsir',
      source: 'qf',
      version: 2,
      status: 'active',
      upstream_schema_version: 1,
      bytes: 3600000,
      sha256: 'a'.repeat(64),
      meta: {name: 'Ibn Kathir'},
    },
  ],
};

function respond(body: unknown, init: ResponseInit = {}): Promise<Response> {
  if (body === '') return Promise.resolve(new Response(null, init));
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return Promise.resolve(new Response(text, init));
}

describe('isManifest', () => {
  it('accepts a valid manifest and rejects malformed ones', () => {
    expect(isManifest(manifest)).toBe(true);
    expect(isManifest({...manifest, format: 2})).toBe(false);
    expect(isManifest({...manifest, resources: 'x'})).toBe(false);
    expect(isManifest({...manifest, resources: [{key: 'k'}]})).toBe(false);
    expect(isManifest(null)).toBe(false);
  });
});

describe('createContentApi', () => {
  it('sends the API key and kinds, and returns the ETag', async () => {
    const fetchImpl = jest.fn(() =>
      respond(manifest, {status: 200, headers: {ETag: '"e1"'}}),
    );
    const api = createContentApi(
      'https://api.test',
      'key-1',
      fetchImpl as unknown as typeof fetch,
    );
    const result = await api.fetchManifest(['tafsir'], null);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.test/v1/content/manifest?kinds=tafsir',
      expect.objectContaining({headers: {Authorization: 'Bearer key-1'}}),
    );
    expect(result).toEqual({status: 'ok', manifest, etag: '"e1"'});
  });

  it('sends If-None-Match and maps 304', async () => {
    const fetchImpl = jest.fn(() => respond('', {status: 304}));
    const api = createContentApi(
      'https://api.test',
      'k',
      fetchImpl as unknown as typeof fetch,
    );
    expect(await api.fetchManifest(['tafsir'], '"e1"')).toEqual({
      status: 'not_modified',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: {Authorization: 'Bearer k', 'If-None-Match': '"e1"'},
      }),
    );
  });

  it('maps errors and malformed bodies to error results', async () => {
    const api500 = createContentApi(
      'https://api.test',
      'k',
      jest.fn(() => respond('x', {status: 500})) as unknown as typeof fetch,
    );
    expect(await api500.fetchManifest(['tafsir'], null)).toEqual({
      status: 'error',
      reason: 'http_500',
    });
    const apiBad = createContentApi(
      'https://api.test',
      'k',
      jest.fn(() => respond({format: 1})) as unknown as typeof fetch,
    );
    expect(await apiBad.fetchManifest(['tafsir'], null)).toEqual({
      status: 'error',
      reason: 'malformed',
    });
    const apiThrow = createContentApi(
      'https://api.test',
      'k',
      jest.fn(() =>
        Promise.reject(new Error('offline')),
      ) as unknown as typeof fetch,
    );
    expect(await apiThrow.fetchManifest(['tafsir'], null)).toEqual({
      status: 'error',
      reason: 'network',
    });
  });

  it('gets a download ticket for an encoded key', async () => {
    const ticket = {
      url: 'https://r2.test/x',
      version: 2,
      sha256: 'b'.repeat(64),
      bytes: 10,
      expires_at: 'z',
    };
    const fetchImpl = jest.fn(() => respond({data: ticket}));
    const api = createContentApi(
      'https://api.test',
      'k',
      fetchImpl as unknown as typeof fetch,
    );
    expect(await api.getDownloadTicket('qf:tafsirs:169')).toEqual(ticket);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.test/v1/content/resources/qf%3Atafsirs%3A169/download',
      expect.anything(),
    );
  });

  it('throws when the ticket request fails', async () => {
    const api = createContentApi(
      'https://api.test',
      'k',
      jest.fn(() => respond('', {status: 404})) as unknown as typeof fetch,
    );
    await expect(api.getDownloadTicket('qf:tafsirs:1')).rejects.toThrow(
      'download_ticket_404',
    );
  });
});
