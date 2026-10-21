import { defineConfig } from "@playwright/test";
// Desktop smoke test. Run `npm run build` first; the app serves apps/serum-wave-gen-vxx/dist.
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  timeout: 90000,
  use: { actionTimeout: 10000 },
  outputDir: "./test-results",
});
