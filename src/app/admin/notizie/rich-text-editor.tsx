"use client";

import LinkExtension from "@tiptap/extension-link";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useMemo, useState } from "react";
import { Button, cn } from "@/shared/ui";
import {
  EMPTY_NEWS_POST_DOCUMENT,
  isSafeNewsPostLinkUrl,
  parseNewsPostContentDocument,
  serializeNewsPostContentDocument,
  type NewsPostContentDocument
} from "@/modules/news/application/news-post-content";

type RichTextEditorProps = {
  describedBy?: string;
  invalid?: boolean;
  initialValue: string;
  inputName: string;
};

export function RichTextEditor({ describedBy, initialValue, inputName, invalid = false }: RichTextEditorProps) {
  const initialDocument = useMemo(() => parseInitialDocument(initialValue), [initialValue]);
  const [serializedDocument, setSerializedDocument] = useState(() => serializeNewsPostContentDocument(initialDocument));

  const editor = useEditor({
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-describedby": describedBy ?? "",
        "aria-invalid": String(invalid),
        "aria-label": "Contenuto della notizia",
        id: "content-editor",
        class: cn(
          "min-h-72 rounded-b-md border-x border-b border-input bg-background px-4 py-3 text-base leading-7 text-foreground outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "prose-editor",
          invalid && "border-destructive ring-1 ring-destructive"
        ),
        role: "textbox"
      }
    },
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        hardBreak: false,
        heading: { levels: [2, 3] },
        horizontalRule: false
      }),
      LinkExtension.configure({
        autolink: false,
        defaultProtocol: "https",
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank"
        },
        linkOnPaste: false,
        openOnClick: false,
        protocols: ["http", "https", "mailto"],
        validate: isSafeNewsPostLinkUrl
      })
    ],
    content: initialDocument,
    onUpdate: ({ editor: currentEditor }) => {
      setSerializedDocument(JSON.stringify(currentEditor.getJSON()));
    }
  });


  const toolbarButtonClass = "min-h-9 px-3 py-1.5 text-xs";

  return (
    <div className="grid gap-0">
      <input name={inputName} type="hidden" value={serializedDocument} />
      <div aria-label="Toolbar editor notizia" className="flex flex-wrap gap-2 rounded-t-md border border-input bg-muted/40 p-2" role="toolbar">
        <Button aria-pressed={editor?.isActive("heading", { level: 2 }) ?? false} className={toolbarButtonClass} disabled={!editor} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} type="button" variant="outline">
          H2
        </Button>
        <Button aria-pressed={editor?.isActive("heading", { level: 3 }) ?? false} className={toolbarButtonClass} disabled={!editor} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} type="button" variant="outline">
          H3
        </Button>
        <Button aria-pressed={editor?.isActive("bold") ?? false} className={toolbarButtonClass} disabled={!editor} onClick={() => editor?.chain().focus().toggleBold().run()} type="button" variant="outline">
          Grassetto
        </Button>
        <Button aria-pressed={editor?.isActive("italic") ?? false} className={toolbarButtonClass} disabled={!editor} onClick={() => editor?.chain().focus().toggleItalic().run()} type="button" variant="outline">
          Corsivo
        </Button>
        <Button aria-pressed={editor?.isActive("link") ?? false} className={toolbarButtonClass} disabled={!editor} onClick={() => setLink(editor)} type="button" variant="outline">
          Link
        </Button>
        <Button aria-pressed={editor?.isActive("bulletList") ?? false} className={toolbarButtonClass} disabled={!editor} onClick={() => editor?.chain().focus().toggleBulletList().run()} type="button" variant="outline">
          Elenco puntato
        </Button>
        <Button aria-pressed={editor?.isActive("orderedList") ?? false} className={toolbarButtonClass} disabled={!editor} onClick={() => editor?.chain().focus().toggleOrderedList().run()} type="button" variant="outline">
          Elenco numerato
        </Button>
        <Button aria-pressed={editor?.isActive("blockquote") ?? false} className={toolbarButtonClass} disabled={!editor} onClick={() => editor?.chain().focus().toggleBlockquote().run()} type="button" variant="outline">
          Citazione
        </Button>
        <Button className={toolbarButtonClass} disabled={!editor || !editor.can().undo()} onClick={() => editor?.chain().focus().undo().run()} type="button" variant="secondary">
          Annulla
        </Button>
        <Button className={toolbarButtonClass} disabled={!editor || !editor.can().redo()} onClick={() => editor?.chain().focus().redo().run()} type="button" variant="secondary">
          Ripristina
        </Button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function parseInitialDocument(value: string): NewsPostContentDocument {
  if (!value) return EMPTY_NEWS_POST_DOCUMENT;

  try {
    return parseNewsPostContentDocument(value);
  } catch {
    return EMPTY_NEWS_POST_DOCUMENT;
  }
}

function setLink(editor: Editor | null): void {
  if (!editor) return;

  const previousUrl = editor.getAttributes("link").href as string | undefined;
  const url = window.prompt("URL del link", previousUrl ?? "https://");

  if (url === null) return;

  const normalizedUrl = url.trim();

  if (!normalizedUrl) {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }

  if (!isSafeNewsPostLinkUrl(normalizedUrl)) {
    window.alert("Usa un link http, https, mailto oppure un percorso interno che inizi con /.");
    return;
  }

  editor.chain().focus().extendMarkRange("link").setLink({ href: normalizedUrl, target: "_blank", rel: "noopener noreferrer" }).run();
}