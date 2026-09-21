"use client";

import { Check, Link as LinkIcon } from "lucide-react";
import { FaFacebookF, FaLinkedinIn, FaWhatsapp } from "react-icons/fa6";
import { useState, type ReactNode } from "react";
import { cn } from "@/shared/ui";

type ArticleShareProps = {
  title: string;
};

const shareButtonClassName = "inline-flex items-center justify-center text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function ArticleShare({ title }: ArticleShareProps) {
  const [copied, setCopied] = useState(false);

  function openShareUrl(createUrl: (articleUrl: string) => string) {
    const shareUrl = createUrl(window.location.href);
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  }

  async function copyArticleUrl() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-wrap items-center gap-3 border-t border-border pt-6" aria-labelledby="article-share-title">
      <h2 className="text-sm font-medium text-muted-foreground" id="article-share-title">Condividi questo articolo:</h2>
      <div className="flex flex-wrap items-center gap-2">
        <ShareButton label="Condividi su Facebook" onClick={() => openShareUrl((url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`)}>
          <FaFacebookF aria-hidden="true" className="size-5" />
        </ShareButton>
        <ShareButton label="Condividi su WhatsApp" onClick={() => openShareUrl((url) => `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`)}>
          <FaWhatsapp aria-hidden="true" className="size-5" />
        </ShareButton>
        <ShareButton label="Condividi su LinkedIn" onClick={() => openShareUrl((url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`)}>
          <FaLinkedinIn aria-hidden="true" className="size-5" />
        </ShareButton>
        <button
          aria-label={copied ? "Link copiato" : "Copia il link dell'articolo"}
          className={cn(shareButtonClassName, copied && "border-success text-success")}
          onClick={copyArticleUrl}
          title={copied ? "Link copiato" : "Copia link"}
          type="button"
        >
          {copied ? <Check aria-hidden="true" className="size-5" /> : <LinkIcon aria-hidden="true" className="size-5" />}
        </button>
        <span aria-live="polite" className="sr-only">{copied ? "Link copiato" : null}</span>
      </div>
    </section>
  );
}

function ShareButton({ children, label, onClick }: { children: ReactNode; label: string; onClick: () => void }) {
  return (
    <button aria-label={label} className={shareButtonClassName} onClick={onClick} title={label} type="button">
      {children}
    </button>
  );
}
