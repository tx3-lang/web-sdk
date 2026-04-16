import { jest } from '@jest/globals';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Protocol } from '../../src/tii/protocol.js';
import { TrpClient } from '../../src/trp/client.js';
import { Tx3Client } from '../../src/facade/client.js';
import { Party } from '../../src/facade/party.js';
import { PollConfig } from '../../src/facade/poll.js';
import { Ed25519Signer } from '../../src/signer/ed25519.js';
import {
  UnknownPartyError,
  MissingParamsError,
  SubmitHashMismatchError,
  FinalizedFailedError,
  FinalizedTimeoutError,
} from '../../src/facade/errors.js';
import type { TxWitness } from '../../src/trp/spec.js';
import type { Signer } from '../../src/signer/signer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, '../fixtures/transfer.tii');
const SENDER_KEY = 'aa'.repeat(32);
const SENDER_ADDR = 'addr_test1_sender';
const RECEIVER_ADDR = 'addr_test1_receiver';
const TX_HASH = 'bb'.repeat(32);
const DEFAULT_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const INTEGRATION_ENV = {
  endpoint: process.env.TRP_ENDPOINT_PREPROD ?? 'http://localhost:9999/rpc',
  apiKey: process.env.TRP_API_KEY_PREPROD ?? '',
  partyAAddress: process.env.TEST_PARTY_A_ADDRESS ?? SENDER_ADDR,
  partyAMnemonic:
    process.env.TEST_PARTY_A_MNEMONIC ?? process.env.TEST_PARTY_B_MNEMONIC ?? DEFAULT_MNEMONIC,
  partyBAddress: process.env.TEST_PARTY_B_ADDRESS ?? RECEIVER_ADDR,
  partyBMnemonic:
    process.env.TEST_PARTY_B_MNEMONIC ?? process.env.TEST_PARTY_A_MNEMONIC ?? DEFAULT_MNEMONIC,
};

function makeTrpClient(): TrpClient {
  const headers = INTEGRATION_ENV.apiKey
    ? { 'dmtr-api-key': INTEGRATION_ENV.apiKey }
    : undefined;
  return new TrpClient({ endpoint: INTEGRATION_ENV.endpoint, headers });
}

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

