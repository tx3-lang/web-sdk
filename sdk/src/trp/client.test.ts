import { jest } from '@jest/globals';
import { TrpClient } from './client.js';
import {
  NetworkError,
  HttpError,
  DeserializationError,
  MalformedResponseError,
  GenericRpcError,
  UnsupportedTirError,
  MissingTxArgError,
  InputNotResolvedError,
  TxScriptFailureError,
} from './errors.js';

const ENDPOINT = 'http://localhost:9999/rpc';

function jsonRpcOk(result: unknown) {
  return { jsonrpc: '2.0', result, id: '1' };
}

function jsonRpcError(code: number, message: string, data?: unknown) {
  return { jsonrpc: '2.0', error: { code, message, data }, id: '1' };
}

function mockFetch(response: unknown, options?: { status?: number; ok?: boolean }) {
  const status = options?.status ?? 200;
  const ok = options?.ok ?? (status >= 200 && status < 300);
  return jest.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: () => Promise.resolve(response),
  });
}

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('TrpClient', () => {
  test('resolve returns TxEnvelope', async () => {
    const body = jsonRpcOk({ hash: 'abc123', tx: 'deadbeef' });
    globalThis.fetch = mockFetch(body) as never;

    const client = new TrpClient({ endpoint: ENDPOINT });
    const result = await client.resolve({
      tir: { content: 'aabb', contentType: 'hex', version: 'v1beta0' },
      args: {},
    });

    expect(result.hash).toBe('abc123');
    expect(result.tx).toBe('deadbeef');
  });

  test('submit returns SubmitResponse with hash', async () => {
    const body = jsonRpcOk({ hash: 'tx123' });
    globalThis.fetch = mockFetch(body) as never;

    const client = new TrpClient({ endpoint: ENDPOINT });
    const result = await client.submit({
      tx: { content: 'cafe', contentType: 'hex' },
      witnesses: [],
    });

    expect(result.hash).toBe('tx123');
  });

  test('checkStatus returns statuses', async () => {
    const body = jsonRpcOk({
      statuses: {
        hash1: { stage: 'confirmed', confirmations: 3, nonConfirmations: 0 },
      },
    });
    globalThis.fetch = mockFetch(body) as never;

    const client = new TrpClient({ endpoint: ENDPOINT });
    const result = await client.checkStatus(['hash1']);

    expect(result.statuses.hash1.stage).toBe('confirmed');
    expect(result.statuses.hash1.confirmations).toBe(3);
  });

  test('dumpLogs returns entries', async () => {
    const body = jsonRpcOk({ entries: [], nextCursor: 42 });
    globalThis.fetch = mockFetch(body) as never;

    const client = new TrpClient({ endpoint: ENDPOINT });
    const result = await client.dumpLogs();
    expect(result.entries).toEqual([]);
    expect(result.nextCursor).toBe(42);
  });

  test('call() escape hatch returns raw result', async () => {
    const body = jsonRpcOk({ custom: 'data' });
    globalThis.fetch = mockFetch(body) as never;

    const client = new TrpClient({ endpoint: ENDPOINT });
    const result = await client.call('custom.method', { key: 'value' });
    expect(result).toEqual({ custom: 'data' });
  });

  describe('error mapping', () => {
    test('fetch failure throws NetworkError', async () => {
      globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed')) as never;
      const client = new TrpClient({ endpoint: ENDPOINT });
      await expect(client.resolve({
        tir: { content: '', contentType: 'hex', version: 'v1beta0' },
        args: {},
      })).rejects.toThrow(NetworkError);
    });

    test('HTTP 500 throws HttpError', async () => {
      globalThis.fetch = mockFetch({}, { status: 500, ok: false }) as never;
      const client = new TrpClient({ endpoint: ENDPOINT });
      await expect(client.call('test', {})).rejects.toThrow(HttpError);
    });

    test('malformed JSON throws DeserializationError', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      }) as never;
      const client = new TrpClient({ endpoint: ENDPOINT });
      await expect(client.call('test', {})).rejects.toThrow(DeserializationError);
    });

    test('missing result throws MalformedResponseError', async () => {
      globalThis.fetch = mockFetch({ jsonrpc: '2.0', id: '1' }) as never;
      const client = new TrpClient({ endpoint: ENDPOINT });
      await expect(client.call('test', {})).rejects.toThrow(MalformedResponseError);
    });

    test('code -32000 throws UnsupportedTirError', async () => {
      const body = jsonRpcError(-32000, 'unsupported tir', {
        expected: 'v2',
        provided: 'v1',
      });
      globalThis.fetch = mockFetch(body) as never;
      const client = new TrpClient({ endpoint: ENDPOINT });
      await expect(client.call('test', {})).rejects.toThrow(UnsupportedTirError);
    });

    test('code -32001 throws MissingTxArgError', async () => {
      const body = jsonRpcError(-32001, 'missing arg', {
        key: 'quantity',
        type: 'Int',
      });
      globalThis.fetch = mockFetch(body) as never;
      const client = new TrpClient({ endpoint: ENDPOINT });
      await expect(client.call('test', {})).rejects.toThrow(MissingTxArgError);
    });

    test('code -32002 throws InputNotResolvedError', async () => {
      const body = jsonRpcError(-32002, 'input not resolved', {
        name: 'source',
        query: { collateral: false, minAmount: {}, refs: [], supportMany: false },
        search_space: { matched: [] },
      });
      globalThis.fetch = mockFetch(body) as never;
      const client = new TrpClient({ endpoint: ENDPOINT });
      await expect(client.call('test', {})).rejects.toThrow(InputNotResolvedError);
    });

    test('code -32003 throws TxScriptFailureError', async () => {
      const body = jsonRpcError(-32003, 'script failure', {
        logs: ['error: budget exceeded'],
      });
      globalThis.fetch = mockFetch(body) as never;
      const client = new TrpClient({ endpoint: ENDPOINT });
      await expect(client.call('test', {})).rejects.toThrow(TxScriptFailureError);
    });

    test('unknown code throws GenericRpcError', async () => {
      const body = jsonRpcError(-32600, 'invalid request');
      globalThis.fetch = mockFetch(body) as never;
      const client = new TrpClient({ endpoint: ENDPOINT });
      await expect(client.call('test', {})).rejects.toThrow(GenericRpcError);
    });
  });

  test('custom headers are sent', async () => {
    const body = jsonRpcOk('ok');
    const mockFn = mockFetch(body);
    globalThis.fetch = mockFn as never;

    const client = new TrpClient({
      endpoint: ENDPOINT,
      headers: { 'X-Custom': 'value' },
    });
    await client.call('test', {});

    const [, init] = mockFn.mock.calls[0];
    expect(init.headers['X-Custom']).toBe('value');
  });
});
