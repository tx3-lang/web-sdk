import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CardanoSigner } from '../../src/signer/cardano.js';
import { Party } from '../../src/facade/party.js';
import { PollConfig } from '../../src/facade/poll.js';
import { Protocol } from '../../src/tii/protocol.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, '../fixtures/transfer.tii');

const endpoint = process.env.TRP_ENDPOINT_PREPROD;
const apiKey = process.env.TRP_API_KEY_PREPROD;
const partyAAddress = process.env.TEST_PARTY_A_ADDRESS;
const partyAMnemonic = process.env.TEST_PARTY_A_MNEMONIC;
const partyBAddress = process.env.TEST_PARTY_B_ADDRESS;

const e2eTest = endpoint && partyAAddress && partyAMnemonic ? test : test.skip;

describe('Facade e2e', () => {
  e2eTest('resolve -> sign -> submit -> waitForConfirmed', async () => {
    const protocol = await Protocol.fromFile(FIXTURE);
    const signer = await CardanoSigner.fromMnemonic(partyAAddress as string, partyAMnemonic as string);
    const receiver = partyBAddress ?? partyAAddress;

    let builder = protocol
      .client()
      .trpEndpoint(endpoint as string)
      .withProfile('preprod');

    if (apiKey) {
      builder = builder.withHeader('dmtr-api-key', apiKey);
    }

    const tx3 = builder
      .withParty('sender', Party.signer(signer))
      .withParty('receiver', Party.address(receiver as string))
      .withParty('middleman', Party.address(receiver as string))
      .build();

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
