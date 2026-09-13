import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SaveObjectInput, StorageProvider, StoredObject } from "../application/storage-provider";

const defaultRoot = path.join(process.cwd(), ".local-storage", "report-images");

export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly rootDirectory = defaultRoot) {}

  async save(input: SaveObjectInput): Promise<StoredObject> {
    await mkdir(this.rootDirectory, { recursive: true });
    const extension = normalizeExtension(input.extension);
    const storageKey = `${randomUUID()}.${extension}`;
    const filePath = this.resolveStorageKey(storageKey);
    await writeFile(filePath, input.buffer, { flag: "wx" });

    return { storageKey, size: input.buffer.byteLength };
  }

  async read(storageKey: string): Promise<Buffer> {
    return readFile(this.resolveStorageKey(storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    await rm(this.resolveStorageKey(storageKey), { force: true });
  }

  private resolveStorageKey(storageKey: string): string {
    if (!/^[a-f0-9-]+\.[a-z0-9]+$/i.test(storageKey)) {
      throw new Error("Invalid storage key.");
    }

    const resolved = path.resolve(this.rootDirectory, storageKey);
    const root = path.resolve(this.rootDirectory);

    if (!resolved.startsWith(`${root}${path.sep}`)) {
      throw new Error("Invalid storage path.");
    }

    return resolved;
  }
}

function normalizeExtension(extension: string): string {
  const normalized = extension.replace(/^\./, "").toLowerCase();

  if (!/^[a-z0-9]+$/.test(normalized)) {
    throw new Error("Invalid storage extension.");
  }

  return normalized;
}
