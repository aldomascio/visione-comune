import { describe, expect, it } from "vitest";
import {
  PUBLIC_CODE_RANDOM_LENGTH,
  READABLE_PUBLIC_CODE_ALPHABET,
  RandomPublicCodeGenerator
} from "./public-code-generator";

describe("RandomPublicCodeGenerator", () => {
  it("generates public codes with the expected readable alphabet", () => {
    const generator = new RandomPublicCodeGenerator();
    const generatedCode = generator.generate().toString();

    expect(generatedCode).toMatch(/^VC-[2-9A-HJ-KM-NP-Z]{8}$/);
    expect(READABLE_PUBLIC_CODE_ALPHABET).not.toContain("0");
    expect(READABLE_PUBLIC_CODE_ALPHABET).not.toContain("O");
    expect(READABLE_PUBLIC_CODE_ALPHABET).not.toContain("1");
    expect(READABLE_PUBLIC_CODE_ALPHABET).not.toContain("I");
    expect(READABLE_PUBLIC_CODE_ALPHABET).not.toContain("L");
    expect(generatedCode.replace("VC-", "")).toHaveLength(PUBLIC_CODE_RANDOM_LENGTH);
  });
});
