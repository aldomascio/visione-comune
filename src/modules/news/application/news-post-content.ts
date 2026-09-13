export type NewsPostContentDocument = {
  type: "doc";
  content: NewsPostContentBlock[];
};

type NewsPostContentBlock =
  | NewsPostParagraphNode
  | NewsPostHeadingNode
  | NewsPostBulletListNode
  | NewsPostOrderedListNode
  | NewsPostBlockquoteNode;

type NewsPostInlineNode = NewsPostTextNode;

type NewsPostMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "link"; attrs: { href: string; target: "_blank"; rel: "noopener noreferrer" } };

type NewsPostTextNode = {
  type: "text";
  text: string;
  marks?: NewsPostMark[];
};

type NewsPostParagraphNode = {
  type: "paragraph";
  content?: NewsPostInlineNode[];
};

type NewsPostHeadingNode = {
  type: "heading";
  attrs: { level: 2 | 3 };
  content?: NewsPostInlineNode[];
};

type NewsPostListItemNode = {
  type: "listItem";
  content: Array<NewsPostParagraphNode | NewsPostBulletListNode | NewsPostOrderedListNode>;
};

type NewsPostBulletListNode = {
  type: "bulletList";
  content: NewsPostListItemNode[];
};

type NewsPostOrderedListNode = {
  type: "orderedList";
  content: NewsPostListItemNode[];
};

type NewsPostBlockquoteNode = {
  type: "blockquote";
  content: NewsPostParagraphNode[];
};

export const EMPTY_NEWS_POST_DOCUMENT: NewsPostContentDocument = {
  type: "doc",
  content: [{ type: "paragraph" }]
};

export const NEWS_POST_CONTENT_MAX_TEXT_LENGTH = 12000;

export class InvalidNewsPostContentDocumentError extends Error {
  constructor(message = "Documento rich text non valido.") {
    super(message);
    this.name = "InvalidNewsPostContentDocumentError";
  }
}

export function parseNewsPostContentDocument(value: string): NewsPostContentDocument {
  try {
    return normalizeNewsPostContentDocument(JSON.parse(value));
  } catch (error) {
    if (error instanceof InvalidNewsPostContentDocumentError) {
      throw error;
    }

    throw new InvalidNewsPostContentDocumentError("Il contenuto non e un documento JSON valido.");
  }
}

export function normalizeNewsPostContentDocument(value: unknown): NewsPostContentDocument {
  if (!isRecord(value) || value.type !== "doc") {
    throw new InvalidNewsPostContentDocumentError();
  }

  const rawContent = Array.isArray(value.content) ? value.content : [];
  const content = rawContent.map(normalizeBlockNode).filter((node): node is NewsPostContentBlock => node !== null);
  const document: NewsPostContentDocument = { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] };

  const textLength = getNewsPostContentText(document).length;
  if (textLength > NEWS_POST_CONTENT_MAX_TEXT_LENGTH) {
    throw new InvalidNewsPostContentDocumentError(`Il contenuto non puo superare ${NEWS_POST_CONTENT_MAX_TEXT_LENGTH} caratteri di testo.`);
  }

  return document;
}

export function newsPostContentDocumentFromText(value: string): NewsPostContentDocument {
  const paragraphs = value
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map<NewsPostParagraphNode>((paragraph) => ({
      type: "paragraph",
      content: [{ type: "text", text: paragraph }]
    }));

  return { type: "doc", content: paragraphs.length > 0 ? paragraphs : [{ type: "paragraph" }] };
}

export function serializeNewsPostContentDocument(value: NewsPostContentDocument): string {
  return JSON.stringify(normalizeNewsPostContentDocument(value));
}

export function getNewsPostContentText(value: NewsPostContentDocument): string {
  return collectText(value.content).replace(/[ \t]+\n/g, "\n").trim();
}

export function isNewsPostContentEmpty(value: NewsPostContentDocument): boolean {
  return getNewsPostContentText(value).length === 0;
}

export function isSafeNewsPostLinkUrl(value: string): boolean {
  const normalized = value.trim();

  if (!normalized) return false;
  if (normalized.startsWith("/") && !normalized.startsWith("//")) return true;

  try {
    const url = new URL(normalized);
    return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:";
  } catch {
    return false;
  }
}

function normalizeBlockNode(value: unknown): NewsPostContentBlock | null {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null;
  }

  if (value.type === "paragraph") {
    return normalizeParagraphNode(value);
  }

  if (value.type === "heading") {
    return normalizeHeadingNode(value);
  }

  if (value.type === "bulletList") {
    return normalizeBulletListNode(value);
  }

  if (value.type === "orderedList") {
    return normalizeOrderedListNode(value);
  }

  if (value.type === "blockquote") {
    return normalizeBlockquoteNode(value);
  }

  throw new InvalidNewsPostContentDocumentError(`Nodo non consentito: ${value.type}.`);
}

