import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";

export default {
  input: {
    index: "src/index.ts",
    trp: "src/trp.ts"
  },
  output: [
    {
      dir: "dist",
      entryFileNames: chunk => chunk.name === 'trp' ? 'trp.js' : 'index.js',
      format: "cjs",
      sourcemap: true,
      exports: "named",
    },
    {
      dir: "dist",
      entryFileNames: chunk => chunk.name === 'trp' ? 'trp.esm.js' : 'index.esm.js',
      format: "es",
      sourcemap: true,
      exports: "named",
    },
  ],
  plugins: [resolve(), commonjs(), typescript({ tsconfig: "./tsconfig.json" })],
};
