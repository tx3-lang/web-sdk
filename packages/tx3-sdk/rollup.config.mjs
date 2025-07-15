import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";

export default {
  input: {
    index: "src/index.ts",
    "trp/index": "src/trp/index.ts",
  },
  output: [
    {
      dir: "dist",
      entryFileNames: chunk => {
        if (chunk.name === 'trp/index') return 'trp/index.js';
        return 'index.js';
      },
      format: "cjs",
      sourcemap: true,
      exports: "named",
      preserveModules: false,
    },
    {
      dir: "dist",
      entryFileNames: chunk => {
        if (chunk.name === 'trp/index') return 'trp/index.esm.js';
        return 'index.esm.js';
      },
      format: "es",
      sourcemap: true,
      exports: "named",
      preserveModules: false,
    },
  ],
  plugins: [
    resolve(), 
    commonjs(), 
    typescript({ 
      tsconfig: "./tsconfig.json",
      declaration: true,
      declarationDir: "./dist",
      rootDir: "./src"
    })
  ],
  external: [], // Add external dependencies here if needed
};
