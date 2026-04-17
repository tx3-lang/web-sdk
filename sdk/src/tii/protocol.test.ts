import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Protocol } from './protocol.js';
import {
  UnknownTxError,
  UnknownProfileError,
} from './errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, '../../tests/fixtures/transfer.tii');

describe('Protocol', () => {
  let protocol: Protocol;

  beforeAll(async () => {
    protocol = await Protocol.fromFile(FIXTURE);
  });

  test('fromFile loads successfully', () => {
    expect(protocol).toBeDefined();
  });

  test('fromString loads from JSON string', async () => {
    const { readFile } = await import('node:fs/promises');
    const json = await readFile(FIXTURE, 'utf8');
    const p = Protocol.fromString(json);
    expect(Object.keys(p.txs())).toContain('transfer');
  });

  test('fromJson loads from parsed object', async () => {
    const { readFile } = await import('node:fs/promises');
    const json = JSON.parse(await readFile(FIXTURE, 'utf8'));
    const p = Protocol.fromJson(json);
    expect(Object.keys(p.txs())).toContain('transfer');
  });

  test('txs() returns transactions', () => {
    const txs = protocol.txs();
    expect(Object.keys(txs)).toEqual(['transfer']);
  });

  test('parties() returns sender, receiver, middleman', () => {
    const parties = protocol.parties();
    expect(Object.keys(parties).sort()).toEqual(['middleman', 'receiver', 'sender']);
  });

  describe('invoke', () => {
    test('invoke without profile returns invocation with params', () => {
      const inv = protocol.invoke('transfer');
      const params = [...inv.params().keys()].sort();
      expect(params).toContain('quantity');
      expect(params).toContain('sender');
      expect(params).toContain('receiver');
      expect(params).toContain('middleman');
      expect(params).toContain('tax');
    });

    test('invoke with preprod profile pre-populates tax', () => {
      const inv = protocol.invoke('transfer', 'preprod');
      const unspecified = [...inv.unspecifiedParams()].map(([k]) => k).sort();
      expect(unspecified).not.toContain('tax');
      expect(unspecified).toContain('quantity');
      expect(unspecified).toContain('sender');
    });

    test('invoke with unknown tx throws UnknownTxError', () => {
      expect(() => protocol.invoke('nonexistent')).toThrow(UnknownTxError);
    });

    test('invoke with unknown profile throws UnknownProfileError', () => {
      expect(() => protocol.invoke('transfer', 'nonexistent')).toThrow(UnknownProfileError);
    });
  });

  describe('Invocation methods', () => {
    test('setArg + unspecifiedParams', () => {
      const inv = protocol.invoke('transfer');
      inv.setArg('quantity', 100);
      const unspecified = [...inv.unspecifiedParams()].map(([k]) => k);
      expect(unspecified).not.toContain('quantity');
    });

    test('setArgs bulk', () => {
      const inv = protocol.invoke('transfer');
      inv.setArgs({ quantity: 100, sender: 'addr1' });
      const unspecified = [...inv.unspecifiedParams()].map(([k]) => k);
      expect(unspecified).not.toContain('quantity');
      expect(unspecified).not.toContain('sender');
    });

    test('withArg returns new Invocation', () => {
      const inv = protocol.invoke('transfer');
      const inv2 = inv.withArg('quantity', 100);
      expect(inv2).not.toBe(inv);
      expect([...inv2.unspecifiedParams()].map(([k]) => k)).not.toContain('quantity');
      expect([...inv.unspecifiedParams()].map(([k]) => k)).toContain('quantity');
    });

    test('key normalization is case-insensitive', () => {
      const inv = protocol.invoke('transfer');
      inv.setArg('QUANTITY', 100);
      const unspecified = [...inv.unspecifiedParams()].map(([k]) => k);
      expect(unspecified).not.toContain('quantity');
    });

    test('intoResolveRequest builds resolve params', () => {
      const inv = protocol.invoke('transfer');
      inv.setArgs({
        quantity: 100,
        sender: 'addr1',
        receiver: 'addr2',
        middleman: 'addr3',
        tax: 5000000,
      });
      const req = inv.intoResolveRequest();
      expect(req.tir).toBeDefined();
      expect(req.args).toBeDefined();
      expect(req.args.quantity).toBe(100);
    });
  });
});
