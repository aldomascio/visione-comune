import sharp from "sharp";

export const REPORT_IMAGE_MAX_INPUT_BYTES = 10 * 1024 * 1024;
export const REPORT_IMAGE_MAX_LONG_EDGE = 2200;
export const REPORT_IMAGE_OUTPUT_MIME_TYPE = "image/jpeg";
export const REPORT_IMAGE_OUTPUT_EXTENSION = "jpg";
export const REPORT_IMAGE_ALLOWED_INPUT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export class InvalidReportImageError extends Error {
  constructor(readonly code: ReportImageErrorCode) {
    super(code);
    this.name = "InvalidReportImageError";
  }
}

export type ReportImageErrorCode =
  | "empty"
  | "too_large"
  | "unsupported_type"
  | "corrupt"
  | "processing_failed";

export type ProcessReportImageInput = {
  buffer: Buffer;
  declaredMimeType?: string;
};

export type ProcessedReportImage = {
  buffer: Buffer;
  mimeType: typeof REPORT_IMAGE_OUTPUT_MIME_TYPE;
  extension: typeof REPORT_IMAGE_OUTPUT_EXTENSION;
  size: number;
};

export async function processReportImage(input: ProcessReportImageInput): Promise<ProcessedReportImage> {
  if (input.buffer.byteLength === 0) {
    throw new InvalidReportImageError("empty");
  }

  if (input.buffer.byteLength > REPORT_IMAGE_MAX_INPUT_BYTES) {
    throw new InvalidReportImageError("too_large");
  }

  const detectedMimeType = detectImageMimeType(input.buffer);

  if (!detectedMimeType) {
    throw new InvalidReportImageError("unsupported_type");
  }

  if (input.declaredMimeType && !REPORT_IMAGE_ALLOWED_INPUT_TYPES.includes(input.declaredMimeType as never)) {
    throw new InvalidReportImageError("unsupported_type");
  }

  try {
    const image = sharp(input.buffer, { failOn: "error" });
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new InvalidReportImageError("corrupt");
    }

    const normalized = await image
      .rotate()
      .resize({
        width: REPORT_IMAGE_MAX_LONG_EDGE,
        height: REPORT_IMAGE_MAX_LONG_EDGE,
        fit: "inside",
        withoutEnlargement: true
      })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();

    return {
      buffer: normalized,
      mimeType: REPORT_IMAGE_OUTPUT_MIME_TYPE,
      extension: REPORT_IMAGE_OUTPUT_EXTENSION,
      size: normalized.byteLength
    };
  } catch (error) {
    if (error instanceof InvalidReportImageError) {
      throw error;
    }

    throw new InvalidReportImageError("processing_failed");
  }
}

export function detectImageMimeType(buffer: Buffer): (typeof REPORT_IMAGE_ALLOWED_INPUT_TYPES)[number] | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

export function mapReportImageErrorToMessage(error: unknown): string {
  if (!(error instanceof InvalidReportImageError)) {
    return "Non siamo riusciti a elaborare la foto. Riprova con un'altra immagine.";
  }

  const messages: Record<ReportImageErrorCode, string> = {
    empty: "La foto selezionata e vuota.",
    too_large: "La foto supera il limite di 10 MB.",
    unsupported_type: "La foto deve essere JPEG, PNG o WebP.",
    corrupt: "La foto sembra corrotta. Scegli un'altra immagine.",
    processing_failed: "Non siamo riusciti a elaborare la foto. Riprova con un'altra immagine."
  };

  return messages[error.code];
}
