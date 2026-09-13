import { execFileSync } from "node:child_process";
import { defineConfig, devices } from "@playwright/test";

function isPortListening(port: number): boolean {
  try {
    execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const manualDevServerUrl = "http://localhost:3000";
const isolatedE2eServerUrl = "http://127.0.0.1:3100";
const e2eBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? (isPortListening(3000) ? manualDevServerUrl : isolatedE2eServerUrl);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: e2eBaseUrl,
    trace: "on-first-retry"
  },
  webServer: {
    command: `NEXT_PUBLIC_APP_URL=${isolatedE2eServerUrl} pnpm exec next dev --hostname 127.0.0.1 --port 3100`,
    url: e2eBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
