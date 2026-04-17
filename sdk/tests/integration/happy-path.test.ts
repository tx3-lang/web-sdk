import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CardanoSigner } from '../../src/signer/cardano.js';
import { Party } from '../../src/facade/party.js';
import { PollConfig } from '../../src/facade/poll.js';
import { Tx3Client } from '../../src/facade/client.js';
import { Protocol } from '../../src/tii/protocol.js';
import { TrpClient } from '../../src/trp/client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, '../fixtures/transfer.tii');

const endpoint = process.env.TRP_ENDPOINT_PREPROD;
const apiKey = process.env.TRP_API_KEY_PREPROD;
const partyAAddress = process.env.TEST_PARTY_A_ADDRESS;
const partyAMnemonic = process.env.TEST_PARTY_A_MNEMONIC;
const partyBAddress = process.env.TEST_PARTY_B_ADDRESS;

const integrationTest = endpoint && partyAAddress && partyAMnemonic ? test : test.skip;

describe('Facade integration', () => {
  integrationTest('resolve -> sign -> submit -> waitForConfirmed', async () => {
    const protocol = await Protocol.fromFile(FIXTURE);
    const signer = await CardanoSigner.fromMnemonic(partyAAddress as string, partyAMnemonic as string);
    const headers = apiKey ? { 'dmtr-api-key': apiKey } : undefined;

    const trp = new TrpClient({ endpoint: endpoint as string, headers });
    const receiver = partyBAddress ?? partyAAddress;

    const tx3 = new Tx3Client(protocol, trp)
      .withProfile('preprod')
      .withParty('sender', Party.signer(signer))
      .withParty('receiver', Party.address(receiver as string))
      .withParty('middleman', Party.address(receiver as string));

    const status = await tx3
      .tx('transfer')
      .arg('quantity', 10_000_000)
      .resolve()
      .then((resolved) => resolved.sign())
      .then((signed) => signed.submit())
      .then((submitted) => submitted.waitForConfirmed(new PollConfig(25, 5000)));

    expect(['confirmed', 'finalized']).toContain(status.stage);
  }, 180000);
});
