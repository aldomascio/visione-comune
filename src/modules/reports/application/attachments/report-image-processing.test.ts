import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  InvalidReportImageError,
  REPORT_IMAGE_MAX_INPUT_BYTES,
  detectImageMimeType,
  processReportImage
} from "./report-image-processing";

describe("report image processing", () => {
  it("normalizes a valid PNG to JPEG", async () => {
    const input = await sharp({ create: { width: 40, height: 30, channels: 3, background: "red" } })
      .png()
      .toBuffer();

    const result = await processReportImage({ buffer: input, declaredMimeType: "image/png" });

    expect(result.mimeType).toBe("image/jpeg");
    expect(result.extension).toBe("jpg");
    expect(detectImageMimeType(result.buffer)).toBe("image/jpeg");
    expect(result.size).toBeGreaterThan(0);
  });

  it("rejects empty images", async () => {
    await expect(processReportImage({ buffer: Buffer.alloc(0) })).rejects.toMatchObject({
      code: "empty"
    });
  });

  it("rejects oversized images before processing", async () => {
    await expect(processReportImage({ buffer: Buffer.alloc(REPORT_IMAGE_MAX_INPUT_BYTES + 1) })).rejects.toMatchObject({
      code: "too_large"
    });
  });

  it("rejects unsupported signatures", async () => {
    await expect(processReportImage({ buffer: Buffer.from("not an image") })).rejects.toBeInstanceOf(
      InvalidReportImageError
    );
  });
});
