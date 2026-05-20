#!/usr/bin/env bash
#
# CI artifact — not part of the SDK.
#
# Renders the .trix/client-lib codegen plugin against the shared transfer
# fixture and verifies the result. The subject under test is the Handlebars
# templates + tx3c integration, not the SDK runtime.
#
# Steps: invoke `tx3c codegen`, assert the expected file exists, smoke-check
# the generated surface, and type-check the output against this repo's SDK.
#
# Requires `tx3c` on PATH and the SDK's node_modules installed.
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

# Type-check the rendered module against this repo's SDK sources.
printf '{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"bundler","lib":["ES2022","DOM"],"strict":true,"exactOptionalPropertyTypes":true,"skipLibCheck":true,"noEmit":true,"types":["node"],"typeRoots":["%s/sdk/node_modules/@types"],"baseUrl":".","paths":{"tx3-sdk":["%s/sdk/src/index.ts"],"tx3-sdk/trp":["%s/sdk/src/trp/index.ts"]}},"include":["protocol.ts"]}\n' \
  "$repo_root" "$repo_root" "$repo_root" > "$gen/tsconfig.json"
"$repo_root/sdk/node_modules/.bin/tsc" -p "$gen/tsconfig.json"

echo "codegen check passed"
