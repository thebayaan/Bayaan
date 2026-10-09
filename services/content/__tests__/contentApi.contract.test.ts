import fs from 'fs';
import path from 'path';
import {createContentApi, isManifest} from '../contentApi';

const fixtureDir = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'contracts',
  'content',
  'v1',
);

function loadFixture(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, name), 'utf8'));
}

function respond(body: unknown): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(body)));
}

describe('content API contract fixtures', () => {
  it('accepts the backend manifest fixtures', () => {
    expect(isManifest(loadFixture('manifest.json'))).toBe(true);
    expect(isManifest(loadFixture('manifest-withdrawn.json'))).toBe(true);
  });

  it('rejects deliberately broken copies of the manifest', () => {
    const base = loadFixture('manifest.json');
    if (
      typeof base !== 'object' ||
      base === null ||
      !('resources' in base) ||
      !Array.isArray(base.resources)
    ) {
      throw new Error('unexpected fixture shape');
    }
    const [first] = base.resources;
    expect(isManifest({...base, format: 2})).toBe(false);
    expect(isManifest({...base, resources: undefined})).toBe(false);
    expect(isManifest({...base, resources: {}})).toBe(false);
    expect(
      isManifest({...base, resources: [{...first, status: 'archived'}]}),
    ).toBe(false);
  });

  it('parses the backend download ticket fixture', async () => {
    const fixture = loadFixture('download-ticket.json');
    const api = createContentApi(
      'https://api.test',
      'k',
      jest.fn(() => respond(fixture)) as unknown as typeof fetch,
    );
    const ticket = await api.getDownloadTicket('qf:tafsirs:169');
    expect(ticket.version).toBe(1);
    expect(ticket.bytes).toBe(512);
    expect(ticket.url).toContain('r2.test');
  });

  it('rejects a ticket missing required fields', async () => {
    const api = createContentApi(
      'https://api.test',
      'k',
      jest.fn(() => respond({data: {url: 'x'}})) as unknown as typeof fetch,
    );
    await expect(api.getDownloadTicket('k')).rejects.toThrow(
      'download_ticket_malformed',
    );
  });
});
