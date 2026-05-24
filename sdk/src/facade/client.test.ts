import { jest } from '@jest/globals';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Protocol } from '../tii/protocol.js';
import { UnknownProfileError, UnknownTxError } from '../tii/errors.js';
import { Tx3Client } from './client.js';
import { Tx3ClientBuilder } from './clientBuilder.js';
import { Party } from './party.js';
import { PollConfig } from './poll.js';
import { Ed25519Signer } from '../signer/ed25519.js';
import {
  MissingTrpEndpointError,
  UnknownPartyError,
  SubmitHashMismatchError,
  FinalizedFailedError,
  FinalizedTimeoutError,
} from './errors.js';
import type { TxWitness } from '../trp/spec.js';
import type { Signer, SignRequest } from '../signer/signer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, '../../tests/fixtures/transfer.tii');
const SENDER_KEY = 'aa'.repeat(32);
const SENDER_ADDR = 'addr_test1_sender';
const RECEIVER_ADDR = 'addr_test1_receiver';
const TX_HASH = 'bb'.repeat(32);
const ENDPOINT = 'http://localhost:9999/rpc';

function jsonRpcOk(result: unknown) {
  return { jsonrpc: '2.0', result, id: '1' };
}

function mockFetchSequence(...responses: unknown[]) {
  let i = 0;
  return jest.fn().mockImplementation(() => {
    const body = responses[i] ?? responses[responses.length - 1];
    i++;
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
    });
  });
}

let originalFetch: typeof globalThis.fetch;
let protocol: Protocol;

function baseBuilder(): Tx3ClientBuilder {
  return protocol
    .client()
    .trpEndpoint(ENDPOINT)
    .withProfile('preprod');
}

function builtClient(): Tx3Client {
  const signer = Ed25519Signer.fromHex(SENDER_ADDR, SENDER_KEY);
  return baseBuilder()
    .withParty('sender', Party.signer(signer))
    .withParty('receiver', Party.address(RECEIVER_ADDR))
    .withParty('middleman', Party.address(RECEIVER_ADDR))
    .build();
}

beforeAll(async () => {
  protocol = await Protocol.fromFile(FIXTURE);
});

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('Tx3ClientBuilder', () => {
  test('Protocol.client() seeds a builder', () => {
    expect(protocol.client()).toBeInstanceOf(Tx3ClientBuilder);
  });

  test('build() returns a Tx3Client', () => {
    expect(builtClient()).toBeInstanceOf(Tx3Client);
  });

  test('build() throws MissingTrpEndpointError without an endpoint', () => {
    expect(() => protocol.client().build()).toThrow(MissingTrpEndpointError);
  });

  test('build() throws MissingTrpEndpointError on empty endpoint', () => {
    expect(() => protocol.client().trpEndpoint('').build()).toThrow(
      MissingTrpEndpointError,
    );
  });

  test('build() throws UnknownProfileError for an undeclared profile', () => {
    expect(() =>
      protocol.client().trpEndpoint(ENDPOINT).withProfile('not-a-profile').build(),
    ).toThrow(UnknownProfileError);
  });

  test('build() throws UnknownPartyError for an undeclared party', () => {
    expect(() =>
      baseBuilder()
        .withParty('stranger', Party.address('addr_stranger'))
        .build(),
    ).toThrow(UnknownPartyError);
  });

  test('withPartyUnchecked bypasses declared-party validation in build()', () => {
    expect(() =>
      baseBuilder()
        .withPartyUnchecked('stranger', Party.address('addr_stranger'))
        .build(),
    ).not.toThrow();
  });

  test('withHeader merges into TRP options', () => {
    const builder = protocol
      .client()
      .trpEndpoint(ENDPOINT)
      .withHeader('dmtr-api-key', 'secret');
    // Build should succeed (endpoint supplied).
    expect(() => builder.build()).not.toThrow();
  });

  test('withEnvValue overrides profile env at resolve time', async () => {
    const resolveResponse = jsonRpcOk({ hash: TX_HASH, tx: 'cafebabe' });
    const fetchMock = mockFetchSequence(resolveResponse);
    globalThis.fetch = fetchMock as never;

    const client = baseBuilder()
      .withPartyUnchecked('sender', Party.address(SENDER_ADDR))
      .withPartyUnchecked('receiver', Party.address(RECEIVER_ADDR))
      .withPartyUnchecked('middleman', Party.address(RECEIVER_ADDR))
      .withEnvValue('network', 'overridden')
      .build();

    await client.tx('transfer').arg('quantity', 100).resolve();

    const call = fetchMock.mock.calls[0] as [string, { body: string }];
    const payload = JSON.parse(call[1].body) as {
      params: { args: Record<string, unknown> };
    };
    expect(payload.params.args.network).toBe('overridden');
  });

  test('built client has no withProfile method', () => {
    const client = builtClient() as unknown as Record<string, unknown>;
    expect(client.withProfile).toBeUndefined();
  });

  test('built-client withParty validates against declared parties', () => {
    expect(() =>
      builtClient().withParty('stranger', Party.address('addr_stranger')),
    ).toThrow(UnknownPartyError);
  });

  test('Tx3ClientBuilder.fromParts produces a usable client (codegen flow)', async () => {
    const resolveResponse = jsonRpcOk({ hash: TX_HASH, tx: 'cafebabe' });
    globalThis.fetch = mockFetchSequence(resolveResponse) as never;

    const tirs = protocol.txs();
    const transactions = new Map(
      Object.entries(tirs).map(([k, v]) => [k, v.tir]),
    );
    const profiles = new Map();

    const client = Tx3ClientBuilder.fromParts(transactions, profiles, [])
      .trpEndpoint(ENDPOINT)
      .withPartyUnchecked('sender', Party.address(SENDER_ADDR))
      .withPartyUnchecked('receiver', Party.address(RECEIVER_ADDR))
      .withPartyUnchecked('middleman', Party.address(RECEIVER_ADDR))
      .build();

    const resolved = await client.tx('transfer').arg('quantity', 100).resolve();
    expect(resolved.hash).toBe(TX_HASH);
  });
});

