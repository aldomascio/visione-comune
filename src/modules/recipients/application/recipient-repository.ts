export type Recipient = {
  id: string;
  name: string;
  organization: string;
  email?: string;
  pec?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type RecipientListItem = Recipient & {
  categories: Array<{ id: string; name: string; active: boolean }>;
};

export type NewRecipient = Recipient;

export type RecipientUpdate = {
  id: string;
  name: string;
  organization: string;
  email?: string;
  pec?: string;
  active: boolean;
  updatedAt: Date;
};

export type CategoryRecipient = Recipient & {
  sortOrder: number;
};

export type CategoryRecipientAssociation = {
  recipientId: string;
  sortOrder: number;
};

export class DuplicateRecipientContactPersistenceError extends Error {
  constructor(readonly field: "email" | "pec", readonly value: string) {
    super(`Recipient ${field} already exists: ${value}`);
    this.name = "DuplicateRecipientContactPersistenceError";
  }
}

export type RecipientRepository = {
  listAll(): Promise<RecipientListItem[]>;
  findById(recipientId: string): Promise<Recipient | null>;
  findByEmail(email: string): Promise<Recipient | null>;
  findByPec(pec: string): Promise<Recipient | null>;
  create(recipient: NewRecipient): Promise<Recipient>;
  update(recipient: RecipientUpdate): Promise<Recipient | null>;
  findActiveByCategory(categoryId: string): Promise<CategoryRecipient[]>;
};

export type CategoryRecipientRepository = {
  listByCategory(categoryId: string): Promise<CategoryRecipient[]>;
  replaceAssociations(categoryId: string, associations: CategoryRecipientAssociation[]): Promise<void>;
  getPreferred(categoryId: string): Promise<CategoryRecipient | null>;
};
