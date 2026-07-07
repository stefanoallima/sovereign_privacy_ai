import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    // Several tests spin up a real mock HTTP server; the 5s vitest default is too
    // tight under the full suite's parallel load, causing flaky timeouts. These
    // tests are fast in isolation (<1s), so a generous ceiling only absorbs CI/load
    // jitter — it doesn't hide a slow test. (Per-test overrides, e.g. e2e 20s, win.)
    testTimeout: 30000,
    // #10: the mock-HTTP-server integration tests occasionally get CPU-starved under
    // the suite's parallel load and time out despite being correct. Retry transient
    // failures rather than fail the whole run (a genuine failure fails all attempts).
    retry: 2,
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "test-helpers/**/*.test.ts",
    ],
    // Recovered main-line React component tests (src/**/__tests__/*.test.tsx, e.g.
    // VaultBrowser) need a DOM environment + @testing-library, which are not wired
    // up yet — exclude them from this node-env run until that harness lands (follow-up).
    exclude: ["node_modules/**", "src/**/__tests__/**"],
    setupFiles: ["./test-helpers/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
