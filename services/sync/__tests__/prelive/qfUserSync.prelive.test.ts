import {spawnSync} from 'node:child_process';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative, resolve} from 'node:path';
import {
  BayaanSyncApiClient,
  BayaanSyncApiError,
} from '@/services/sync/bayaanSyncApiClient';
import {readBayaanAuthConfig} from '@/config/bayaanAuth';
import {analyticsService} from '@/services/analytics/AnalyticsService';

const mockSentryCaptureException = jest.fn();
const mockSentryCaptureMessage = jest.fn();
const mockSentryAddBreadcrumb = jest.fn();

jest.mock('@sentry/react-native', () => ({
  captureException: (...args: unknown[]) => mockSentryCaptureException(...args),
  captureMessage: (...args: unknown[]) => mockSentryCaptureMessage(...args),
  addBreadcrumb: (...args: unknown[]) => mockSentryAddBreadcrumb(...args),
}));

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: jest.fn(),
    set: jest.fn(),
    getAllKeys: () => [],
  }),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: () => 'task-13-device-id',
}));

jest.mock('@/services/analytics/LocalAggregationStore', () => ({
  localAggregationStore: {
    getToday: () => '2026-08-25',
    addListeningTime: jest.fn(),
    addPagesRead: jest.fn(),
    addPagesOpened: jest.fn(),
    incrementMeaningfulListens: jest.fn(),
    incrementAdhkarSessions: jest.fn(),
    addTasbeehCount: jest.fn(),
    markSurahCompleted: jest.fn(),
  },
}));

const REPOSITORY_ROOT = resolve(__dirname, '../../../..');
const BFF_ORIGIN = 'https://bff.task-13.example';
const OPAQUE_SESSION = 'task-13-opaque-bayaan-session';
const BACKEND_ONLY_CANARIES = {
  QF_CLIENT_ID: 'task-13-qf-client-id-canary',
  QF_CLIENT_SECRET: 'task-13-qf-client-secret-canary',
  QF_TOKEN_ENCRYPTION_KEY: 'task-13-qf-encryption-key-canary',
  QF_ACCESS_TOKEN: 'task-13-qf-access-token-canary',
  QF_REFRESH_TOKEN: 'task-13-qf-refresh-token-canary',
};
const RUNTIME_ROOTS = [
  'app',
  'components',
  'config',
  'hooks',
  'providers',
  'services',
  'store',
  'types',
] as const;
const RUNTIME_EXTENSIONS = new Set(['.js', '.jsx', '.json', '.ts', '.tsx']);

interface CapturedRequest {
  url: URL;
  init?: RequestInit;
}

function jsonResponse(body: unknown, status = 200) {
  const text = JSON.stringify(body);
  const bytes = new TextEncoder().encode(text);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({'content-length': String(Buffer.byteLength(text))}),
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
    text: () => Promise.resolve(text),
    json: () => Promise.resolve(body),
  } as Response;
}

function runtimeFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const absolute = join(root, entry);
    const repositoryPath = relative(REPOSITORY_ROOT, absolute).replaceAll(
      '\\',
      '/',
    );
    if (
      repositoryPath.includes('/__tests__/') ||
      /\.(test|spec)\.[jt]sx?$/.test(repositoryPath)
    ) {
      continue;
    }
    if (statSync(absolute).isDirectory()) {
      files.push(...runtimeFiles(absolute));
      continue;
    }
    const extension = absolute.slice(absolute.lastIndexOf('.'));
    if (RUNTIME_EXTENSIONS.has(extension)) files.push(absolute);
  }
  return files;
}

