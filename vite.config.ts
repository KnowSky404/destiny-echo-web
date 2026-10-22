import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  base: "./",
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
  build: {
    outDir: mode === "pre" ? "dist-pre" : "dist",
    target: "es2022",
    rolldownOptions: {
      output: { codeSplitting: { groups: [{ name: "phaser", test: /node_modules\/phaser/ }] } },
    },
  },
}));
