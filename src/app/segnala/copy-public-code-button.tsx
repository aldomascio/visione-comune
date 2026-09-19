"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/shared/ui";

export function CopyPublicCodeButton({ publicCode }: { publicCode: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      onClick={async () => {
        await navigator.clipboard.writeText(publicCode);
        setCopied(true);
      }}
      type="button"
    >
      <Copy aria-hidden="true" className="size-4" />
      {copied ? "Codice copiato" : "Copia codice"}
    </Button>
  );
}
