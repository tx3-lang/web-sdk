import { TX3Config } from '../types/index.js';
import { updateTSConfigPaths } from './tsconfig-utils.js';
import path from 'path';
import fs from 'fs';

const defaultTX3Config: TX3Config = {
  tx3Path: './tx3',
  autoWatch: true,
  autoSetup: true,
  verbose: false
};

// Singleton to prevent multiple initializations
let isInitialized = false;

export function resetInitialization(): void {
  isInitialized = false;
}

export function isPluginInitialized(): boolean {
  return isInitialized;
}

export function markAsInitialized(): void {
  isInitialized = true;
}

export function resolveTX3Config(
  userConfig: Partial<TX3Config> = {},
  projectPath: string
): TX3Config {
  const resolved: TX3Config = {
    ...defaultTX3Config,
    ...userConfig
  };

  // Resolve relative paths
  resolved.tx3Path = path.resolve(projectPath, resolved.tx3Path);

  return resolved;
}

export function validateTX3Config(config: TX3Config): string[] {
  const errors: string[] = [];

  // Check if trix path exists
  if (!fs.existsSync(config.tx3Path)) {
    errors.push(`TX3 directory does not exist: ${config.tx3Path}`);
  }

  return errors;
}

export function ensureTX3Project(config: TX3Config, projectPath?: string): void {
  // Only auto-setup if enabled
  if (!config.autoSetup) {
    return;
  }

  // Create TX3 directory if it doesn't exist
  if (!fs.existsSync(config.tx3Path)) {
    fs.mkdirSync(config.tx3Path, { recursive: true });
  }

  // Create bindings directory
  const bindingsPath = path.join(config.tx3Path, 'bindings');
  if (!fs.existsSync(bindingsPath)) {
    fs.mkdirSync(bindingsPath, { recursive: true });
  }

  // Create trix.toml if it doesn't exist
  const trixTomlPath = path.join(config.tx3Path, 'trix.toml');
  if (!fs.existsSync(trixTomlPath)) {
    const trixTomlContent = `[protocol]
name = "tx3"
scope = ""
version = "0.0.0"
description = ""
main = "main.tx3"

[profiles.devnet]
chain = "CardanoDevnet"

[[profiles.devnet.wallets]]
name = "alice"
random_key = true
initial_balance = 1000000000000000000

[[profiles.devnet.wallets]]
name = "bob"
random_key = true
initial_balance = 1000000000000000000

[profiles.devnet.trp]
url = "http://localhost:8164"

[profiles.devnet.trp.headers]
api_key=""

[profiles.preview]
chain = "CardanoPreview"

[profiles.preprod]
chain = "CardanoPreprod"

[profiles.mainnet]
chain = "CardanoMainnet"

[[bindings]]
plugin = "typescript"
output_dir = "./bindings"
`;
    fs.writeFileSync(trixTomlPath, trixTomlContent);
  }

  // Create main.tx3 if it doesn't exist
  const mainTx3Path = path.join(config.tx3Path, 'main.tx3');
  if (!fs.existsSync(mainTx3Path)) {
    const mainTx3Content = `party Sender;

party Receiver;


tx transfer(
    quantity: Int
) {
    input source {
        from: Sender,
        min_amount: Ada(quantity),
    }
    
    output {
        to: Receiver,
        amount: Ada(quantity),
    }

    output {
        to: Sender,
        amount: source - Ada(quantity) - fees,
    }
}
`;
    fs.writeFileSync(mainTx3Path, mainTx3Content);
  }

  // Update TypeScript configuration with TX3 path aliases
  if (projectPath) {
    updateTSConfigPaths(projectPath, config);
  }
}