beforeAll(async () => {
  protocol = await Protocol.fromFile(FIXTURE);
});

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('Facade integration', () => {
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

    const trp = makeTrpClient();
    const signer = Ed25519Signer.fromHex(INTEGRATION_ENV.partyAAddress, SENDER_KEY);

    const tx3 = new Tx3Client(protocol, trp)
      .withProfile('preprod')
      .withParty('sender', Party.signer(signer))
      .withParty('receiver', Party.address(INTEGRATION_ENV.partyBAddress))
      .withParty('middleman', Party.address(INTEGRATION_ENV.partyBAddress));

    const status = await tx3
      .tx('transfer')
      .arg('quantity', 10_000_000)
      .resolve()
      .then((r) => r.sign())
      .then((s) => s.submit())
      .then((sub) => sub.waitForConfirmed(new PollConfig(5, 10)));

    expect(status.stage).toBe('confirmed');
    expect(status.confirmations).toBe(5);
  });

  test('UnknownPartyError when party not in protocol', async () => {
    const trp = makeTrpClient();

    const tx3 = new Tx3Client(protocol, trp)
      .withParty('stranger', Party.address('addr_test1_stranger'));

    await expect(
      tx3.tx('transfer').arg('quantity', 100).resolve(),
    ).rejects.toThrow(UnknownPartyError);
  });

  test('MissingParamsError when arg is missing', async () => {
    const resolveResponse = jsonRpcOk({ hash: TX_HASH, tx: 'cafebabe' });
    globalThis.fetch = mockFetchSequence(resolveResponse) as never;

    const trp = makeTrpClient();
    const signer = Ed25519Signer.fromHex(INTEGRATION_ENV.partyAAddress, SENDER_KEY);

    const tx3 = new Tx3Client(protocol, trp)
      .withProfile('preprod')
      .withParty('sender', Party.signer(signer))
      .withParty('receiver', Party.address(INTEGRATION_ENV.partyBAddress))
      .withParty('middleman', Party.address(INTEGRATION_ENV.partyBAddress));

    await expect(tx3.tx('transfer').resolve()).rejects.toThrow(MissingParamsError);
  });

  test('SubmitHashMismatchError when server returns different hash', async () => {
    const resolveResponse = jsonRpcOk({ hash: TX_HASH, tx: 'cafebabe' });
    const submitResponse = jsonRpcOk({ hash: 'different_hash' });

    globalThis.fetch = mockFetchSequence(resolveResponse, submitResponse) as never;

    const trp = makeTrpClient();
    const signer = Ed25519Signer.fromHex(INTEGRATION_ENV.partyAAddress, SENDER_KEY);

    const tx3 = new Tx3Client(protocol, trp)
      .withProfile('preprod')
      .withParty('sender', Party.signer(signer))
      .withParty('receiver', Party.address(INTEGRATION_ENV.partyBAddress))
      .withParty('middleman', Party.address(INTEGRATION_ENV.partyBAddress));

    const resolved = await tx3.tx('transfer').arg('quantity', 100).resolve();
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

    const trp = makeTrpClient();
    const signer = Ed25519Signer.fromHex(INTEGRATION_ENV.partyAAddress, SENDER_KEY);

    const tx3 = new Tx3Client(protocol, trp)
      .withProfile('preprod')
      .withParty('sender', Party.signer(signer))
      .withParty('receiver', Party.address(INTEGRATION_ENV.partyBAddress))
      .withParty('middleman', Party.address(INTEGRATION_ENV.partyBAddress));

    const submitted = await tx3
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

    const trp = makeTrpClient();
    const signer = Ed25519Signer.fromHex(INTEGRATION_ENV.partyAAddress, SENDER_KEY);

    const tx3 = new Tx3Client(protocol, trp)
      .withProfile('preprod')
      .withParty('sender', Party.signer(signer))
      .withParty('receiver', Party.address(INTEGRATION_ENV.partyBAddress))
      .withParty('middleman', Party.address(INTEGRATION_ENV.partyBAddress));

    const submitted = await tx3
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
      sign: async (hash: string): Promise<TxWitness> => {
        await Promise.resolve();
        return {
          key: { content: 'aabbccdd', contentType: 'hex' },
          signature: { content: 'deadbeef', contentType: 'hex' },
          type: 'vkey',
        };
      },
    };

    const trp = makeTrpClient();
    const tx3 = new Tx3Client(protocol, trp)
      .withProfile('preprod')
      .withParty('sender', Party.signer(customSigner))
      .withParty('receiver', Party.address(INTEGRATION_ENV.partyBAddress))
      .withParty('middleman', Party.address(INTEGRATION_ENV.partyBAddress));

    const status = await tx3
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

    const trp = makeTrpClient();
    const signer = Ed25519Signer.fromHex(INTEGRATION_ENV.partyAAddress, SENDER_KEY);

    const tx3 = new Tx3Client(protocol, trp)
      .withProfile('preprod')
      .withParty('SeNdEr', Party.signer(signer))
      .withParty('RECEIVER', Party.address(INTEGRATION_ENV.partyBAddress))
      .withParty('Middleman', Party.address(INTEGRATION_ENV.partyBAddress));

    const resolved = await tx3
      .tx('transfer')
      .arg('quantity', 100)
      .resolve();

    expect(resolved.hash).toBe(TX_HASH);
  });

  test('PollConfig.default() returns 20 attempts, 5000ms delay', () => {
    const config = PollConfig.default();
    expect(config.attempts).toBe(20);
    expect(config.delayMs).toBe(5000);
  });

  test('withProfile returns a new client', () => {
    const trp = makeTrpClient();
    const a = new Tx3Client(protocol, trp);
    const b = a.withProfile('preprod');
    expect(b).not.toBe(a);
  });

  test('withParties bulk attach', async () => {
    const resolveResponse = jsonRpcOk({ hash: TX_HASH, tx: 'cafebabe' });
    globalThis.fetch = mockFetchSequence(resolveResponse) as never;

    const trp = makeTrpClient();
    const signer = Ed25519Signer.fromHex(INTEGRATION_ENV.partyAAddress, SENDER_KEY);

    const tx3 = new Tx3Client(protocol, trp)
      .withProfile('preprod')
      .withParties({
        sender: Party.signer(signer),
        receiver: Party.address(INTEGRATION_ENV.partyBAddress),
        middleman: Party.address(INTEGRATION_ENV.partyBAddress),
      });

    const resolved = await tx3
      .tx('transfer')
      .arg('quantity', 100)
      .resolve();

    expect(resolved.hash).toBe(TX_HASH);
  });
});

describe('re-export canary', () => {
  test('top-level re-exports are defined', async () => {
    const mod = await import('../../src/index.js');
    expect(mod.Tx3Client).toBeDefined();
    expect(mod.Party).toBeDefined();
    expect(mod.PollConfig).toBeDefined();
    expect(mod.CardanoSigner).toBeDefined();
    expect(mod.Ed25519Signer).toBeDefined();
    expect(mod.Protocol).toBeDefined();
    expect(mod.TrpClient).toBeDefined();
    expect(mod.Tx3Error).toBeDefined();
    expect(mod.toJson).toBeDefined();
    expect(mod.fromJson).toBeDefined();
    expect(mod.trp).toBeDefined();
    expect(mod.tii).toBeDefined();
    expect(mod.signer).toBeDefined();
  });
});
