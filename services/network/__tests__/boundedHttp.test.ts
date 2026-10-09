import {boundedJsonRequest} from '../boundedHttp';

describe('boundedJsonRequest', () => {
  it('fails closed when a successful response has no readable body stream', async () => {
    const text = jest.fn(() => Promise.resolve('{"ok":true}'));
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      body: null,
      text,
    } as unknown as Response);

    await expect(
      boundedJsonRequest(
        fetchImpl,
        'https://api.example.test/data',
        {},
        {timeoutMs: 100, maxResponseBytes: 1024},
      ),
    ).rejects.toMatchObject({code: 'response_too_large'});
    expect(text).not.toHaveBeenCalled();
  });
});
