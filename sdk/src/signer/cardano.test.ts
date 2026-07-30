import { ed25519 } from '@noble/curves/ed25519';
import bip32ed25519 from '@stricahq/bip32ed25519';
import { bech32 } from 'bech32';

import { bytesToHex, hexToBytes } from '../core/bytes.js';
import { CardanoSigner } from './cardano.js';
import { AddressMismatchError } from './errors.js';

// Well-known BIP39 test vector (24 words).
const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon ' +
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon ' +
  'abandon abandon abandon abandon abandon art';

/**
 * Derives the CIP-1852 payment key hash (`m/1852'/1815'/0'/0/0`) for the test
 * mnemonic and wraps it in a testnet enterprise address (header 0x60).
 */
async function testnetEnterpriseAddress(mnemonic: string): Promise<string> {
  const { mnemonicToEntropy } = await import('@scure/bip39');
  const { wordlist } = await import('@scure/bip39/wordlists/english');
  const entropy = mnemonicToEntropy(mnemonic, wordlist);

  const root = await bip32ed25519.Bip32PrivateKey.fromEntropy(Buffer.from(entropy));
  const paymentKeyHash = root
    .deriveHardened(1852)
    .deriveHardened(1815)
    .deriveHardened(0)
    .derive(0)
    .derive(0)
    .toPrivateKey()
    .toPublicKey()
    .hash();

  const data = new Uint8Array(1 + paymentKeyHash.length);
  data[0] = 0x60; // enterprise address, key-hash credential, testnet
  data.set(paymentKeyHash, 1);
  return bech32.encode('addr_test', bech32.toWords(data), 1023);
}

/** Extracts the payment key hash back out of the bech32 address. */
function paymentKeyHashOf(address: string): Uint8Array {
  const decoded = bech32.decode(address, 1023);
  const data = Uint8Array.from(bech32.fromWords(decoded.words));
  return data.slice(1, 29);
}

describe('CardanoSigner', () => {
  const req = (txHashHex: string) => ({ txHashHex, txCborHex: '' });

  test('fromMnemonic derives the key the address binds to and its witness verifies', async () => {
    // Regression guard for the "witness that does not sign" report: the
    // witness vkey MUST hash to the address's payment credential, and the
    // signature MUST verify under that vkey — together they make the witness
    // satisfy the tx's required signer.
    const address = await testnetEnterpriseAddress(TEST_MNEMONIC);
    const signer = await CardanoSigner.fromMnemonic(address, TEST_MNEMONIC);
    expect(signer.address()).toBe(address);

    const hashHex = 'ab'.repeat(32);
    const witness = await signer.sign(req(hashHex));

    expect(witness.type).toBe('vkey');
    expect(witness.key.contentType).toBe('hex');
    expect(witness.signature.contentType).toBe('hex');

    // vkey ↔ address binding
    const publicKey = hexToBytes(witness.key.content);
    const derivedHash = new bip32ed25519.PublicKey(Buffer.from(publicKey)).hash();
    expect(bytesToHex(Uint8Array.from(derivedHash))).toBe(
      bytesToHex(paymentKeyHashOf(address)),
    );

    // signature ↔ vkey binding
    const valid = ed25519.verify(
      hexToBytes(witness.signature.content),
      hexToBytes(hashHex),
      publicKey,
    );
    expect(valid).toBe(true);
  });

  test('fromMnemonic rejects an address the derived key does not bind to', async () => {
    // The defect the removed `Ed25519Signer.fromMnemonic` had: silently
    // accepting an address its key can never witness for. `CardanoSigner`
    // must fail loudly instead.
    const otherAddress = await testnetEnterpriseAddress(
      'legal winner thank year wave sausage worth useful legal winner thank ' +
        'year wave sausage worth useful legal winner thank year wave sausage ' +
        'worth title',
    );
    await expect(
      CardanoSigner.fromMnemonic(otherAddress, TEST_MNEMONIC),
    ).rejects.toThrow(AddressMismatchError);
  });
});