function normalizeParagraphNode(value: Record<string, unknown>): NewsPostParagraphNode {
  const content = normalizeInlineContent(value.content);
  return content.length > 0 ? { type: "paragraph", content } : { type: "paragraph" };
}

function normalizeHeadingNode(value: Record<string, unknown>): NewsPostHeadingNode {
  const attrs = isRecord(value.attrs) ? value.attrs : {};
  const level = attrs.level;

  if (level !== 2 && level !== 3) {
    throw new InvalidNewsPostContentDocumentError("Sono consentiti solo heading H2 e H3.");
  }

  const content = normalizeInlineContent(value.content);
  return content.length > 0 ? { type: "heading", attrs: { level }, content } : { type: "heading", attrs: { level } };
}

function normalizeBulletListNode(value: Record<string, unknown>): NewsPostBulletListNode {
  const content = normalizeListItems(value.content);
  return { type: "bulletList", content };
}

function normalizeOrderedListNode(value: Record<string, unknown>): NewsPostOrderedListNode {
  const content = normalizeListItems(value.content);
  return { type: "orderedList", content };
}

function normalizeBlockquoteNode(value: Record<string, unknown>): NewsPostBlockquoteNode {
  const rawContent = Array.isArray(value.content) ? value.content : [];
  const content = rawContent
    .map((node) => (isRecord(node) && node.type === "paragraph" ? normalizeParagraphNode(node) : null))
    .filter((node): node is NewsPostParagraphNode => node !== null);

  if (content.length === 0) {
    throw new InvalidNewsPostContentDocumentError("La citazione deve contenere almeno un paragrafo.");
  }

  return { type: "blockquote", content };
}

function normalizeListItems(value: unknown): NewsPostListItemNode[] {
  const items = Array.isArray(value) ? value : [];
  const content = items.map(normalizeListItemNode);

  if (content.length === 0) {
    throw new InvalidNewsPostContentDocumentError("La lista deve contenere almeno un elemento.");
  }

  return content;
}

function normalizeListItemNode(value: unknown): NewsPostListItemNode {
  if (!isRecord(value) || value.type !== "listItem") {
    throw new InvalidNewsPostContentDocumentError("Elemento lista non valido.");
  }

  const rawContent = Array.isArray(value.content) ? value.content : [];
  const content = rawContent
    .map((node) => {
      if (!isRecord(node) || typeof node.type !== "string") return null;
      if (node.type === "paragraph") return normalizeParagraphNode(node);
      if (node.type === "bulletList") return normalizeBulletListNode(node);
      if (node.type === "orderedList") return normalizeOrderedListNode(node);
      throw new InvalidNewsPostContentDocumentError(`Nodo lista non consentito: ${node.type}.`);
    })
    .filter((node): node is NewsPostListItemNode["content"][number] => node !== null);

  if (content.length === 0) {
    throw new InvalidNewsPostContentDocumentError("Elemento lista vuoto.");
  }

  return { type: "listItem", content };
}

function normalizeInlineContent(value: unknown): NewsPostInlineNode[] {
  const items = Array.isArray(value) ? value : [];

  return items.map(normalizeTextNode).filter((node): node is NewsPostTextNode => node !== null);
}

function normalizeTextNode(value: unknown): NewsPostTextNode | null {
  if (!isRecord(value) || value.type !== "text") {
    throw new InvalidNewsPostContentDocumentError("Sono consentiti solo nodi testo nel contenuto inline.");
  }

  if (typeof value.text !== "string" || value.text.length === 0) {
    return null;
  }

  const marks = normalizeMarks(value.marks);
  return marks.length > 0 ? { type: "text", text: value.text, marks } : { type: "text", text: value.text };
}

function normalizeMarks(value: unknown): NewsPostMark[] {
  if (!Array.isArray(value)) return [];

  return value.map(normalizeMark).filter((mark): mark is NewsPostMark => mark !== null);
}

function normalizeMark(value: unknown): NewsPostMark | null {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null;
  }

  if (value.type === "bold" || value.type === "italic") {
    return { type: value.type };
  }

  if (value.type === "link") {
    const attrs = isRecord(value.attrs) ? value.attrs : {};
    const href = typeof attrs.href === "string" ? attrs.href.trim() : "";

    if (!isSafeNewsPostLinkUrl(href)) {
      throw new InvalidNewsPostContentDocumentError("Il link contiene un protocollo non consentito.");
    }

    return { type: "link", attrs: { href, target: "_blank", rel: "noopener noreferrer" } };
  }

  throw new InvalidNewsPostContentDocumentError(`Formato testo non consentito: ${value.type}.`);
}

function collectText(nodes: Array<NewsPostContentBlock | NewsPostListItemNode | NewsPostParagraphNode | NewsPostInlineNode>): string {
  return nodes
    .map((node) => {
      if (node.type === "text") return node.text;
      if ("content" in node && Array.isArray(node.content)) return `${collectText(node.content)}\n`;
      return "";
    })
    .join("")
    .replace(/\n{3,}/g, "\n\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
