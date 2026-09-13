export type StoredObject = {
  storageKey: string;
  size: number;
};

export type SaveObjectInput = {
  buffer: Buffer;
  extension: string;
};

export type StorageProvider = {
  save(input: SaveObjectInput): Promise<StoredObject>;
  read(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
};
