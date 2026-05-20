#!/usr/bin/env bash
#
# CI artifact — not part of the SDK.
#
# Renders the .trix/client-lib codegen plugin against the shared transfer
# fixture and verifies the result the way a consumer would: the rendered module
# is type-checked in a throwaway project with the published `tx3-sdk` installed
# from npm — no path overrides into the SDK source tree.
#
# Requires `tx3c` and `npm` on PATH.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
gen="$(mktemp -d)"
trap 'rm -rf "$gen"' EXIT

tx3c codegen \
  --tii "$repo_root/sdk/tests/fixtures/transfer.tii" \
  --template "$repo_root/.trix/client-lib" \
  --output "$gen"

test -f "$gen/protocol.ts" || { echo "missing generated file: protocol.ts"; exit 1; }

for sym in \
  'TARGET_TII_VERSION' \
  'export type TransferParams' \
  'TRANSFER_TIR' \
  'export class Client' \
  'async transfer(' \
  'PROFILES'; do
  grep -qF "$sym" "$gen/protocol.ts" || { echo "generated protocol.ts missing: $sym"; exit 1; }
done

# Type-check the rendered module in a fresh consumer project with `tx3-sdk`
# installed from npm, exactly as an end user would consume it.
proj="$gen/consumer"
mkdir -p "$proj"
cp "$gen/protocol.ts" "$proj/protocol.ts"
cd "$proj"
npm init -y >/dev/null
npm pkg set type=module >/dev/null
npm install --no-audit --no-fund tx3-sdk@latest typescript @types/node
./node_modules/.bin/tsc \
  --noEmit --strict --exactOptionalPropertyTypes \
  --target ES2022 --module nodenext --moduleResolution nodenext \
  --skipLibCheck \
  protocol.ts

echo "codegen check passed"
