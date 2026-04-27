import { jest } from '@jest/globals';
import { encode as encodeCbor } from 'cborg';

import {
  Cip30AdapterError,
  Cip30Signer,
  cip30Party,
  decodeWitnessSet,
  type Cip30Api,
} from './cip30.js';
import { ResolvedTx } from '../facade/resolved.js';
import { bytesToHex } from '../core/bytes.js';
import type { TrpClient } from '../trp/client.js';

function buildWitnessSetHex(
  witnesses: Array<{ key: Uint8Array; sig: Uint8Array }>,
): string {
  const map = new Map<number, Uint8Array[][]>();
  map.set(
    0,
    witnesses.map(({ key, sig }) => [key, sig]),
  );
  return bytesToHex(encodeCbor(map));
}

const KEY_BYTES = new Uint8Array(32).fill(0x11);
const SIG_BYTES = new Uint8Array(64).fill(0x22);
const KEY_HEX = '11'.repeat(32);
const SIG_HEX = '22'.repeat(64);
const TESTNET_PAYMENT_ADDRESS_HEX = '00' + 'aa'.repeat(28) + 'bb'.repeat(28);

function mockApi(overrides?: Partial<Cip30Api>): Cip30Api {
  const witnessSet = buildWitnessSetHex([{ key: KEY_BYTES, sig: SIG_BYTES }]);
  return {
    signTx: jest.fn(async () => witnessSet),
    getChangeAddress: jest.fn(async () => TESTNET_PAYMENT_ADDRESS_HEX),
    getNetworkId: jest.fn(async () => 0),
    ...overrides,
  };
}

const req = (txHashHex: string, txCborHex: string) => ({ txHashHex, txCborHex });

describe('decodeWitnessSet', () => {
  test('decodes a single vkey witness', () => {
    const hex = buildWitnessSetHex([{ key: KEY_BYTES, sig: SIG_BYTES }]);
    expect(decodeWitnessSet(hex)).toEqual([
      {
        key: { content: KEY_HEX, contentType: 'hex' },
        signature: { content: SIG_HEX, contentType: 'hex' },
        type: 'vkey',
      },
    ]);
  });

  test('decodes multiple vkey witnesses', () => {
    const second = { key: new Uint8Array(32).fill(0x33), sig: new Uint8Array(64).fill(0x44) };
    const hex = buildWitnessSetHex([{ key: KEY_BYTES, sig: SIG_BYTES }, second]);
    const witnesses = decodeWitnessSet(hex);
    expect(witnesses).toHaveLength(2);
    expect(witnesses[1].key.content).toBe('33'.repeat(32));
  });

  test('returns empty array when witness set has no vkey witnesses', () => {
    const map = new Map<number, unknown>();
    map.set(1, []);
    const hex = bytesToHex(encodeCbor(map));
    expect(decodeWitnessSet(hex)).toEqual([]);
  });

  test('throws on invalid hex', () => {
    expect(() => decodeWitnessSet('not-hex')).toThrow(Cip30AdapterError);
  });

  test('throws on non-CBOR payload', () => {
    expect(() => decodeWitnessSet('ff'.repeat(8))).toThrow(Cip30AdapterError);
  });
});

describe('Cip30Signer', () => {
  test('sign uses the SignRequest txCborHex (ignores txHashHex) and returns first vkey witness', async () => {
    const api = mockApi();
    const signer = new Cip30Signer(api, 'addr_test1...');
    const witness = await signer.sign(req('deadbeef', '84a40081'));
    expect(witness.key.content).toBe(KEY_HEX);
    expect(witness.signature.content).toBe(SIG_HEX);
    expect(api.signTx).toHaveBeenCalledWith('84a40081', true);
  });

  test('warns when wallet returns multi-key witness set', async () => {
    const second = { key: new Uint8Array(32).fill(0x33), sig: new Uint8Array(64).fill(0x44) };
    const api = mockApi({
      signTx: jest.fn(async () =>
        buildWitnessSetHex([{ key: KEY_BYTES, sig: SIG_BYTES }, second]),
      ),
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const signer = new Cip30Signer(api, 'addr_test1...');
      const witness = await signer.sign(req('', '84a40081'));
      expect(witness.key.content).toBe(KEY_HEX);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('2 vkey witnesses'));
    } finally {
      warn.mockRestore();
    }
  });

  test('throws Cip30AdapterError when wallet rejects signTx', async () => {
    const api = mockApi({
      signTx: jest.fn(async () => {
        throw new Error('user declined');
      }),
    });
    const signer = new Cip30Signer(api, 'addr_test1...');
    await expect(signer.sign(req('', '84a40081'))).rejects.toBeInstanceOf(Cip30AdapterError);
  });

  test('throws when wallet returns empty witness set', async () => {
    const map = new Map<number, unknown>();
    map.set(1, []);
    const hex = bytesToHex(encodeCbor(map));
    const api = mockApi({ signTx: jest.fn(async () => hex) });
    const signer = new Cip30Signer(api, 'addr_test1...');
    await expect(signer.sign(req('', '84a40081'))).rejects.toBeInstanceOf(Cip30AdapterError);
  });

  test('respects partialSign override', async () => {
    const api = mockApi();
    const signer = new Cip30Signer(api, 'addr_test1...', { partialSign: false });
    await signer.sign(req('', '84a40081'));
    expect(api.signTx).toHaveBeenCalledWith('84a40081', false);
  });
});

describe('cip30Party', () => {
  test('returns a Party.signer bound to a bech32 address derived from the wallet change address', async () => {
    const api = mockApi();
    const party = await cip30Party(api);
    expect(party.kind).toBe('signer');
    expect(party.address.startsWith('addr_test')).toBe(true);
    expect(api.getChangeAddress).toHaveBeenCalled();
  });

  test('uses mainnet hrp when wallet network id is 1', async () => {
    const api = mockApi({ getNetworkId: jest.fn(async () => 1) });
    const party = await cip30Party(api);
    expect(party.address.startsWith('addr1')).toBe(true);
  });

  test('throws on wallet getChangeAddress rejection', async () => {
    const api = mockApi({
      getChangeAddress: jest.fn(async () => {
        throw new Error('not authorized');
      }),
    });
    await expect(cip30Party(api)).rejects.toBeInstanceOf(Cip30AdapterError);
  });
});

describe('Cip30Signer integrated with ResolvedTx.sign()', () => {
  test('SignRequest.txCborHex is forwarded to wallet; witness ends up in submitParams', async () => {
    const api = mockApi();
    const signer = new Cip30Signer(api, 'addr_test1...');
    const stubTrp = {} as TrpClient;
    const resolved = new ResolvedTx(stubTrp, 'deadbeef', '84a40081deadbeef', [
      { name: 'sender', address: 'addr_test1...', signer },
    ]);

    const signed = await resolved.sign();
    expect(signed.submitParams.witnesses).toHaveLength(1);
    expect(signed.submitParams.witnesses[0].key.content).toBe(KEY_HEX);
    expect(api.signTx).toHaveBeenCalledWith('84a40081deadbeef', true);
  });
});
