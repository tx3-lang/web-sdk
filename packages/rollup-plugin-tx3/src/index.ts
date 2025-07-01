import type { Plugin } from "rollup";
import { execSync } from "child_process";
import path from "path";
import { globSync } from "glob";
import chalk from 'chalk';

export interface Tx3PluginOptions {
  // Path to the trix executable
  trixPath?: string;
}

interface SanitizedOptions {
  // Path to the trix executable
  trixPath: string;
}

export function isTrixAvailable(options: SanitizedOptions) {
  const { trixPath } = options;

  try {
    execSync(`${trixPath} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    console.log(chalk.red('❌ Trix compiler not found!'));
    console.log(chalk.yellow('\n📦 To install trix, run these commands:'));
    console.log(chalk.cyan('\n# Install tx3up installer'));
    console.log(chalk.white('curl --proto \'=https\' --tlsv1.2 -LsSf https://github.com/tx3-lang/up/releases/latest/download/tx3up-installer.sh | sh'));
    console.log(chalk.cyan('\n# Install trix'));
    console.log(chalk.white('tx3up'));
    console.log(chalk.yellow('\n💡 After installation, restart your development server.'));
  }
  return false;
}

function generateBindings(options: SanitizedOptions) {
  const {
    trixPath,
  } = options;

  const command = [
    trixPath,
    "bindgen",
  ].join(" ");

  try {
    // By using inherit, we will have the Error output from Trix (keeping colors and formatting)
    execSync(command, { stdio: 'inherit' });
  } catch (_) {
    // Ignore error param. Show that the command failed
    console.error("Failed to generate TX3 bindings");
  }
}

function sanitizeOptions(options?: Tx3PluginOptions): SanitizedOptions {
  const {
    trixPath,
  } = options || {};

  return {
    trixPath: trixPath || "trix"
  };
}

type Tx3Plugin = Plugin & {
  // If we initialized the plugin without trix installed, we can still use the plugin
  // but we will not be able to generate bindings until trix is installed
  filesToWatch: () => string[];
} & (
  | { partialInitialized: false; regenerateBindings: () => void; }
  | { partialInitialized: true; }
);

export default function tx3RollupPlugin(options?: Tx3PluginOptions): Tx3Plugin {
  const sanitizedOptions = sanitizeOptions(options);

  const trixAvailable = isTrixAvailable(sanitizedOptions);

  const basePlugin: Tx3Plugin = {
    name: "rollup-plugin-tx3",

    partialInitialized: true,

    filesToWatch() {
      const projectRoot = process.cwd();
      return globSync(path.resolve(projectRoot, './*.tx3'))
    },
  };

  if (!trixAvailable) {
    console.log(chalk.yellow('\n⚠️  TX3 plugin will continue without compilation until trix is installed.'));
    return basePlugin;
  }

  return {
    ...basePlugin,
    partialInitialized: false,
    buildStart: () => generateBindings(sanitizedOptions),

    // Ensure bindings exist for production builds
    buildEnd() {
      generateBindings(sanitizedOptions);
    },

    // Expose regenerateBindings for the Vite plugin
    regenerateBindings: () => generateBindings(sanitizedOptions),
  };
}
