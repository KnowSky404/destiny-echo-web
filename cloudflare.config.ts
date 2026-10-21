import { defineConfig } from "cf/config";

export default defineConfig(({ mode }) => ({
  accountId: "d4e1a00fe7eb8b0a2d14ae3b3d108501",
  worker: {
    name: mode === "pre" ? "destiny-echo-web-pre" : "destiny-echo-web",
    compatibilityDate: "2026-10-20",
    workersDev: true,
    assets: {
      notFoundHandling: "none",
    },
    observability: {
      enabled: true,
      logs: { enabled: true, invocationLogs: true },
      traces: { enabled: true },
    },
  },
}));
