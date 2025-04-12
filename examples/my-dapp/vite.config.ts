import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tx3 from "vite-plugin-tx3";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tx3({
      inputFiles: ["tx3/**/*.tx3"],
      trpEndpoint: "http://localhost:8000",
    }),
    react(),
  ],
});
