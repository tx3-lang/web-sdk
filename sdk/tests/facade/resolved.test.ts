import { ResolvedTx } from '../../src/facade/resolved.js';
import type { TrpClient } from '../../src/trp/client.js';
import type { TxWitness } from '../../src/trp/spec.js';

const stubTrp = {} as TrpClient;

const fakeWitness = (keyHex: string, sigHex: string): TxWitness => ({
  key: { content: keyHex, contentType: 'hex' },
  signature: { content: sigHex, contentType: 'hex' },
  type: 'vkey',
});

const stubSigner = (addr: string, witness: TxWitness) => ({
  address: () => addr,
  sign: async (_req: { txHashHex: string; txCborHex: string }) => witness,
});

describe('ResolvedTx.addWitness', () => {
  test('manual-only sign succeeds with no registered signers', async () => {
    const witness = fakeWitness('aa', 'bb');
    const resolved = new ResolvedTx(stubTrp, 'deadbeef', '84a40081', []);

    const signed = await resolved.addWitness(witness).sign();

    expect(signed.submitParams.witnesses).toHaveLength(1);
    expect(signed.submitParams.witnesses[0]).toEqual(witness);
  });

  test('mixed: registered signer first, manual witness appended', async () => {
    const registered = fakeWitness('11', '22');
    const manual = fakeWitness('aa', 'bb');

    const resolved = new ResolvedTx(stubTrp, 'deadbeef', '84a40081', [
      { name: 'sender', address: 'addr_test1...', signer: stubSigner('addr_test1...', registered) },
    ]);

    const signed = await resolved.addWitness(manual).sign();

    expect(signed.submitParams.witnesses).toHaveLength(2);
    expect(signed.submitParams.witnesses[0].key.content).toBe('11');
    expect(signed.submitParams.witnesses[1].key.content).toBe('aa');
  });

  test('preserves attach order across multiple addWitness calls', async () => {
    const resolved = new ResolvedTx(stubTrp, 'deadbeef', '84a40081', [])
      .addWitness(fakeWitness('01', '10'))
      .addWitness(fakeWitness('02', '20'))
      .addWitness(fakeWitness('03', '30'));

    const signed = await resolved.sign();
    const keys = signed.submitParams.witnesses.map((w) => w.key.content);
    expect(keys).toEqual(['01', '02', '03']);
  });

  test('addWitness returns the same instance for chaining', () => {
    const resolved = new ResolvedTx(stubTrp, 'deadbeef', '84a40081', []);
    const result = resolved.addWitness(fakeWitness('aa', 'bb'));
    expect(result).toBe(resolved);
  });
});