describe('Tx3Client lifecycle', () => {
  test('happy path: resolve → sign → submit → waitForConfirmed', async () => {
    const resolveResponse = jsonRpcOk({ hash: TX_HASH, tx: 'cafebabe' });
    const submitResponse = jsonRpcOk({ hash: TX_HASH });
    const statusPending = jsonRpcOk({
      statuses: {
        [TX_HASH]: { stage: 'pending', confirmations: 0, nonConfirmations: 0 },
      },
    });
    const statusConfirmed = jsonRpcOk({
      statuses: {
        [TX_HASH]: { stage: 'confirmed', confirmations: 5, nonConfirmations: 0 },
      },
    });

    globalThis.fetch = mockFetchSequence(
      resolveResponse,
      submitResponse,
      statusPending,
      statusConfirmed,
    ) as never;

    const status = await builtClient()
      .tx('transfer')
      .arg('quantity', 10_000_000)
      .resolve()
      .then((r) => r.sign())
      .then((s) => s.submit())
      .then((sub) => sub.waitForConfirmed(new PollConfig(5, 10)));

    expect(status.stage).toBe('confirmed');
    expect(status.confirmations).toBe(5);
  });

  test('tx() throws UnknownTxError for an undeclared transaction', () => {
    expect(() => builtClient().tx('not-a-tx')).toThrow(UnknownTxError);
  });

  test('SubmitHashMismatchError when server returns different hash', async () => {
    const resolveResponse = jsonRpcOk({ hash: TX_HASH, tx: 'cafebabe' });
    const submitResponse = jsonRpcOk({ hash: 'different_hash' });
    globalThis.fetch = mockFetchSequence(resolveResponse, submitResponse) as never;

    const resolved = await builtClient().tx('transfer').arg('quantity', 100).resolve();
    const signed = await resolved.sign();

    await expect(signed.submit()).rejects.toThrow(SubmitHashMismatchError);
  });

  test('FinalizedFailedError when tx is dropped', async () => {
    const resolveResponse = jsonRpcOk({ hash: TX_HASH, tx: 'cafebabe' });
    const submitResponse = jsonRpcOk({ hash: TX_HASH });
    const statusDropped = jsonRpcOk({
      statuses: {
        [TX_HASH]: { stage: 'dropped', confirmations: 0, nonConfirmations: 0 },
      },
    });

    globalThis.fetch = mockFetchSequence(
      resolveResponse,
      submitResponse,
      statusDropped,
    ) as never;

    const submitted = await builtClient()
      .tx('transfer')
      .arg('quantity', 100)
      .resolve()
      .then((r) => r.sign())
      .then((s) => s.submit());

    await expect(
      submitted.waitForConfirmed(new PollConfig(3, 10)),
    ).rejects.toThrow(FinalizedFailedError);
  });

  test('FinalizedTimeoutError when tx stays pending', async () => {
    const resolveResponse = jsonRpcOk({ hash: TX_HASH, tx: 'cafebabe' });
    const submitResponse = jsonRpcOk({ hash: TX_HASH });
    const statusPending = jsonRpcOk({
      statuses: {
        [TX_HASH]: { stage: 'pending', confirmations: 0, nonConfirmations: 0 },
      },
    });

    globalThis.fetch = mockFetchSequence(
      resolveResponse,
      submitResponse,
      statusPending,
    ) as never;

    const submitted = await builtClient()
      .tx('transfer')
      .arg('quantity', 100)
      .resolve()
      .then((r) => r.sign())
      .then((s) => s.submit());

    await expect(
      submitted.waitForConfirmed(new PollConfig(3, 10)),
    ).rejects.toThrow(FinalizedTimeoutError);
  });

  test('async custom signer works', async () => {
    const resolveResponse = jsonRpcOk({ hash: TX_HASH, tx: 'cafebabe' });
    const submitResponse = jsonRpcOk({ hash: TX_HASH });
    const statusConfirmed = jsonRpcOk({
      statuses: {
        [TX_HASH]: { stage: 'confirmed', confirmations: 1, nonConfirmations: 0 },
      },
    });

    globalThis.fetch = mockFetchSequence(
      resolveResponse,
      submitResponse,
      statusConfirmed,
    ) as never;

    const customSigner: Signer = {
      address: () => 'addr_test1_custom',
      sign: async (_request: SignRequest): Promise<TxWitness> => {
        await Promise.resolve();
        return {
          key: { content: 'aabbccdd', contentType: 'hex' },
          signature: { content: 'deadbeef', contentType: 'hex' },
          type: 'vkey',
        };
      },
    };

    const client = baseBuilder()
      .withParty('sender', Party.signer(customSigner))
      .withParty('receiver', Party.address(RECEIVER_ADDR))
      .withParty('middleman', Party.address(RECEIVER_ADDR))
      .build();

    const status = await client
      .tx('transfer')
      .arg('quantity', 100)
      .resolve()
      .then((r) => r.sign())
      .then((s) => s.submit())
      .then((sub) => sub.waitForConfirmed(new PollConfig(3, 10)));

    expect(status.stage).toBe('confirmed');
  });

  test('case-insensitive party matching', async () => {
    const resolveResponse = jsonRpcOk({ hash: TX_HASH, tx: 'cafebabe' });
    globalThis.fetch = mockFetchSequence(resolveResponse) as never;

    const signer = Ed25519Signer.fromHex(SENDER_ADDR, SENDER_KEY);
    const client = baseBuilder()
      .withParty('SeNdEr', Party.signer(signer))
      .withParty('RECEIVER', Party.address(RECEIVER_ADDR))
      .withParty('Middleman', Party.address(RECEIVER_ADDR))
      .build();

    const resolved = await client.tx('transfer').arg('quantity', 100).resolve();
    expect(resolved.hash).toBe(TX_HASH);
  });

  test('PollConfig.default() returns 20 attempts, 5000ms delay', () => {
    const config = PollConfig.default();
    expect(config.attempts).toBe(20);
    expect(config.delayMs).toBe(5000);
  });

  test('withParties bulk attach on builder', async () => {
    const resolveResponse = jsonRpcOk({ hash: TX_HASH, tx: 'cafebabe' });
    globalThis.fetch = mockFetchSequence(resolveResponse) as never;

    const signer = Ed25519Signer.fromHex(SENDER_ADDR, SENDER_KEY);
    const client = baseBuilder()
      .withParties({
        sender: Party.signer(signer),
        receiver: Party.address(RECEIVER_ADDR),
        middleman: Party.address(RECEIVER_ADDR),
      })
      .build();

    const resolved = await client.tx('transfer').arg('quantity', 100).resolve();
    expect(resolved.hash).toBe(TX_HASH);
  });
});

describe('re-export canary', () => {
  test('top-level re-exports are defined', async () => {
    const mod = await import('../index.js');
    expect(mod.Tx3Client).toBeDefined();
    expect(mod.Tx3ClientBuilder).toBeDefined();
    expect(mod.Party).toBeDefined();
    expect(mod.PollConfig).toBeDefined();
    expect(mod.CardanoSigner).toBeDefined();
    expect(mod.Ed25519Signer).toBeDefined();
    expect(mod.Protocol).toBeDefined();
    expect(mod.TrpClient).toBeDefined();
    expect(mod.Tx3Error).toBeDefined();
    expect(mod.MissingTrpEndpointError).toBeDefined();
    expect(mod.BuilderError).toBeDefined();
    expect(mod.toJson).toBeDefined();
    expect(mod.fromJson).toBeDefined();
    expect(mod.trp).toBeDefined();
    expect(mod.tii).toBeDefined();
    expect(mod.signer).toBeDefined();
  });
});
