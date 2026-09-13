import { describe, expect, it } from "vitest";
import { readBaseEnv } from "./env";

describe("readBaseEnv", () => {
  it("uses safe defaults for the bootstrap environment", () => {
    expect(readBaseEnv({})).toEqual({
      appName: "Visione Comune",
      appUrl: "http://localhost:3000"
    });
  });

  it("reads configured public application values", () => {
    expect(
      readBaseEnv({
        NEXT_PUBLIC_APP_NAME: "Visione Comune Test",
        NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000"
      })
    ).toEqual({
      appName: "Visione Comune Test",
      appUrl: "http://127.0.0.1:3000"
    });
  });
});

