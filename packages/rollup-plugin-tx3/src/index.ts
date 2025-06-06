import type { Plugin } from "rollup";
import { execSync } from "child_process";
import path from "path";
import { globSync } from "glob";

export interface Tx3PluginOptions {
  // Path to the trix executable
  trixPath?: string;
}

interface SanitizedOptions {
  // Path to the trix executable
  trixPath: string;
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
  } = options;

  return {
    trixPath: trixPath || "trix"
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

    filesToWatch() {
      const projectRoot = process.cwd();
      return globSync(path.resolve(projectRoot, './*.tx3'))
    },
  };

  return plugin;
}
