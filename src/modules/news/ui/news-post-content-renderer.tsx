import Link from "next/link";
import type { ReactNode } from "react";
import type { NewsPostContentDocument } from "../application/news-post-content";
import { normalizeNewsPostContentDocument } from "../application/news-post-content";

type NewsPostContentRendererProps = {
  document: NewsPostContentDocument;
};

export function NewsPostContentRenderer({ document }: NewsPostContentRendererProps) {
  const normalizedDocument = normalizeNewsPostContentDocument(document);

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-5 text-base leading-8 text-foreground [&_a]:font-semibold [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-5 [&_blockquote]:font-serif [&_blockquote]:text-xl [&_blockquote]:leading-9 [&_blockquote]:text-muted-foreground [&_h2]:pt-4 [&_h2]:font-serif [&_h2]:text-3xl [&_h2]:font-semibold [&_h2]:leading-tight [&_h3]:pt-2 [&_h3]:text-xl [&_h3]:font-semibold [&_li]:pl-1 [&_ol]:ml-6 [&_ol]:list-decimal [&_ul]:ml-6 [&_ul]:list-disc">
      {normalizedDocument.content.map((node, index) => renderBlock(node, index))}
    </div>
  );
}

type BlockNode = NewsPostContentDocument["content"][number];
type ParagraphNode = Extract<BlockNode, { type: "paragraph" }>;
type HeadingNode = Extract<BlockNode, { type: "heading" }>;
type ListNode = Extract<BlockNode, { type: "bulletList" | "orderedList" }>;
type ListItemNode = ListNode["content"][number];
type ListChildNode = ListItemNode["content"][number];
type InlineNode = NonNullable<ParagraphNode["content"]>[number] | NonNullable<HeadingNode["content"]>[number];
type Mark = NonNullable<InlineNode["marks"]>[number];

function renderBlock(node: BlockNode, index: number): ReactNode {
  if (node.type === "paragraph") {
    return <p key={index}>{renderInline(node.content)}</p>;
  }

  if (node.type === "heading") {
    if (node.attrs.level === 2) {
      return <h2 key={index}>{renderInline(node.content)}</h2>;
    }

    return <h3 key={index}>{renderInline(node.content)}</h3>;
  }

  if (node.type === "bulletList") {
    return <ul key={index}>{node.content.map(renderListItem)}</ul>;
  }

  if (node.type === "orderedList") {
    return <ol key={index}>{node.content.map(renderListItem)}</ol>;
  }

  return <blockquote key={index}>{node.content.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{renderInline(paragraph.content)}</p>)}</blockquote>;
}

function renderListItem(node: ListItemNode, index: number): ReactNode {
  return <li key={index}>{node.content.map((child, childIndex) => renderListChild(child, childIndex))}</li>;
}

function renderListChild(node: ListChildNode, index: number): ReactNode {
  if (node.type === "paragraph") {
    return <p key={index}>{renderInline(node.content)}</p>;
  }

  if (node.type === "bulletList") {
    return <ul key={index}>{node.content.map(renderListItem)}</ul>;
  }

  return <ol key={index}>{node.content.map(renderListItem)}</ol>;
}

function renderInline(content: InlineNode[] | undefined): ReactNode {
  return content?.map((node, index) => renderTextNode(node, index)) ?? null;
}

function renderTextNode(node: InlineNode, index: number): ReactNode {
  let rendered: ReactNode = node.text;

  for (const mark of node.marks ?? []) {
    rendered = renderMark(mark, rendered, index);
  }

  return <span key={index}>{rendered}</span>;
}

function renderMark(mark: Mark, children: ReactNode, index: number): ReactNode {
  if (mark.type === "bold") {
    return <strong key={`bold-${index}`}>{children}</strong>;
  }

  if (mark.type === "italic") {
    return <em key={`italic-${index}`}>{children}</em>;
  }

  const isInternalLink = mark.attrs.href.startsWith("/");

  if (isInternalLink) {
    return <Link key={`link-${index}`} href={mark.attrs.href}>{children}</Link>;
  }

  return (
    <a key={`link-${index}`} href={mark.attrs.href} rel="noopener noreferrer" target="_blank">
      {children}
    </a>
  );
}
