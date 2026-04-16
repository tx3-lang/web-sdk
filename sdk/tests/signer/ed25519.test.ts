import { ed25519 } from '@noble/curves/ed25519';
import { Ed25519Signer } from '../../src/signer/ed25519.js';
import {
  InvalidHashError,
  InvalidPrivateKeyError,
  InvalidMnemonicError,
} from '../../src/signer/errors.js';
import { bytesToHex, hexToBytes } from '../../src/core/bytes.js';

const TEST_KEY_HEX = '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60';
const TEST_ADDRESS = 'addr_test1qz_dummy';

describe('Ed25519Signer', () => {
  test('constructor validates key length', () => {
    expect(() => new Ed25519Signer(TEST_ADDRESS, new Uint8Array(16))).toThrow(
      InvalidPrivateKeyError,
    );
  });

  test('fromHex creates signer', () => {
    const signer = Ed25519Signer.fromHex(TEST_ADDRESS, TEST_KEY_HEX);
    expect(signer.address()).toBe(TEST_ADDRESS);
  });

  test('fromHex rejects invalid hex', () => {
    expect(() => Ed25519Signer.fromHex(TEST_ADDRESS, 'not-hex')).toThrow(
      InvalidPrivateKeyError,
    );
  });

  test('fromHex rejects wrong length', () => {
    expect(() => Ed25519Signer.fromHex(TEST_ADDRESS, 'aabb')).toThrow(
      InvalidPrivateKeyError,
    );
  });

  test('sign produces correct public key and valid signature', async () => {
    const keyBytes = hexToBytes(TEST_KEY_HEX);
    const signer = new Ed25519Signer(TEST_ADDRESS, keyBytes);

    const expectedPubkey = ed25519.getPublicKey(keyBytes);
    const hashHex = 'aa'.repeat(32);

    const witness = await signer.sign(hashHex);

    expect(witness.type).toBe('vkey');
    expect(witness.key.contentType).toBe('hex');
    expect(witness.key.content).toBe(bytesToHex(expectedPubkey));
    expect(witness.signature.contentType).toBe('hex');

    const sigBytes = hexToBytes(witness.signature.content);
    const hashBytes = hexToBytes(hashHex);
    const valid = ed25519.verify(sigBytes, hashBytes, expectedPubkey);
    expect(valid).toBe(true);
  });

  test('sign rejects invalid hash hex', async () => {
    const signer = Ed25519Signer.fromHex(TEST_ADDRESS, TEST_KEY_HEX);
    await expect(signer.sign('not-hex')).rejects.toThrow(InvalidHashError);
  });

  test('sign rejects wrong hash length', async () => {
    const signer = Ed25519Signer.fromHex(TEST_ADDRESS, TEST_KEY_HEX);
    await expect(signer.sign('aabb')).rejects.toThrow(InvalidHashError);
  });

  test('sign returns a Promise', () => {
    const signer = Ed25519Signer.fromHex(TEST_ADDRESS, TEST_KEY_HEX);
    const result = signer.sign('aa'.repeat(32));
    expect(result).toBeInstanceOf(Promise);
  });

  test('fromMnemonic rejects invalid phrase', () => {
    expect(() => Ed25519Signer.fromMnemonic(TEST_ADDRESS, 'invalid words here')).toThrow(
      InvalidMnemonicError,
    );
  });
});
