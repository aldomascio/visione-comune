import { NextResponse } from "next/server";
import { parseReportAttachmentType } from "@/modules/reports/application/attachments/report-attachments";
import { PublicCode } from "@/modules/reports/domain";
import { DrizzleReportRepository } from "@/modules/reports/infrastructure/drizzle-report-repository";
import { LocalStorageProvider } from "@/modules/storage/infrastructure/local-storage-provider";
import { createDatabaseConnection } from "@/shared/db/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ publicCode: string }> }) {
  const { publicCode } = await context.params;
  const attachmentType = parseReportAttachmentType(new URL(request.url).searchParams.get("type") ?? "report_photo");

  if (!attachmentType) {
    return new NextResponse(null, { status: 404 });
  }

  let connection;

  try {
    const parsedPublicCode = PublicCode.create(publicCode);
    connection = createDatabaseConnection();
    const attachment = await new DrizzleReportRepository(connection.db).findPublicAttachmentByPublicCode(parsedPublicCode, attachmentType);

    if (!attachment) {
      return new NextResponse(null, { status: 404 });
    }

    const buffer = await new LocalStorageProvider().read(attachment.storageKey);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "private, max-age=0, must-revalidate"
      }
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  } finally {
    await connection?.close();
  }
}
