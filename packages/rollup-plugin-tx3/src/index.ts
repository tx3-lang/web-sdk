import type { Plugin } from "rollup";
import { execSync } from "child_process";
import path from "path";
import { globSync } from "glob";

export interface Tx3PluginOptions {
  // Path to the trix executable
  trixPath?: string;
  inputFiles?: string[];
}

interface SanitizedOptions {
  // Path to the trix executable
  trixPath: string;
  inputFiles: string[];
}

/**
 * Spread input files into absolute paths
 * @param inputFiles - Input files or glob patterns
 * @returns Absolute paths to the input files
 */
function spreadInputFiles(inputFiles: string[]) {
  const projectRoot = process.cwd();
  return inputFiles
    .map((pattern) => path.resolve(projectRoot, pattern))
    .flatMap((pattern) => globSync(pattern));
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
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    console.error("Failed to generate TX3 bindings:", error);
    throw error;
  }
}

function sanitizeOptions(options: Tx3PluginOptions): SanitizedOptions {
  const {
    trixPath,
    inputFiles,
  } = options;

  return {
    trixPath: trixPath || "trix",
    inputFiles: inputFiles || [],
  };
}

type Tx3Plugin = Plugin & {
  regenerateBindings: () => void;
  filesToWatch: () => string[];
};

export default function tx3RollupPlugin(options: Tx3PluginOptions): Tx3Plugin {
  const sanitizedOptions = sanitizeOptions(options);

  const plugin: Tx3Plugin = {
    name: "rollup-plugin-tx3",

    buildStart: () => generateBindings(sanitizedOptions),

    // Ensure bindings exist for production builds
    buildEnd() {
      generateBindings(sanitizedOptions);
    },

    // Expose regenerateBindings for the Vite plugin
    regenerateBindings: () => generateBindings(sanitizedOptions),

    filesToWatch: () => spreadInputFiles(sanitizedOptions.inputFiles),
  };

  return plugin;
}
