import { describe, expect, it } from "vitest";
import {
  GEOCODING_MAX_RESULTS,
  normalizeGeocodingLimit,
  validateSearchQuery,
  isValidCoordinate
} from "./geocoding-provider";

describe("geocoding provider contract helpers", () => {
  it("rejects autocomplete queries shorter than the minimum length", () => {
    expect(validateSearchQuery("vi")).toBeNull();
    expect(validateSearchQuery("  Via   Roma  ")).toBe("Via Roma");
  });

  it("normalizes result limits", () => {
    expect(normalizeGeocodingLimit(undefined)).toBe(GEOCODING_MAX_RESULTS);
    expect(normalizeGeocodingLimit(99)).toBe(GEOCODING_MAX_RESULTS);
    expect(normalizeGeocodingLimit(0)).toBe(GEOCODING_MAX_RESULTS);
    expect(normalizeGeocodingLimit(2.8)).toBe(2);
  });

  it("validates coordinates", () => {
    expect(isValidCoordinate(41.482, 14.043)).toBe(true);
    expect(isValidCoordinate(91, 14.043)).toBe(false);
    expect(isValidCoordinate(41.482, 181)).toBe(false);
  });
});
