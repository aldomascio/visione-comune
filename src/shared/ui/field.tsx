import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "./cn";

type FieldProps = ComponentPropsWithoutRef<"div"> & {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
};

export function Field({ children, className, hint, htmlFor, label, ...props }: FieldProps) {
  return (
    <div className={cn("grid gap-2", className)} {...props}>
      <label className="text-sm font-medium leading-none text-foreground" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
