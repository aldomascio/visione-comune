export const PROPOSAL_CATEGORIES = ["environment", "mobility", "public_spaces", "culture", "social", "development", "other"] as const;
export const PROPOSAL_SUBMISSION_MODES = ["anonymous", "contact"] as const;
export const PROPOSAL_STATUSES = ["new", "reviewing", "archived"] as const;

export type ProposalCategory = (typeof PROPOSAL_CATEGORIES)[number];
export type ProposalSubmissionMode = (typeof PROPOSAL_SUBMISSION_MODES)[number];
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const PROPOSAL_CATEGORY_LABELS: Record<ProposalCategory, string> = {
  environment: "Ambiente", mobility: "Mobilità", public_spaces: "Spazi pubblici", culture: "Cultura",
  social: "Sociale", development: "Sviluppo", other: "Altro"
};
export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  new: "Nuova", reviewing: "Da approfondire", archived: "Archiviata"
};

export type Proposal = {
  id: string; title: string; category: ProposalCategory; content: string;
  submissionMode: ProposalSubmissionMode; contactEmail: string | null;
  status: ProposalStatus; createdAt: Date; updatedAt: Date;
};

export type ProposalFieldErrors = Partial<Record<"title" | "category" | "content" | "submissionMode" | "contactEmail" | "privacyAcknowledged" | "status", string>>;

export class ProposalValidationError extends Error {
  constructor(readonly fieldErrors: ProposalFieldErrors) {
    super("Proposal validation failed.");
    this.name = "ProposalValidationError";
  }
}

export function validateProposalInput(input: Record<string, string>) {
  const title = input.title?.trim().replace(/\s+/g, " ") ?? "";
  const content = input.content?.trim() ?? "";
  const category = input.category as ProposalCategory;
  const submissionMode = input.submissionMode as ProposalSubmissionMode;
  const rawEmail = input.contactEmail?.trim().toLowerCase() ?? "";
  const errors: ProposalFieldErrors = {};
  if (!title) errors.title = "Inserisci il titolo della proposta.";
  else if (title.length > 180) errors.title = "Il titolo non può superare 180 caratteri.";
  if (!PROPOSAL_CATEGORIES.includes(category)) errors.category = "Seleziona un ambito.";
  if (!content) errors.content = "Descrivi la proposta.";
  else if (content.length > 5000) errors.content = "La descrizione non può superare 5.000 caratteri.";
  if (!PROPOSAL_SUBMISSION_MODES.includes(submissionMode)) errors.submissionMode = "Scegli come inviare la proposta.";
  if (submissionMode === "contact") {
    if (!rawEmail) errors.contactEmail = "Inserisci l’email.";
    else if (rawEmail.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) errors.contactEmail = "Inserisci un indirizzo email valido.";
  }
  if (input.privacyAcknowledged !== "accepted") errors.privacyAcknowledged = "Conferma di aver preso visione dell’informativa privacy.";
  if (Object.keys(errors).length) throw new ProposalValidationError(errors);
  return { title, content, category, submissionMode, contactEmail: submissionMode === "contact" ? rawEmail : null };
}
