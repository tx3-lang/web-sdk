# tx3-sdk (Web)

[![npm](https://img.shields.io/npm/v/tx3-sdk.svg)](https://www.npmjs.com/package/tx3-sdk)
[![CI](https://github.com/tx3-lang/web-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/tx3-lang/web-sdk/actions/workflows/ci.yml)
[![Tx3 docs](https://img.shields.io/badge/Tx3-docs-blue.svg)](https://docs.txpipe.io/tx3)

The official TypeScript / JavaScript SDK for [Tx3](https://docs.txpipe.io/tx3) — a DSL and protocol suite for defining and executing UTxO-based blockchain transactions declaratively. Load a compiled `.tii` protocol, bind parties and signers, and drive the full transaction lifecycle (resolve, sign, submit, confirm) via the Transaction Resolve Protocol (TRP).

This repository is organized as a monorepo. The publishable npm package lives in `sdk/`; framework integrations live alongside it (see [Framework integrations](#framework-integrations)).

## What is Tx3

Tx3 is a domain-specific language and protocol suite for declarative, type-safe UTxO transactions. Authors write `.tx3` files describing parties, environment, and transactions; the toolchain compiles them to `.tii` artifacts that this SDK loads at runtime to drive the resolve → sign → submit → wait lifecycle through a TRP server. See the [Tx3 docs](https://docs.txpipe.io/tx3) for project context.

## Installation

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

// 1. Load a compiled .tii protocol
const protocol = await Protocol.fromFile("./transfer.tii");

// 2. Connect to a TRP server
const trp = new TrpClient({ endpoint: "http://localhost:3000/rpc" });

// 3. Configure signer and parties
const signer = Ed25519Signer.fromHex("addr_test1...", "deadbeef...");

const tx3 = new Tx3Client(protocol, trp)
  .withProfile("preprod")
  .withParty("sender", Party.signer(signer))
  .withParty("receiver", Party.address("addr_test1..."));

// 4. Build, resolve, sign, submit, and wait for confirmation
const status = await tx3
  .tx("transfer")
  .arg("quantity", 10_000_000n)
  .resolve()
  .then((r) => r.sign())
  .then((s) => s.submit())
  .then((sub) => sub.waitForConfirmed(PollConfig.default()));

console.log(status.stage); // "confirmed"
```

## Concepts

| SDK Type | Glossary Term | Description |
|---|---|---|
| `Protocol` | TII / Protocol | Loaded `.tii` exposing transactions, parties, profiles |
| `Tx3Client` | Facade | Entry point holding protocol, TRP client, and party bindings |
| `TxBuilder` | Invocation builder | Collects args, resolves via TRP |
| `Party` | Party | `Party.address(...)` (read-only) or `Party.signer(...)` (signing) |
| `Signer` | Signer | Interface producing a `TxWitness` for a `SignRequest` |
| `SignRequest` | SignRequest | Input passed to `Signer.sign`: `txHashHex` + `txCborHex` |
| `CardanoSigner` | Cardano Signer | BIP32-Ed25519 signer at `m/1852'/1815'/0'/0/0` |
| `Ed25519Signer` | Ed25519 Signer | Generic raw-key Ed25519 signer |
| `Cip30Signer` | CIP-30 Wallet Signer | Browser-wallet (Eternl, Lace, Nami…) signer over CIP-30 |
| `ResolvedTx` | Resolved transaction | Output of `resolve()`, ready for signing |
| `SignedTx` | Signed transaction | Output of `sign()`, ready for submission |
| `SubmittedTx` | Submitted transaction | Output of `submit()`, pollable for status |
| `PollConfig` | Poll configuration | Controls `waitForConfirmed` / `waitForFinalized` polling |

## Advanced usage

### Subpath imports

The package exposes granular entry points for tree-shaking or when you only need a subset:

```ts
import { TrpClient } from "tx3-sdk/trp";
import { Protocol } from "tx3-sdk/tii";
import { CardanoSigner, Cip30Signer, cip30Party } from "tx3-sdk/signer";
```

### Browser usage

`Protocol.fromFile` uses `node:fs` and is Node-only. In the browser, fetch the `.tii` JSON yourself:

```ts
const protocol = Protocol.fromString(await (await fetch("/transfer.tii")).text());
```

### Low-level TRP client

If you don't want the facade, drive TRP directly:

```ts
import { TrpClient } from "tx3-sdk/trp";

const trp = new TrpClient({
  endpoint: "https://trp.example.com",
  headers: { "Authorization": "Bearer token" },
});

const envelope = await trp.resolve({ tir: { /* ... */ }, args: { quantity: 100 } });
const submitResp = await trp.submit({ tx: { content: envelope.tx, contentType: "hex" }, witnesses: [] });
const status = await trp.checkStatus([submitResp.hash]);
```

### Custom Signer

Implement the `Signer` interface. `sign` receives a `SignRequest` carrying both
the tx hash and the full tx CBOR; hash-based signers read `txHashHex`, tx-based
signers (e.g. wallet bridges) read `txCborHex`.

```ts
import type { SignRequest, Signer } from "tx3-sdk";
import type { TxWitness } from "tx3-sdk";

class MySigner implements Signer {
  address(): string { return "addr_test1..."; }

  async sign(request: SignRequest): Promise<TxWitness> {
    // sign request.txHashHex with your key
    return {
      key: { content: "aabb", contentType: "hex" },
      signature: { content: "ccdd", contentType: "hex" },
      type: "vkey",
    };
  }
}
```

### CIP-30 wallet bridge

`Cip30Signer` plus the `cip30Party(api)` factory let you plug a CIP-30 browser
wallet (Eternl, Lace, Nami, …) directly into the standard chain:

```ts
import { Tx3Client, Party } from "tx3-sdk";
import { cip30Party } from "tx3-sdk/signer";

const api = await window.cardano.eternl.enable();

const tx3 = new Tx3Client(protocol, trp)
  .withProfile("preprod")
  .withParty("sender", await cip30Party(api))
  .withParty("receiver", Party.address("addr_test1..."));
```

For multi-key wallets (where one wallet returns several vkey witnesses for a
single tx), call `decodeWitnessSet` directly and attach each witness via
`addWitness` (see below).

### Manual witness attachment

When a witness is produced outside any registered `Signer` — for example by an
external wallet app or a remote signing service — attach it to the `ResolvedTx`
before `sign()`:

```ts
import type { TxWitness } from "tx3-sdk";

const witness: TxWitness = /* from external wallet */;

const status = await tx3
  .tx("transfer")
  .arg("quantity", 10_000_000n)
  .resolve()
  .then((r) => r.addWitness(witness).sign())
  .then((s) => s.submit())
  .then((sub) => sub.waitForConfirmed(PollConfig.default()));
```

`addWitness` may be called any number of times; manual witnesses are appended after registered-signer witnesses in attach order.

### Framework integrations

Build-time codegen for typed `.tx3` imports lives outside the runtime SDK:

- [`vite-plugin-tx3`](https://www.npmjs.com/package/vite-plugin-tx3) — Vite plugin
- [`rollup-plugin-tx3`](https://www.npmjs.com/package/rollup-plugin-tx3) — Rollup plugin
- [`next-tx3`](https://www.npmjs.com/package/next-tx3) — Next.js integration
- [`install-tx3-nextjs`](https://www.npmjs.com/package/install-tx3-nextjs) — scaffolder for a Next.js + Tx3 starter

These are additions, not substitutes, for the runtime API documented above.

## Tx3 protocol compatibility

- **TRP protocol version:** v1beta0
- **TII schema version:** v1beta0
- **Runtime:** Node.js 18+, modern browsers (ESM), Bun, Deno

## Testing

- Unit tests are co-located with source files under `sdk/src/**`.
- End-to-end (e2e) tests live under `sdk/tests/e2e/` and run separately.

```bash
# from web-sdk/sdk
npm run test:unit
npm run test:e2e
```

## License

Apache-2.0
