import { defineWranglerConfig } from "wrangler/experimental-config";

export default defineWranglerConfig(({ mode }) => ({
  assetsDirectory: mode === "pre" ? "./dist-pre" : "./dist",
}));
