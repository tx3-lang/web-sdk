import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

// Jest runs with the SDK package directory as the working directory.
const sdkRoot = process.cwd();
const repoRoot = dirname(sdkRoot);

/** Locates the tx3c binary: TX3_TX3C_PATH first, then $PATH. */
function resolveTx3c(): string {
  const fromEnv = process.env.TX3_TX3C_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  return 'tx3c';
}

describe('codegen client-lib plugin', () => {
  test('renders and type-checks against the transfer fixture', () => {
    const tiiPath = join(sdkRoot, 'tests/fixtures/transfer.tii');
    const templateDir = join(repoRoot, '.trix/client-lib');
    const outDir = mkdtempSync(join(tmpdir(), 'tx3-codegen-'));

    try {
      execFileSync(
        resolveTx3c(),
        ['codegen', '--tii', tiiPath, '--template', templateDir, '--output', outDir],
        { stdio: 'pipe' },
      );

      const protocolPath = join(outDir, 'protocol.ts');
      expect(existsSync(protocolPath)).toBe(true);

      // A successful render that produces uncompilable bindings is a failure.
      const tsconfig = {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          lib: ['ES2022', 'DOM'],
          strict: true,
          exactOptionalPropertyTypes: true,
          skipLibCheck: true,
          noEmit: true,
          types: ['node'],
          typeRoots: [join(sdkRoot, 'node_modules/@types')],
          baseUrl: '.',
          paths: {
            'tx3-sdk': [join(sdkRoot, 'src/index.ts')],
            'tx3-sdk/trp': [join(sdkRoot, 'src/trp/index.ts')],
          },
        },
        include: ['protocol.ts'],
      };
      writeFileSync(join(outDir, 'tsconfig.json'), JSON.stringify(tsconfig));

      const tsc = join(sdkRoot, 'node_modules/.bin/tsc');
      execFileSync(tsc, ['-p', join(outDir, 'tsconfig.json')], { stdio: 'pipe' });

      // Smoke-test the generated surface: the template must emit protocol
      // identity, the per-transaction types, and the profile surface.
      const protocolSrc = readFileSync(protocolPath, 'utf8');
      for (const symbol of [
        'TARGET_TII_VERSION',
        'export type TransferParams',
        'TRANSFER_TIR',
        'export class Client',
        'async transfer(',
        'PROFILES',
      ]) {
        expect(protocolSrc).toContain(symbol);
      }
    } catch (err) {
      const e = err as { stdout?: Buffer; stderr?: Buffer };
      const stdout = e.stdout?.toString() ?? '';
      const stderr = e.stderr?.toString() ?? '';
      throw new Error(`codegen render-fixture test failed:\n${stdout}\n${stderr}`);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }, 120000);
});
