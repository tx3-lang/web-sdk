import type { Plugin } from "vite";
import path from "path";
import tx3RollupPlugin from "rollup-plugin-tx3";
import type { Tx3PluginOptions } from "rollup-plugin-tx3";

export type { Tx3PluginOptions };

export default function tx3VitePlugin(options?: Tx3PluginOptions): Plugin {
  const rollupPlugin = tx3RollupPlugin(options);

  return {
    ...rollupPlugin,
    name: "vite-plugin-tx3",

    config(config) {
      return {
        resolve: {
          alias: {
            "@tx3": path.resolve(process.cwd(), "node_modules/.tx3"),
            ...(config.resolve?.alias || {}),
          },
        },
      };
    },

    // Add Vite-specific configuration
    configureServer(server) {
      // Rollup plugin might not be fully initialized if Trix is not available
      // In that case, we skip the watcher setup
      // This allows the plugin to be used without Trix installed, but without HMR support
      // until Trix is installed
      if (rollupPlugin.partialInitialized) {
        return;
      }

      const projectRoot = process.cwd();

      const filesToWatch = rollupPlugin.filesToWatch();

      server.watcher.add(filesToWatch);

      server.watcher.on("change", (changedFile) => {
        const absoluteChangedFile = path.resolve(projectRoot, changedFile);

        if (
          filesToWatch.some((pattern) => absoluteChangedFile.includes(pattern))
        ) {
          console.log("TX3 file changed, regenerating bindings...");
          rollupPlugin.regenerateBindings();

          // Vite-specific HMR handling
          server.moduleGraph.invalidateAll();
          server.ws.send({ type: "full-reload" });
        }
      });
    },
  };
}
