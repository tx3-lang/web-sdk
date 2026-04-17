# tx3-sdk

TypeScript/JavaScript SDK for the [Tx3](https://tx3.land) transaction protocol. Load compiled `.tii` artifacts at runtime, resolve and sign transactions through TRP, and poll for on-chain confirmation — all from a single builder chain.

## Install

```bash
npm install tx3-sdk
```

## Quick start

```ts
import {
  Tx3Client,
  Protocol,
  TrpClient,
  Party,
  Ed25519Signer,
  PollConfig,
} from "tx3-sdk";

// 1. Load the protocol (compiled .tii file)
const protocol = await Protocol.fromFile("./transfer.tii");

// 2. Connect to a TRP server
const trp = new TrpClient({ endpoint: "http://localhost:3000/rpc" });

// 3. Set up signers and parties
const signer = Ed25519Signer.fromHex("addr_test1...", "deadbeef...");

const tx3 = new Tx3Client(protocol, trp)
  .withProfile("preprod")
  .withParty("sender", Party.signer(signer))
  .withParty("receiver", Party.address("addr_test1..."));

// 4. Build, sign, submit, and wait
const status = await tx3
  .tx("transfer")
  .arg("quantity", 10_000_000n)
  .resolve()
  .then((r) => r.sign())
  .then((s) => s.submit())
  .then((sub) => sub.waitForConfirmed(PollConfig.default()));

console.log(status.stage); // "confirmed"
```

## Subpath imports

The package exposes granular entry points for tree-shaking or when you only need a subset:

```ts
import { TrpClient } from "tx3-sdk/trp";
import { Protocol } from "tx3-sdk/tii";
import { CardanoSigner } from "tx3-sdk/signer";
```

## Browser usage

`Protocol.fromFile` uses `node:fs` and is Node-only. In the browser, fetch the `.tii` JSON yourself:

```ts
const protocol = Protocol.fromString(await (await fetch("/transfer.tii")).text());
```

## Compatibility

- **TRP protocol:** v1beta0
- **TII schema:** v1beta0
- **Runtime:** Node.js 18+, modern browsers (ESM), Bun, Deno

## Testing

- Unit tests are co-located with source files under `sdk/src/**`.
- Integration tests live under `sdk/tests/integration/` and run separately.

```bash
# from web-sdk/sdk
npm run test:unit
npm run test:integration
```

## License

Apache-2.0
