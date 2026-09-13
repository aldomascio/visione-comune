import { beforeEach, describe, expect, it } from "vitest";
import type { CategoryDetails } from "@/modules/categories/application/category-repository";
import type { CategoryRepository } from "@/modules/categories/application/category-repository";
import {
  CreateRecipientUseCase,
  DuplicateRecipientContactError,
  GetPreferredRecipientForCategoryUseCase,
  RecipientValidationError,
  SetRecipientActiveStateUseCase,
  UpdateCategoryRecipientsUseCase
} from "./manage-recipients";
import type {
  CategoryRecipient,
  CategoryRecipientAssociation,
  CategoryRecipientRepository,
  NewRecipient,
  Recipient,
  RecipientListItem,
  RecipientRepository,
  RecipientUpdate
} from "./recipient-repository";

describe("recipient management use cases", () => {
  let recipientRepository: InMemoryRecipientRepository;
  let categoryRepository: InMemoryCategoryRepository;

  beforeEach(() => {
    recipientRepository = new InMemoryRecipientRepository();
    categoryRepository = new InMemoryCategoryRepository();
  });

  it("creates a valid recipient with normalized contacts", async () => {
    const result = await new CreateRecipientUseCase({ recipientRepository, createId: () => "recipient-1" }).execute({
      name: " Ufficio Tecnico ",
      organization: " Comune di Venafro ",
      email: " TECNICO@example.test ",
      pec: " tecnico@pec.example.test "
    });

    expect(result).toMatchObject({ id: "recipient-1", name: "Ufficio Tecnico", organization: "Comune di Venafro", email: "tecnico@example.test", pec: "tecnico@pec.example.test", active: true });
  });

  it("rejects missing contacts", async () => {
    await expect(new CreateRecipientUseCase({ recipientRepository }).execute({ name: "Ufficio", organization: "Comune" })).rejects.toMatchObject({
      fieldErrors: { email: "Inserisci almeno un indirizzo email o PEC.", pec: "Inserisci almeno un indirizzo email o PEC." }
    });
  });

  it("rejects invalid email and PEC syntax", async () => {
    await expect(new CreateRecipientUseCase({ recipientRepository }).execute({ name: "Ufficio", organization: "Comune", email: "non-valida", pec: "pec-non-valida" })).rejects.toBeInstanceOf(RecipientValidationError);
  });

  it("rejects duplicate email and PEC", async () => {
    await recipientRepository.create(recipient({ id: "existing", email: "ufficio@example.test", pec: "ufficio@pec.example.test" }));

    await expect(new CreateRecipientUseCase({ recipientRepository }).execute({ name: "Altro", organization: "Comune", email: "ufficio@example.test" })).rejects.toBeInstanceOf(DuplicateRecipientContactError);
    await expect(new CreateRecipientUseCase({ recipientRepository }).execute({ name: "Altro", organization: "Comune", pec: "ufficio@pec.example.test" })).rejects.toBeInstanceOf(DuplicateRecipientContactError);
  });

  it("deactivates recipients", async () => {
    await recipientRepository.create(recipient({ id: "recipient-1", active: true }));

    await expect(new SetRecipientActiveStateUseCase({ recipientRepository }).execute({ id: "recipient-1", active: false })).resolves.toMatchObject({ active: false });
  });

  it("associates category recipients and returns the preferred recipient", async () => {
    await recipientRepository.create(recipient({ id: "recipient-1", name: "Secondario" }));
    await recipientRepository.create(recipient({ id: "recipient-2", name: "Principale" }));

    await new UpdateCategoryRecipientsUseCase({ categoryRepository, recipientRepository, categoryRecipientRepository: recipientRepository }).execute({
      categoryId: "category-1",
      recipientIds: ["recipient-1", "recipient-2"],
      primaryRecipientId: "recipient-2"
    });

    await expect(new GetPreferredRecipientForCategoryUseCase({ categoryRecipientRepository: recipientRepository }).execute({ categoryId: "category-1" })).resolves.toMatchObject({ id: "recipient-2", name: "Principale" });
  });

  it("excludes inactive recipients from operational proposals", async () => {
    await recipientRepository.create(recipient({ id: "recipient-1", active: false }));
    await recipientRepository.replaceAssociations("category-1", [{ recipientId: "recipient-1", sortOrder: 0 }]);

    await expect(new GetPreferredRecipientForCategoryUseCase({ categoryRecipientRepository: recipientRepository }).execute({ categoryId: "category-1" })).resolves.toBeNull();
  });

  it("returns no preferred recipient for a category without recipients", async () => {
    await expect(new GetPreferredRecipientForCategoryUseCase({ categoryRecipientRepository: recipientRepository }).execute({ categoryId: "category-1" })).resolves.toBeNull();
  });
});

function recipient(overrides: Partial<Recipient> = {}): Recipient {
  const now = new Date("2026-01-01T10:00:00.000Z");
  return { id: "recipient-id", name: "Ufficio", organization: "Comune", email: "ufficio@example.test", active: true, createdAt: now, updatedAt: now, ...overrides };
}

class InMemoryRecipientRepository implements RecipientRepository, CategoryRecipientRepository {
  private readonly recipients = new Map<string, Recipient>();
  private readonly associations = new Map<string, CategoryRecipientAssociation[]>();

  async listAll(): Promise<RecipientListItem[]> { return [...this.recipients.values()].map((recipient) => ({ ...recipient, categories: [] })); }
  async findById(id: string) { return this.recipients.get(id) ?? null; }
  async findByEmail(email: string) { return [...this.recipients.values()].find((recipient) => recipient.email === email) ?? null; }
  async findByPec(pec: string) { return [...this.recipients.values()].find((recipient) => recipient.pec === pec) ?? null; }
  async create(recipient: NewRecipient) { this.recipients.set(recipient.id, recipient); return recipient; }
  async update(update: RecipientUpdate) { const existing = this.recipients.get(update.id); if (!existing) return null; const next = { ...existing, ...update }; this.recipients.set(update.id, next); return next; }
  async findActiveByCategory(categoryId: string) { return this.listByCategory(categoryId).then((rows) => rows.filter((row) => row.active)); }
  async listByCategory(categoryId: string): Promise<CategoryRecipient[]> { return (this.associations.get(categoryId) ?? []).flatMap((association) => { const recipient = this.recipients.get(association.recipientId); return recipient ? [{ ...recipient, sortOrder: association.sortOrder }] : []; }).sort((a, b) => a.sortOrder - b.sortOrder); }
  async replaceAssociations(categoryId: string, associations: CategoryRecipientAssociation[]) { this.associations.set(categoryId, associations); }
  async getPreferred(categoryId: string) { return (await this.findActiveByCategory(categoryId))[0] ?? null; }
}

class InMemoryCategoryRepository implements CategoryRepository {
  private readonly category: CategoryDetails = { id: "category-1", name: "Strade", slug: "strade", active: true, createdAt: new Date(), updatedAt: new Date() };
  async listActive() { return [this.category]; }
  async listAll() { return [{ ...this.category, reportCount: 0 }]; }
  async findActiveById(categoryId: string) { return categoryId === this.category.id ? this.category : null; }
  async findById(categoryId: string) { return categoryId === this.category.id ? this.category : null; }
  async findBySlug(slug: string) { return slug === this.category.slug ? this.category : null; }
  async create(category: CategoryDetails) { return category; }
  async update() { return this.category; }
}
