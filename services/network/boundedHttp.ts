export type BoundedHttpErrorCode =
  | 'timeout'
  | 'network'
  | 'response_too_large'
  | 'invalid_json';

export class BoundedHttpError extends Error {
  constructor(public readonly code: BoundedHttpErrorCode) {
    super('Bounded HTTP request failed');
    this.name = 'BoundedHttpError';
  }
}

type StreamReadResult = Awaited<
  ReturnType<ReadableStreamDefaultReader<Uint8Array>['read']>
>;

interface BoundedRequestOptions {
  timeoutMs: number;
  maxResponseBytes: number;
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else bytes += 3;
  }
  return bytes;
}

function readChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal,
): Promise<StreamReadResult> {
  if (signal.aborted) {
    return Promise.reject(new BoundedHttpError('timeout'));
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new BoundedHttpError('timeout'));
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    signal.addEventListener('abort', onAbort, {once: true});
    reader.read().then(
      result => {
        cleanup();
        resolve(result);
      },
      error => {
        cleanup();
        reject(error);
      },
    );
  });
}

async function readStream(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
  signal: AbortSignal,
): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    // The reader's `done` flag is the stream terminator.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const result = await readChunk(reader, signal);
      if (result.done) break;
      total += result.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new BoundedHttpError('response_too_large');
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder('utf-8', {fatal: true}).decode(bytes);
  } catch {
    throw new BoundedHttpError('invalid_json');
  }
}

async function readJson(
  response: Response,
  options: BoundedRequestOptions,
  signal: AbortSignal,
): Promise<unknown> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > options.maxResponseBytes
  ) {
    await response.body?.cancel().catch(() => undefined);
    throw new BoundedHttpError('response_too_large');
  }

  const readable = response.body as ReadableStream<Uint8Array> | null;
  const text = readable
    ? await readStream(readable, options.maxResponseBytes, signal)
    : await response.text();
  if (utf8ByteLength(text) > options.maxResponseBytes) {
    throw new BoundedHttpError('response_too_large');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new BoundedHttpError('invalid_json');
  }
}

async function withDeadline<T>(
  timeoutMs: number,
  task: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<T>((resolve, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new BoundedHttpError('timeout'));
      }, timeoutMs);
      task(controller.signal).then(resolve, reject);
    });
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

export async function boundedJsonRequest(
  fetchImpl: typeof fetch,
  input: string,
  init: RequestInit,
  options: BoundedRequestOptions,
): Promise<{response: Response; body: unknown | null}> {
  return withDeadline(options.timeoutMs, async signal => {
    let response: Response;
    try {
      response = await fetchImpl(input, {...init, signal});
    } catch {
      throw new BoundedHttpError(signal.aborted ? 'timeout' : 'network');
    }
    return {
      response,
      body: response.ok ? await readJson(response, options, signal) : null,
    };
  });
}

export async function boundedRequest(
  fetchImpl: typeof fetch,
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  return withDeadline(timeoutMs, async signal => {
    try {
      return await fetchImpl(input, {...init, signal});
    } catch {
      throw new BoundedHttpError(signal.aborted ? 'timeout' : 'network');
    }
  });
}