describe('QF user sync mobile pre-live acceptance', () => {
  it('sends only an opaque Bayaan session to the fixed BFF Sync route', async () => {
    const requests: CapturedRequest[] = [];
    const fetchImpl = jest
      .fn()
      .mockImplementationOnce(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          requests.push({url: new URL(input.toString()), init});
          return jsonResponse({
            success: true,
            data: {
              lastMutationAt: 73,
              mutations: [],
              page: 1,
              limit: 100,
              total: 0,
              hasMore: false,
            },
          });
        },
      )
      .mockImplementationOnce(
        async (input: RequestInfo | URL, init?: RequestInit) => {
          requests.push({url: new URL(input.toString()), init});
          return jsonResponse({
            success: true,
            data: {lastMutationAt: 74, mutations: []},
          });
        },
      );
    const client = new BayaanSyncApiClient({
      apiUrl: BFF_ORIGIN,
      fetchImpl,
    });

    await expect(
      client.pull(OPAQUE_SESSION, {
        mutationsSince: 0,
        metadataOnly: false,
        limit: 100,
        page: 1,
      }),
    ).resolves.toMatchObject({lastMutationAt: 73, mutations: []});
    await expect(
      client.push(OPAQUE_SESSION, {
        lastMutationAt: 73,
        mutations: [
          {
            resource: 'NOTE',
            type: 'CREATE',
            data: {
              body: 'private task-13 note',
              ranges: ['2:255-2:255'],
              saveToQR: false,
            },
          },
        ],
      }),
    ).resolves.toEqual({lastMutationAt: 74, mutations: []});

    expect(requests).toHaveLength(2);
    expect(requests.map(request => request.url.origin)).toEqual([
      BFF_ORIGIN,
      BFF_ORIGIN,
    ]);
    expect(requests.map(request => request.url.pathname)).toEqual([
      '/v1/qf/sync',
      '/v1/qf/sync',
    ]);
    expect(requests.map(request => request.init?.method)).toEqual([
      'GET',
      'POST',
    ]);
    for (const request of requests) {
      const headers = new Headers(request.init?.headers);
      expect(headers.get('authorization')).toBe(`Bearer ${OPAQUE_SESSION}`);
      expect(headers.get('x-auth-token')).toBeNull();
      expect(headers.get('x-client-id')).toBeNull();
      expect(request.url.hostname).not.toMatch(/quran\.foundation$/i);
    }
    expect(JSON.stringify(requests)).not.toContain('client_secret');
    expect(JSON.stringify(requests)).not.toContain('access_token');
    expect(JSON.stringify(requests)).not.toContain('refresh_token');
    expect(JSON.stringify(requests)).not.toContain('id_token');
    const pushBody = requests[1]?.init?.body;
    if (typeof pushBody !== 'string') {
      throw new Error('Task 13 push request did not contain a JSON body');
    }
    expect(JSON.parse(pushBody)).toEqual({
      mutations: [
        {
          resource: 'NOTE',
          type: 'CREATE',
          data: {
            body: 'private task-13 note',
            ranges: ['2:255-2:255'],
            saveToQR: false,
          },
        },
      ],
    });
  });

  it('keeps backend credential canaries out of Expo config and runtime sources', () => {
    const authConfig = readBayaanAuthConfig({
      EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED: 'true',
      EXPO_PUBLIC_BAYAAN_API_URL: BFF_ORIGIN,
      ...BACKEND_ONLY_CANARIES,
    });
    expect(authConfig).toEqual({qfSyncEnabled: true, apiUrl: BFF_ORIGIN});
    expect(JSON.stringify(authConfig)).not.toContain('task-13-qf-');

    const configProcess = spawnSync(
      process.execPath,
      [
        '-e',
        "process.stdout.write(JSON.stringify(require('./app.config.js')))",
      ],
      {
        cwd: REPOSITORY_ROOT,
        env: {
          ...process.env,
          EXPO_PUBLIC_BAYAAN_QF_SYNC_ENABLED: 'true',
          EXPO_PUBLIC_BAYAAN_API_URL: BFF_ORIGIN,
          ...BACKEND_ONLY_CANARIES,
        },
        encoding: 'utf8',
      },
    );
    expect(configProcess.status).toBe(0);
    const configOutput = `${configProcess.stdout}${configProcess.stderr}`;
    for (const canary of Object.values(BACKEND_ONLY_CANARIES)) {
      expect(configOutput).not.toContain(canary);
    }

    const matches: string[] = [];
    for (const root of RUNTIME_ROOTS) {
      for (const file of runtimeFiles(join(REPOSITORY_ROOT, root))) {
        const repositoryPath = relative(REPOSITORY_ROOT, file).replaceAll(
          '\\',
          '/',
        );
        const source = readFileSync(file, 'utf8');
        if (
          /EXPO_PUBLIC_(?:QF_CLIENT|QF_AUTHORIZATION_CODE|QF.*TOKEN|CLIENT_SECRET)/i.test(
            source,
          )
        ) {
          matches.push(repositoryPath);
        }
      }
    }
    expect([...new Set(matches)].sort()).toEqual(['config/bayaanAuth.ts']);
  });

  it('maps raw failures without emitting them from this layer to console, PostHog, or Sentry', async () => {
    const upstreamSecret = 'task-13-upstream-error-secret';
    const logs: string[] = [];
    const posthogCapture = jest.fn();
    const posthogRegister = jest.fn();
    analyticsService.setPostHogInstance({
      capture: posthogCapture,
      register: posthogRegister,
      optIn: jest.fn(async () => undefined),
      optOut: jest.fn(async () => undefined),
    } as unknown as Parameters<typeof analyticsService.setPostHogInstance>[0]);
    mockSentryCaptureException.mockClear();
    mockSentryCaptureMessage.mockClear();
    mockSentryAddBreadcrumb.mockClear();
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    console.log = (...values: unknown[]) =>
      logs.push(values.map(String).join(' '));
    console.warn = (...values: unknown[]) =>
      logs.push(values.map(String).join(' '));
    console.error = (...values: unknown[]) =>
      logs.push(values.map(String).join(' '));
    const client = new BayaanSyncApiClient({
      apiUrl: BFF_ORIGIN,
      fetchImpl: jest.fn(async () => {
        throw new Error(upstreamSecret);
      }),
    });

    try {
      await expect(
        client.pull(OPAQUE_SESSION, {mutationsSince: 0}),
      ).rejects.toEqual(new BayaanSyncApiError('service_unavailable', 0));
      await expect(
        client.push(OPAQUE_SESSION, {
          lastMutationAt: 73,
          mutations: [
            {
              resource: 'BOOKMARK',
              type: 'DELETE',
              resourceId: 'task-13-bookmark',
            },
          ],
        }),
      ).rejects.toEqual(new BayaanSyncApiError('service_unavailable', 0));
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    }

    expect(logs).toEqual([]);
    expect(JSON.stringify(logs)).not.toContain(upstreamSecret);
    expect(posthogRegister).toHaveBeenCalledWith({platform: 'mobile'});
    expect(posthogCapture).not.toHaveBeenCalled();
    expect(mockSentryCaptureException).not.toHaveBeenCalled();
    expect(mockSentryCaptureMessage).not.toHaveBeenCalled();
    expect(mockSentryAddBreadcrumb).not.toHaveBeenCalled();
    const stableError = new BayaanSyncApiError('service_unavailable', 0);
    expect(stableError.message).toBe('Bayaan Sync request failed');
    expect(JSON.stringify(stableError)).not.toContain(upstreamSecret);
  });
});
